import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { tryFulfillReferralForUser } from '../lib/referral.js'
import { getSessionUser } from '../lib/session.js'
import { activatePaidSubscription } from '../lib/subscription.js'
import { createYooPayment, isYooKassaConfigured, verifyYooWebhookBasicAuth } from '../lib/yookassa.js'

async function requireUser(request: any, reply: any) {
  const user = await getSessionUser(request)
  if (!user) {
    reply.code(401).send({ error: 'Требуется авторизация' })
    return null
  }
  return user
}

async function markOrderPaid(orderId: string, providerPaymentId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      plan: true,
      payment: true,
    },
  })

  if (!order) return { ok: false as const, error: 'Заказ не найден' }
  if (order.status === 'PAID') return { ok: true as const, alreadyPaid: true }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    })

    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId: providerPaymentId || order.payment.providerPaymentId,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: order.payment.id,
          eventType: 'payment.succeeded',
          payload: { providerPaymentId: providerPaymentId || null },
        },
      })
    }
  })

  const redemption = await prisma.couponRedemption.findFirst({
    where: { orderId: order.id },
    include: { coupon: true },
  })
  const bonusDays = redemption?.coupon.bonusDays ?? 0
  await activatePaidSubscription(
    order.userId,
    order.planId,
    order.plan.durationDays + bonusDays,
  )

  try {
    await tryFulfillReferralForUser(order.userId)
  } catch {
    // non-fatal — payment already succeeded
  }

  return { ok: true as const, alreadyPaid: false }
}

const checkoutSchema = z.object({
  planId: z.string().uuid().optional(),
  planSlug: z.string().min(1).max(64).optional(),
  couponCode: z.string().trim().min(3).max(32).optional(),
})

const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/plans', async () => {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        price: { gt: 0 },
      },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        durationDays: true,
        deviceLimit: true,
      },
    })

    return {
      provider: isYooKassaConfigured() ? 'yookassa' : 'mock',
      plans: plans.map((plan) => ({
        ...plan,
        price: plan.price.toString(),
      })),
    }
  })

  app.post('/checkout', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return

    if ((user as { impersonatedBy?: string | null }).impersonatedBy) {
      return reply.code(403).send({ error: 'Оплата недоступна в режиме просмотра саппорта' })
    }

    const parsed = checkoutSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Укажите тариф' })
    }

    const plan = await prisma.plan.findFirst({
      where: {
        isActive: true,
        price: { gt: 0 },
        ...(parsed.data.planId
          ? { id: parsed.data.planId }
          : { slug: parsed.data.planSlug || 'premium-month' }),
      },
    })

    if (!plan) {
      return reply.code(404).send({ error: 'Тариф Premium не найден' })
    }

    let chargeAmount = Number(plan.price)
    let couponId: string | null = null
    let bonusDays = 0

    if (parsed.data.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: parsed.data.couponCode.toUpperCase() },
      })
      const now = new Date()
      if (!coupon || !coupon.isActive) {
        return reply.code(400).send({ error: 'Купон недействителен' })
      }
      if (coupon.startsAt && coupon.startsAt > now) {
        return reply.code(400).send({ error: 'Купон ещё не активен' })
      }
      if (coupon.endsAt && coupon.endsAt < now) {
        return reply.code(400).send({ error: 'Срок купона истёк' })
      }
      if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
        return reply.code(400).send({ error: 'Лимит использований купона исчерпан' })
      }
      const already = await prisma.couponRedemption.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId: user.id } },
      })
      if (already) {
        return reply.code(400).send({ error: 'Вы уже использовали этот купон' })
      }
      if (coupon.percentOff) {
        chargeAmount = Math.max(0, chargeAmount * (1 - coupon.percentOff / 100))
      }
      if (coupon.amountOff) {
        chargeAmount = Math.max(0, chargeAmount - Number(coupon.amountOff))
      }
      bonusDays = coupon.bonusDays || 0
      couponId = coupon.id
    }

    const amount = chargeAmount.toFixed(2)
    const webAppUrl = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'PENDING',
        amount: chargeAmount,
        currency: plan.currency,
        payment: {
          create: {
            provider: isYooKassaConfigured() ? 'yookassa' : 'mock',
            status: 'PENDING',
            amount: chargeAmount,
            currency: plan.currency,
          },
        },
      },
      include: { payment: true },
    })

    if (couponId) {
      await prisma.couponRedemption.create({
        data: { couponId, userId: user.id, orderId: order.id },
      })
      await prisma.coupon.update({
        where: { id: couponId },
        data: { redeemedCount: { increment: 1 } },
      })
    }

    try {
      const payment = await createYooPayment({
        amount,
        currency: plan.currency,
        description: `SMOLIX ${plan.name}`,
        returnUrl: `${webAppUrl}/app/subscription?paid=1`,
        metadata: {
          orderId: order.id,
          userId: user.id,
          planId: plan.id,
        },
      })

      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            providerPaymentId: payment.id,
            provider: payment.mock ? 'mock' : 'yookassa',
          },
        })
      }

      return {
        orderId: order.id,
        confirmationUrl: payment.confirmationUrl,
        mock: payment.mock,
        amount,
        currency: plan.currency,
        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
        },
      }
    } catch (error) {
      request.log.error(error)
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      })
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: { status: 'FAILED' },
        })
      }
      return reply.code(502).send({ error: 'Не удалось создать платёж' })
    }
  })

  app.post('/mock-confirm', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({ error: 'Mock-оплата недоступна' })
    }

    const user = await requireUser(request, reply)
    if (!user) return

    const body = z.object({ orderId: z.string().uuid() }).safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Укажите orderId' })
    }

    const order = await prisma.order.findFirst({
      where: { id: body.data.orderId, userId: user.id },
      include: { payment: true },
    })

    if (!order) {
      return reply.code(404).send({ error: 'Заказ не найден' })
    }

    if (order.payment?.provider !== 'mock') {
      return reply.code(400).send({ error: 'Это не mock-заказ' })
    }

    const result = await markOrderPaid(order.id, order.payment.providerPaymentId)
    if (!result.ok) {
      return reply.code(400).send({ error: result.error })
    }

    return {
      message: result.alreadyPaid ? 'Подписка уже активна' : 'Premium активирован',
      alreadyPaid: result.alreadyPaid,
    }
  })

  app.post('/webhook/yookassa', {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    if (!verifyYooWebhookBasicAuth(request.headers.authorization)) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const event = request.body as {
      event?: string
      object?: {
        id?: string
        status?: string
        metadata?: { orderId?: string }
      }
    }

    const paymentId = event.object?.id
    const orderId = event.object?.metadata?.orderId
    const status = event.object?.status

    if (paymentId) {
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: paymentId },
      })
      if (payment) {
        await prisma.paymentEvent.create({
          data: {
            paymentId: payment.id,
            eventType: event.event || `status:${status || 'unknown'}`,
            payload: event as object,
          },
        })
      }
    }

    if (event.event === 'payment.succeeded' && status === 'succeeded' && orderId) {
      await markOrderPaid(orderId, paymentId)
    }

    return { received: true }
  })
}

export default billingRoutes
