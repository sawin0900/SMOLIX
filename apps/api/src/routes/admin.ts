import type { FastifyPluginAsync } from 'fastify'
import { getSessionUser } from '../lib/session.js'
import { prisma } from '../lib/prisma.js'
import { brandedNoticeEmail, getMailStats, premiumLaunchEmail, sendMail } from '../lib/mailer.js'
import { getRemnawaveOverview } from '../lib/remnawave.js'
import {
  listExtensionNodes,
  syncExtensionNodesFromRemnawave,
} from '../lib/extension-nodes.js'
import { ensureRemnawaveProvisioned } from '../lib/vpn-provision.js'
import { extendActiveSubscription } from '../lib/subscription.js'
import { runBlockMonitor } from '../lib/block-monitor.js'
import { ensureSupportCode, writeAdminAudit } from '../lib/audit.js'
import { isDestructiveAllowed, requireAdminOnly, requireStaff } from '../lib/admin-auth.js'
import { createImpersonationToken } from '../lib/impersonation.js'
import {
  getBackupStatus,
  getOpsHealth,
  startBackupRun,
} from '../lib/ops-health.js'
import {
  getPublicStatusOverride,
  setPublicStatusOverride,
} from '../lib/system-settings.js'
import { z } from 'zod'

async function requireAdmin(request: any, reply: any) {
  return requireStaff(request, reply)
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  // Tighter default for all admin endpoints (overrides are still allowed per-route)
  app.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.config) routeOptions.config = {}
    const cfg = routeOptions.config as { rateLimit?: { max: number; timeWindow: string } }
    if (!cfg.rateLimit) {
      cfg.rateLimit = { max: 60, timeWindow: '1 minute' }
    }
  })

  app.get('/stats', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const d7 = new Date(now.getTime() - 7 * 86400000)
    const d30 = new Date(now.getTime() - 30 * 86400000)

    const [
      users,
      activeSubscriptions,
      premiumActive,
      servers,
      sessions,
      waitlistPending,
      paidOrders,
      trialActive,
      openAlerts,
      ordersCreated,
      ordersPending,
      ordersCancelled,
      ordersRefunded,
      revenueAll,
      revenueToday,
      revenue7d,
      revenue30d,
      paidTodayCount,
      paid7dCount,
      paid30dCount,
      everTrialUsers,
      paidUserIds,
      recentPaid,
      signupEvents7d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', isTrial: false } }),
      prisma.server.count({ where: { isActive: true } }),
      prisma.extensionSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.waitlistEntry.count({ where: { notifiedAt: null } }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', isTrial: true } }),
      prisma.adminAlert.count({ where: { status: 'OPEN' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.count({ where: { status: 'REFUNDED' } }),
      prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { status: 'PAID', createdAt: { gte: startOfDay } }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { status: 'PAID', createdAt: { gte: d7 } }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { status: 'PAID', createdAt: { gte: d30 } }, _sum: { amount: true } }),
      prisma.order.count({ where: { status: 'PAID', createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { status: 'PAID', createdAt: { gte: d7 } } }),
      prisma.order.count({ where: { status: 'PAID', createdAt: { gte: d30 } } }),
      prisma.subscription.findMany({
        where: { isTrial: true },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.order.findMany({
        where: { status: 'PAID' },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.order.findMany({
        where: { status: 'PAID', createdAt: { gte: d30 } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.signupEvent.groupBy({
        by: ['kind'],
        where: { createdAt: { gte: d7 } },
        _count: { _all: true },
      }),
    ])

    const trialUserSet = new Set(everTrialUsers.map((item) => item.userId))
    const paidFromTrial = paidUserIds.filter((item) => trialUserSet.has(item.userId)).length
    const trialUsers = trialUserSet.size
    const trialToPaidRate = trialUsers > 0 ? Math.round((paidFromTrial / trialUsers) * 1000) / 10 : 0

    const money = (value: { toString(): string } | null | undefined) =>
      value == null ? '0' : value.toString()

    const avgPaid = paidOrders > 0 && revenueAll._sum.amount
      ? (Number(revenueAll._sum.amount) / paidOrders).toFixed(2)
      : '0'

    const dayMap = new Map<string, { count: number; amount: number }>()
    for (let i = 29; i >= 0; i -= 1) {
      const day = new Date(now.getTime() - i * 86400000)
      const key = day.toISOString().slice(0, 10)
      dayMap.set(key, { count: 0, amount: 0 })
    }
    for (const order of recentPaid) {
      const key = order.createdAt.toISOString().slice(0, 10)
      const bucket = dayMap.get(key)
      if (!bucket) continue
      bucket.count += 1
      bucket.amount += Number(order.amount)
    }
    const revenueByDay = [...dayMap.entries()].map(([date, bucket]) => ({
      date,
      count: bucket.count,
      amount: bucket.amount.toFixed(2),
    }))

    return {
      users,
      activeSubscriptions,
      premiumActive,
      servers,
      sessions,
      waitlistPending,
      paidOrders,
      trialActive,
      openAlerts,
      payments: {
        revenueAll: money(revenueAll._sum.amount),
        revenueToday: money(revenueToday._sum.amount),
        revenue7d: money(revenue7d._sum.amount),
        revenue30d: money(revenue30d._sum.amount),
        paidToday: paidTodayCount,
        paid7d: paid7dCount,
        paid30d: paid30dCount,
        avgCheck: avgPaid,
        currency: 'RUB',
        funnel: {
          created: ordersCreated,
          pending: ordersPending,
          paid: paidOrders,
          cancelled: ordersCancelled,
          refunded: ordersRefunded,
        },
        trialUsers,
        paidFromTrial,
        trialToPaidRate,
        revenueByDay,
      },
      antibot: {
        window: '7d',
        byKind: Object.fromEntries(
          signupEvents7d.map((row) => [row.kind, row._count._all]),
        ),
        registerOk: signupEvents7d.find((row) => row.kind === 'register_ok')?._count._all ?? 0,
        honeypot: signupEvents7d.find((row) => row.kind === 'honeypot')?._count._all ?? 0,
        disposable: signupEvents7d.find((row) => row.kind === 'disposable')?._count._all ?? 0,
      },
    }
  })

  app.post('/users/:userId/impersonate', async (request, reply) => {
    const actor = await requireStaff(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ userId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите userId' })
    }
    if (params.data.userId === actor.id) {
      return reply.code(400).send({ error: 'Нельзя открыть свой аккаунт через impersonation' })
    }

    const target = await prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true, email: true, status: true, role: true },
    })
    if (!target) return reply.code(404).send({ error: 'Пользователь не найден' })
    if (target.status !== 'ACTIVE') {
      return reply.code(400).send({ error: 'Пользователь не активен' })
    }
    if (target.role === 'ADMIN' && actor.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Нельзя открыть кабинет ADMIN' })
    }

    const { token, expiresAt } = await createImpersonationToken(actor.id, target.id)
    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.impersonate',
      targetType: 'user',
      targetId: target.id,
    })

    const webAppUrl = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    return {
      message: 'Ссылка для просмотра кабинета создана (10 минут)',
      url: `${webAppUrl}/auth?mode=impersonate&token=${token}`,
      expiresAt,
    }
  })

  app.get('/users', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({
      q: z.string().trim().max(120).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }).safeParse(request.query)

    const q = query.success ? query.data.q?.trim() : undefined
    const page = query.success ? query.data.page : 1
    const limit = query.success ? query.data.limit : 30
    const skip = (page - 1) * limit
    const uuidLike = Boolean(q && /^[0-9a-f-]{36}$/i.test(q))
    const supportLike = Boolean(q && /^SMX[A-Z0-9]{6,12}$/i.test(q))

    const where = q
      ? {
          OR: [
            ...(uuidLike ? [{ id: q }] : []),
            ...(supportLike ? [{ supportCode: q.toUpperCase() }] : []),
            { email: { contains: q, mode: 'insensitive' as const } },
            { supportCode: { contains: q.toUpperCase(), mode: 'insensitive' as const } },
            { vpnAccount: { remnawaveUsername: { contains: q, mode: 'insensitive' as const } } },
            { vpnAccount: { subscriptionShortUuid: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : undefined

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          supportCode: true,
          signupIpHash: true,
          adminNote: true,
          createdAt: true,
          vpnAccount: {
            select: {
              isProvisioned: true,
              proxyProvisioned: true,
              remnawaveUsername: true,
              subscriptionUrl: true,
              subscriptionShortUuid: true,
            },
          },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              isTrial: true,
              expiresAt: true,
              plan: { select: { name: true, deviceLimit: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return {
      users,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  })

  app.patch('/users/:userId', async (request, reply) => {
    const actor = await requireAdmin(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ userId: z.string().uuid() }).safeParse(request.params)
    const body = z.object({
      status: z.enum(['ACTIVE', 'BLOCKED', 'PENDING']).optional(),
      adminNote: z.string().trim().max(1000).nullable().optional(),
    }).safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'Укажите userId и поля для обновления' })
    }

    if (body.data.status && !isDestructiveAllowed(actor.role) && body.data.status === 'BLOCKED') {
      return reply.code(403).send({ error: 'Блокировка только для ADMIN' })
    }

    if (params.data.userId === actor.id && body.data.status === 'BLOCKED') {
      return reply.code(400).send({ error: 'Нельзя заблокировать себя' })
    }

    const data: { status?: 'ACTIVE' | 'BLOCKED' | 'PENDING'; adminNote?: string | null } = {}
    if (body.data.status) data.status = body.data.status
    if (body.data.adminNote !== undefined) data.adminNote = body.data.adminNote

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'Нечего обновлять' })
    }

    const updated = await prisma.user.update({
      where: { id: params.data.userId },
      data,
      select: { id: true, email: true, status: true, role: true, adminNote: true },
    })

    if (body.data.status === 'BLOCKED') {
      await prisma.$transaction([
        prisma.session.deleteMany({ where: { userId: updated.id } }),
        prisma.extensionSession.updateMany({
          where: { userId: updated.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ])
    }

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: body.data.status ? `user.status.${body.data.status}` : 'user.note',
      targetType: 'user',
      targetId: updated.id,
      meta: data,
    })

    return { message: `Обновлён ${updated.email}`, user: updated }
  })

  app.post('/users/:userId/extend', async (request, reply) => {
    const actor = await requireAdmin(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ userId: z.string().uuid() }).safeParse(request.params)
    const body = z.object({
      days: z.number().int().min(1).max(365).default(7),
    }).safeParse(request.body ?? {})

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'Укажите userId и days (1–365)' })
    }

    try {
      const subscription = await extendActiveSubscription(params.data.userId, body.data.days)
      await writeAdminAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'user.extend',
        targetType: 'user',
        targetId: params.data.userId,
        meta: { days: body.data.days },
      })
      return {
        message: `+${body.data.days} дн. для пользователя`,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
          isTrial: subscription.isTrial,
        },
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Не удалось продлить подписку',
      })
    }
  })

  app.post('/users/:userId/cancel-subscription', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ userId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите userId' })
    }

    const result = await prisma.subscription.updateMany({
      where: { userId: params.data.userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.cancel_subscription',
      targetType: 'user',
      targetId: params.data.userId,
      meta: { cancelled: result.count },
    })

    return {
      message: result.count > 0 ? 'Активные подписки отменены' : 'Активных подписок не было',
      cancelled: result.count,
    }
  })

  app.get('/subscriptions', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const subscriptions = await prisma.subscription.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, status: true } },
        plan: true,
      },
    })

    return {
      subscriptions: subscriptions.map((item) => ({
        ...item,
        plan: {
          ...item.plan,
          price: item.plan.price.toString(),
          trafficLimit: item.plan.trafficLimit?.toString() ?? null,
        },
      })),
    }
  })

  app.get('/orders', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({
      status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'ALL']).optional(),
      q: z.string().trim().max(120).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(40),
    }).safeParse(request.query)

    const status = query.success ? query.data.status : undefined
    const q = query.success ? query.data.q?.trim() : undefined
    const from = query.success && query.data.from ? new Date(query.data.from) : undefined
    const to = query.success && query.data.to ? new Date(query.data.to) : undefined
    const page = query.success ? query.data.page : 1
    const limit = query.success ? query.data.limit : 40
    const skip = (page - 1) * limit
    const uuidLike = Boolean(q && /^[0-9a-f-]{36}$/i.test(q))

    const where = {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
              ...(uuidLike ? [{ id: q }, { payment: { providerPaymentId: q } }] : []),
              { payment: { providerPaymentId: { contains: q, mode: 'insensitive' as const } } },
              { payment: { provider: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        where,
        include: {
          user: { select: { id: true, email: true } },
          plan: { select: { id: true, name: true, slug: true } },
          payment: {
            select: {
              id: true,
              status: true,
              provider: true,
              providerPaymentId: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        amount: order.amount.toString(),
        currency: order.currency,
        createdAt: order.createdAt,
        user: order.user,
        plan: order.plan,
        payment: order.payment,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  })

  app.get('/users/:userId', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const params = z.object({ userId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Некорректный userId' })
    }

    await ensureSupportCode(params.data.userId)

    const user = await prisma.user.findUnique({
      where: { id: params.data.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        supportCode: true,
        signupIpHash: true,
        adminNote: true,
        referredByUserId: true,
        createdAt: true,
        vpnAccount: {
          select: {
            isProvisioned: true,
            proxyProvisioned: true,
            remnawaveUsername: true,
            remnawaveUserId: true,
            subscriptionUrl: true,
            subscriptionShortUuid: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { plan: { select: { id: true, name: true, slug: true, deviceLimit: true, price: true, currency: true } } },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            plan: { select: { name: true, slug: true } },
            payment: { select: { status: true, provider: true, providerPaymentId: true, createdAt: true } },
          },
        },
        extensionSessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { lastUsedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            deviceName: true,
            deviceId: true,
            createdAt: true,
            expiresAt: true,
            lastUsedAt: true,
          },
        },
        referralRewardsReceived: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            daysGranted: true,
            rejectReason: true,
            grantedAt: true,
            createdAt: true,
            referrer: { select: { id: true, email: true } },
          },
        },
        referralRewardsGiven: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            daysGranted: true,
            rejectReason: true,
            grantedAt: true,
            createdAt: true,
            referred: { select: { id: true, email: true, signupIpHash: true } },
          },
        },
      },
    })

    if (!user) {
      return reply.code(404).send({ error: 'Пользователь не найден' })
    }

    return {
      user: {
        ...user,
        subscriptions: user.subscriptions.map((sub) => ({
          ...sub,
          plan: {
            ...sub.plan,
            price: sub.plan.price.toString(),
          },
        })),
        orders: user.orders.map((order) => ({
          ...order,
          amount: order.amount.toString(),
        })),
      },
    }
  })

  app.get('/servers', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const servers = await prisma.server.findMany({
      orderBy: { name: 'asc' },
    })

    return { servers }
  })

  app.patch('/servers/:serverId', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const params = z.object({ serverId: z.string().uuid() }).safeParse(request.params)
    const body = z.object({
      isActive: z.boolean(),
    }).safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'Укажите serverId и isActive' })
    }

    const server = await prisma.server.update({
      where: { id: params.data.serverId },
      data: { isActive: body.data.isActive },
    })

    return { message: `${server.name}: ${server.isActive ? 'ACTIVE' : 'OFF'}`, server }
  })

  app.get('/waitlist', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({
      pending: z.enum(['0', '1']).optional(),
    }).safeParse(request.query)

    const pendingOnly = query.success && query.data.pending === '1'

    const [entries, count, pendingCount] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where: pendingOnly ? { notifiedAt: null } : undefined,
        take: 200,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          source: true,
          notifiedAt: true,
          createdAt: true,
        },
      }),
      prisma.waitlistEntry.count(),
      prisma.waitlistEntry.count({ where: { notifiedAt: null } }),
    ])

    return {
      count,
      pendingCount,
      entries,
    }
  })

  app.post('/waitlist/notify', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const entries = await prisma.waitlistEntry.findMany({
      where: { notifiedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })

    const siteUrl = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    const mail = premiumLaunchEmail(siteUrl)
    let sent = 0

    for (const entry of entries) {
      await sendMail({ to: entry.email, ...mail })
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { notifiedAt: new Date() },
      })
      sent += 1
    }

    return {
      message: sent > 0 ? `Отправлено ${sent} писем` : 'Нет новых адресов для уведомления',
      sent,
    }
  })

  app.post('/mail/broadcast', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const body = z
      .object({
        subject: z.string().trim().min(3).max(160),
        title: z.string().trim().min(3).max(160),
        lead: z.string().trim().min(10).max(4000),
        ctaLabel: z.string().trim().min(2).max(60).optional(),
        ctaPath: z.string().trim().min(1).max(120).optional(),
        audience: z.enum(['all', 'premium', 'trial', 'me']).default('me'),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({ error: 'Проверьте тему, заголовок и текст письма' })
    }

    const siteUrl = (process.env.WEB_APP_URL || 'https://jetsale.online').replace(/\/+$/, '')
    const mail = brandedNoticeEmail({
      siteUrl,
      subject: body.data.subject,
      title: body.data.title,
      lead: body.data.lead,
      ctaLabel: body.data.ctaLabel,
      ctaPath: body.data.ctaPath,
    })

    let recipients: Array<{ email: string }> = []
    if (body.data.audience === 'me') {
      recipients = [{ email: actor.email }]
    } else if (body.data.audience === 'all') {
      recipients = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { email: true },
        take: 500,
      })
    } else if (body.data.audience === 'premium') {
      const rows = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', isTrial: false },
        select: { user: { select: { email: true, status: true } } },
        take: 500,
      })
      recipients = rows
        .filter((row) => row.user.status === 'ACTIVE')
        .map((row) => ({ email: row.user.email }))
    } else {
      const rows = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', isTrial: true },
        select: { user: { select: { email: true, status: true } } },
        take: 500,
      })
      recipients = rows
        .filter((row) => row.user.status === 'ACTIVE')
        .map((row) => ({ email: row.user.email }))
    }

    const unique = [...new Map(recipients.map((item) => [item.email.toLowerCase(), item])).values()]
    let sent = 0
    for (const recipient of unique) {
      await sendMail({ to: recipient.email, ...mail })
      sent += 1
    }

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'mail.broadcast',
      targetType: 'mail',
      targetId: body.data.audience,
    })

    return {
      message: `Отправлено ${sent} писем (${body.data.audience})`,
      sent,
      audience: body.data.audience,
    }
  })

  app.get('/remnawave', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const overview = await getRemnawaveOverview()
    try {
      await syncExtensionNodesFromRemnawave()
    } catch {
      /* overview still useful without sync */
    }
    const extensionNodes = await listExtensionNodes()
    const byUuid = new Map(extensionNodes.map((n) => [n.remnawaveNodeUuid, n]))

    return {
      ...overview,
      nodes: overview.nodes.map((node) => {
        const ext = byUuid.get(node.uuid)
        return {
          ...node,
          extensionEnabled: Boolean(ext?.isEnabled),
          extensionHostname: ext?.hostname ?? null,
          extensionPort: ext?.port ?? 8443,
          extensionNodeId: ext?.id ?? null,
        }
      }),
      extensionNodes,
    }
  })

  app.post('/remnawave/sync-user', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const parsed = z.object({
      userId: z.string().uuid(),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Укажите userId' })
    }

    try {
      const result = await ensureRemnawaveProvisioned(parsed.data.userId)
      return {
        message: result.skipped ? 'Remnawave пропущен (не настроен)' : 'Пользователь синхронизирован с Remnawave',
        result,
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(502).send({
        error: error instanceof Error ? error.message : 'Не удалось синхронизировать Remnawave',
      })
    }
  })

  app.post('/extension-nodes/sync', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    try {
      const result = await syncExtensionNodesFromRemnawave()
      const extensionNodes = await listExtensionNodes()
      return {
        message: `Синхронизировано: +${result.created}, обновлено ${result.updated}, всего ${result.total}`,
        ...result,
        extensionNodes,
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(502).send({
        error: error instanceof Error ? error.message : 'Не удалось синхронизировать ноды',
      })
    }
  })

  app.get('/extension-nodes', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    try {
      await syncExtensionNodesFromRemnawave()
    } catch {
      /* keep DB */
    }

    return { extensionNodes: await listExtensionNodes() }
  })

  app.patch('/extension-nodes/:nodeUuid', async (request, reply) => {
    const actor = await requireAdmin(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ nodeUuid: z.string().uuid() }).safeParse(request.params)
    const body = z.object({
      isEnabled: z.boolean().optional(),
      hostname: z.string().trim().min(1).max(253).nullable().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      name: z.string().trim().min(1).max(120).optional(),
    }).safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'Укажите nodeUuid и поля для обновления' })
    }

    const existing = await prisma.extensionNode.findUnique({
      where: { remnawaveNodeUuid: params.data.nodeUuid },
    })

    if (!existing) {
      try {
        await syncExtensionNodesFromRemnawave()
      } catch {
        /* ignore */
      }
    }

    const row = await prisma.extensionNode.findUnique({
      where: { remnawaveNodeUuid: params.data.nodeUuid },
    })

    if (!row) {
      return reply.code(404).send({ error: 'Нода не найдена. Сначала Sync нод из Remnawave.' })
    }

    const nextEnabled = body.data.isEnabled ?? row.isEnabled
    const nextHostname =
      body.data.hostname === undefined
        ? row.hostname
        : body.data.hostname

    if (nextEnabled && !nextHostname?.trim()) {
      return reply.code(400).send({
        error: 'Чтобы включить локацию в расширении, укажите hostname HTTPS-прокси (например rassiya.jetsale.online)',
      })
    }

    const node = await prisma.extensionNode.update({
      where: { id: row.id },
      data: {
        ...(body.data.isEnabled !== undefined ? { isEnabled: body.data.isEnabled } : {}),
        ...(body.data.hostname !== undefined ? { hostname: body.data.hostname } : {}),
        ...(body.data.port !== undefined ? { port: body.data.port } : {}),
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'extension_node.update',
      targetType: 'extension_node',
      targetId: node.id,
      meta: {
        remnawaveNodeUuid: node.remnawaveNodeUuid,
        isEnabled: node.isEnabled,
        hostname: node.hostname,
        port: node.port,
      },
    })

    return {
      message: `${node.name}: ${node.isEnabled ? 'в расширении ON' : 'в расширении OFF'}`,
      node,
    }
  })

  app.post('/sessions/:sessionId/revoke', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const params = z.object({ sessionId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите sessionId' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { id: params.data.sessionId },
    })

    if (!session || session.revokedAt) {
      return reply.code(404).send({ error: 'Сессия не найдена' })
    }

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    })

    return { message: 'Сессия отозвана', revoked: 1 }
  })

  app.post('/users/:userId/sessions/revoke-all', async (request, reply) => {
    const actor = await requireAdmin(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ userId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите userId' })
    }

    const result = await prisma.extensionSession.updateMany({
      where: {
        userId: params.data.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'sessions.revoke_all',
      targetType: 'user',
      targetId: params.data.userId,
      meta: { revoked: result.count },
    })

    return {
      message: result.count
        ? `Отключено сессий: ${result.count}`
        : 'Активных сессий не было',
      revoked: result.count,
    }
  })

  app.get('/alerts', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({
      status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL']).optional(),
    }).safeParse(request.query)

    const status = query.success ? query.data.status || 'OPEN' : 'OPEN'

    const [alerts, openCount, probes] = await Promise.all([
      prisma.adminAlert.findMany({
        where: status === 'ALL' ? undefined : { status },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.adminAlert.count({ where: { status: 'OPEN' } }),
      prisma.probeTarget.findMany({ orderBy: { key: 'asc' } }),
    ])

    return { openCount, alerts, probes }
  })

  app.post('/alerts/run-probe', {
    config: { rateLimit: { max: 6, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    try {
      const result = await runBlockMonitor()
      return {
        message: `Проверка завершена · новых алертов: ${result.alertsCreated}`,
        ...result,
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(502).send({
        error: error instanceof Error ? error.message : 'Probe failed',
      })
    }
  })

  app.post('/alerts/:alertId/ack', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const params = z.object({ alertId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите alertId' })
    }

    const alert = await prisma.adminAlert.update({
      where: { id: params.data.alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    })

    return { message: 'Алерт подтверждён', alert }
  })

  app.post('/alerts/:alertId/resolve', async (request, reply) => {
    const actor = await requireAdmin(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ alertId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите alertId' })
    }

    const alert = await prisma.adminAlert.update({
      where: { id: params.data.alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'alert.resolve',
      targetType: 'alert',
      targetId: alert.id,
    })

    return { message: 'Алерт закрыт', alert }
  })

  app.get('/search', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({ q: z.string().trim().min(2).max(120) }).safeParse(request.query)
    if (!query.success) {
      return reply.code(400).send({ error: 'Укажите q' })
    }

    const q = query.data.q
    const uuidLike = /^[0-9a-f-]{36}$/i.test(q)

    const [users, orders, vpn] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { supportCode: { contains: q.toUpperCase(), mode: 'insensitive' } },
            ...(uuidLike ? [{ id: q }] : []),
          ],
        },
        take: 10,
        select: { id: true, email: true, supportCode: true, status: true },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            ...(uuidLike ? [{ id: q }] : []),
            { payment: { providerPaymentId: { contains: q, mode: 'insensitive' } } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 10,
        select: {
          id: true,
          status: true,
          amount: true,
          user: { select: { id: true, email: true } },
        },
      }),
      prisma.vpnAccount.findMany({
        where: {
          OR: [
            { remnawaveUsername: { contains: q, mode: 'insensitive' } },
            { subscriptionShortUuid: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          userId: true,
          remnawaveUsername: true,
          subscriptionShortUuid: true,
          user: { select: { email: true } },
        },
      }),
    ])

    return {
      users,
      orders: orders.map((o) => ({ ...o, amount: o.amount.toString() })),
      vpnAccounts: vpn,
    }
  })

  app.get('/referrals', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const [pending, granted, rejected, top] = await Promise.all([
      prisma.referralReward.count({ where: { status: 'PENDING' } }),
      prisma.referralReward.count({ where: { status: 'GRANTED' } }),
      prisma.referralReward.count({ where: { status: 'REJECTED' } }),
      prisma.referralReward.groupBy({
        by: ['referrerUserId'],
        where: { status: 'GRANTED' },
        _count: { _all: true },
        _sum: { daysGranted: true },
        orderBy: { _count: { referrerUserId: 'desc' } },
        take: 20,
      } as any),
    ])

    const referrerIds = top.map((item) => item.referrerUserId)
    const referrers = await prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, email: true, supportCode: true },
    })
    const byId = new Map(referrers.map((item) => [item.id, item]))

    const recent = await prisma.referralReward.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        status: true,
        daysGranted: true,
        rejectReason: true,
        createdAt: true,
        grantedAt: true,
        referrer: { select: { id: true, email: true } },
        referred: { select: { id: true, email: true, signupIpHash: true } },
      },
    })

    return {
      summary: { pending, granted, rejected },
      topReferrers: top.map((item: any) => ({
        userId: item.referrerUserId,
        email: byId.get(item.referrerUserId)?.email ?? '—',
        supportCode: byId.get(item.referrerUserId)?.supportCode ?? null,
        grantedCount: item._count?._all ?? 0,
        daysGranted: item._sum?.daysGranted ?? 0,
      })),
      recent,
    }
  })

  app.get('/audit', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(40),
    }).safeParse(request.query)
    const page = query.success ? query.data.page : 1
    const limit = query.success ? query.data.limit : 40

    const [items, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count(),
    ])

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  })

  app.get('/retention', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 86400000)
    const d30 = new Date(now.getTime() - 30 * 86400000)

    const notified = await prisma.waitlistEntry.findMany({
      where: { notifiedAt: { not: null } },
      select: { email: true },
      take: 5000,
    })
    const notifiedEmails = notified.map((item) => item.email.toLowerCase())

    const [
      registered7,
      registered30,
      extensionLogin7,
      paid7,
      paid30,
      trialActive,
      waitlistPending,
      waitlistNotified,
      waitlistConverted,
      signupEvents24h,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: d7 } } }),
      prisma.user.count({ where: { createdAt: { gte: d30 } } }),
      prisma.extensionSession.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: d7 } },
      }).then((rows) => rows.length),
      prisma.order.count({ where: { status: 'PAID', createdAt: { gte: d7 } } }),
      prisma.order.count({ where: { status: 'PAID', createdAt: { gte: d30 } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', isTrial: true } }),
      prisma.waitlistEntry.count({ where: { notifiedAt: null } }),
      prisma.waitlistEntry.count({ where: { notifiedAt: { not: null } } }),
      notifiedEmails.length
        ? prisma.user.count({ where: { email: { in: notifiedEmails } } })
        : Promise.resolve(0),
      prisma.signupEvent.groupBy({
        by: ['kind'],
        where: { createdAt: { gte: new Date(now.getTime() - 86400000) } },
        _count: { _all: true },
      }),
    ])

    return {
      registered7,
      registered30,
      extensionLogin7,
      paid7,
      paid30,
      trialActive,
      waitlist: {
        pending: waitlistPending,
        notified: waitlistNotified,
        convertedApprox: waitlistConverted,
      },
      signupEvents24h: Object.fromEntries(signupEvents24h.map((row) => [row.kind, row._count._all])),
      featureFlags: {
        chromeStoreLive: Boolean(process.env.VITE_CHROME_STORE_URL || process.env.CHROME_STORE_URL),
        referralEnabled: process.env.REFERRAL_ENABLED !== '0',
        billingProvider: process.env.YOOKASSA_SHOP_ID ? 'yookassa' : 'mock',
        turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY),
        proxyManager: Boolean(process.env.PROXY_MANAGER_URL?.trim() && process.env.PROXY_MANAGER_TOKEN?.trim()),
        proxyCredentialsKey: Boolean(process.env.PROXY_CREDENTIALS_KEY?.trim()),
        smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      },
    }
  })

  app.get('/ops-health', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const [health, statusOverride] = await Promise.all([
      getOpsHealth(),
      getPublicStatusOverride(),
    ])
    return { ...health, statusOverride }
  })

  app.get('/public-status', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    return { override: await getPublicStatusOverride() }
  })

  app.patch('/public-status', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const body = z.object({
      mode: z.enum(['auto', 'operational', 'degraded', 'major_outage']),
      message: z.string().trim().max(500).nullable().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({ error: 'Укажите mode: auto | operational | degraded | major_outage' })
    }

    const override = await setPublicStatusOverride(
      {
        mode: body.data.mode,
        message: body.data.message ?? null,
      },
      actor.id,
    )

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'public_status.update',
      targetType: 'system',
      targetId: 'public_status',
      meta: body.data,
    })

    return {
      message: body.data.mode === 'auto'
        ? 'Статус сайта: авто'
        : `Баннер статуса: ${body.data.mode}`,
      override: await getPublicStatusOverride(),
      updatedAt: override.updatedAt,
    }
  })

  app.get('/mail/stats', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    return { mail: getMailStats() }
  })

  app.post('/mail/test', async (request, reply) => {
    const actor = await requireAdmin(request, reply)
    if (reply.sent || !actor) return

    const siteUrl = (process.env.WEB_APP_URL || 'https://jetsale.online').replace(/\/+$/, '')
    const mail = brandedNoticeEmail({
      subject: 'jetsale.online — тест SMTP',
      title: 'Тестовое письмо',
      lead: 'Если вы видите это письмо — SMTP настроен и доставка работает.',
      ctaLabel: 'Открыть кабинет',
      ctaPath: '/app',
      siteUrl,
    })

    try {
      const result = await sendMail({ to: actor.email, ...mail })
      await writeAdminAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'mail.test',
        targetType: 'mail',
        targetId: actor.email,
        meta: { mode: result.mode, delivered: result.delivered },
      })
      return {
        message: result.delivered
          ? `Тест отправлен на ${actor.email}`
          : `SMTP не настроен — письмо только в лог API (to ${actor.email})`,
        result,
        mail: getMailStats(),
      }
    } catch (err) {
      return reply.code(502).send({
        error: err instanceof Error ? err.message : 'Ошибка SMTP',
        mail: getMailStats(),
      })
    }
  })

  app.get('/backup', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    return { backup: await getBackupStatus() }
  })

  app.post('/backup/run', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const result = await startBackupRun()
    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'backup.run',
      targetType: 'system',
      targetId: 'backup',
      meta: result,
    })

    if (!result.started) {
      return reply.code(400).send({ error: result.message, backup: await getBackupStatus() })
    }

    return { message: result.message, backup: await getBackupStatus() }
  })

  app.get('/sessions', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(40),
    }).safeParse(request.query)
    const page = query.success ? query.data.page : 1
    const limit = query.success ? query.data.limit : 40

    const where = {
      revokedAt: null,
      expiresAt: { gt: new Date() },
    }

    const [sessions, total] = await Promise.all([
      prisma.extensionSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastUsedAt: 'desc' },
        select: {
          id: true,
          deviceName: true,
          deviceId: true,
          createdAt: true,
          expiresAt: true,
          lastUsedAt: true,
          user: { select: { id: true, email: true, status: true } },
        },
      }),
      prisma.extensionSession.count({ where }),
    ])

    return { sessions, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  })

  app.post('/orders/:orderId/mark-paid', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ orderId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите orderId' })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.data.orderId },
      include: { plan: true, payment: true },
    })
    if (!order) return reply.code(404).send({ error: 'Заказ не найден' })
    if (order.status === 'PAID') return { message: 'Уже оплачен', orderId: order.id }

    const { activatePaidSubscription } = await import('../lib/subscription.js')

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: 'SUCCEEDED', provider: order.payment.provider || 'manual' },
        })
      }
    })
    await activatePaidSubscription(order.userId, order.planId, order.plan.durationDays)

    const { tryFulfillReferralForUser } = await import('../lib/referral.js')
    await tryFulfillReferralForUser(order.userId).catch(() => null)

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'order.mark_paid',
      targetType: 'order',
      targetId: order.id,
    })

    return { message: 'Заказ отмечен оплаченным', orderId: order.id }
  })

  app.post('/orders/:orderId/refund', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ orderId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Укажите orderId' })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.data.orderId },
      include: { payment: true },
    })
    if (!order) return reply.code(404).send({ error: 'Заказ не найден' })

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } })
      if (order.payment) {
        await tx.payment.update({ where: { id: order.payment.id }, data: { status: 'REFUNDED' } })
      }
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'order.refund',
      targetType: 'order',
      targetId: order.id,
    })

    return { message: 'Заказ помечен как refund', orderId: order.id }
  })

  app.get('/plans', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } })
    return {
      plans: plans.map((plan) => ({
        ...plan,
        price: plan.price.toString(),
        trafficLimit: plan.trafficLimit?.toString() ?? null,
      })),
    }
  })

  app.patch('/plans/:planId', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ planId: z.string().uuid() }).safeParse(request.params)
    const body = z.object({
      name: z.string().trim().min(1).max(120).optional(),
      price: z.number().min(0).optional(),
      durationDays: z.number().int().min(1).max(3650).optional(),
      deviceLimit: z.number().int().min(1).max(50).optional(),
      isActive: z.boolean().optional(),
      description: z.string().trim().max(500).nullable().optional(),
    }).safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'Некорректные данные плана' })
    }

    const plan = await prisma.plan.update({
      where: { id: params.data.planId },
      data: {
        ...(body.data.name ? { name: body.data.name } : {}),
        ...(body.data.price != null ? { price: body.data.price } : {}),
        ...(body.data.durationDays != null ? { durationDays: body.data.durationDays } : {}),
        ...(body.data.deviceLimit != null ? { deviceLimit: body.data.deviceLimit } : {}),
        ...(body.data.isActive != null ? { isActive: body.data.isActive } : {}),
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
      },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'plan.update',
      targetType: 'plan',
      targetId: plan.id,
      meta: body.data,
    })

    return {
      message: 'План обновлён',
      plan: { ...plan, price: plan.price.toString(), trafficLimit: plan.trafficLimit?.toString() ?? null },
    }
  })

  app.get('/coupons', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return {
      coupons: coupons.map((c) => ({
        ...c,
        amountOff: c.amountOff?.toString() ?? null,
      })),
    }
  })

  app.post('/coupons', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const body = z.object({
      code: z.string().trim().min(3).max(32),
      percentOff: z.number().int().min(1).max(100).optional(),
      amountOff: z.number().min(0).optional(),
      bonusDays: z.number().int().min(0).max(365).default(0),
      maxRedemptions: z.number().int().min(1).optional(),
      endsAt: z.string().datetime().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({ error: 'Проверьте поля купона' })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: body.data.code.toUpperCase(),
        percentOff: body.data.percentOff,
        amountOff: body.data.amountOff,
        bonusDays: body.data.bonusDays,
        maxRedemptions: body.data.maxRedemptions,
        endsAt: body.data.endsAt ? new Date(body.data.endsAt) : null,
      },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'coupon.create',
      targetType: 'coupon',
      targetId: coupon.id,
    })

    return {
      message: 'Купон создан',
      coupon: { ...coupon, amountOff: coupon.amountOff?.toString() ?? null },
    }
  })

  app.patch('/coupons/:couponId', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ couponId: z.string().uuid() }).safeParse(request.params)
    const body = z.object({
      isActive: z.boolean().optional(),
      percentOff: z.number().int().min(1).max(100).nullable().optional(),
      amountOff: z.number().min(0).nullable().optional(),
      bonusDays: z.number().int().min(0).max(365).optional(),
      maxRedemptions: z.number().int().min(1).nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
    }).safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'Укажите couponId и поля для обновления' })
    }

    if (Object.keys(body.data).length === 0) {
      return reply.code(400).send({ error: 'Нет полей для обновления' })
    }

    const coupon = await prisma.coupon.update({
      where: { id: params.data.couponId },
      data: {
        ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
        ...(body.data.percentOff !== undefined ? { percentOff: body.data.percentOff } : {}),
        ...(body.data.amountOff !== undefined ? { amountOff: body.data.amountOff } : {}),
        ...(body.data.bonusDays !== undefined ? { bonusDays: body.data.bonusDays } : {}),
        ...(body.data.maxRedemptions !== undefined ? { maxRedemptions: body.data.maxRedemptions } : {}),
        ...(body.data.endsAt !== undefined
          ? { endsAt: body.data.endsAt ? new Date(body.data.endsAt) : null }
          : {}),
      },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'coupon.update',
      targetType: 'coupon',
      targetId: coupon.id,
      meta: body.data,
    })

    return {
      message: 'Купон обновлён',
      coupon: { ...coupon, amountOff: coupon.amountOff?.toString() ?? null },
    }
  })
}

export default adminRoutes
