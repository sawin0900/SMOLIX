import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import argon2 from 'argon2'
import { prisma } from './prisma.js'
import { createPendingReferralReward, tryFulfillReferralForUser } from './referral.js'
import { activatePaidSubscription } from './subscription.js'

const hasDb = Boolean(process.env.DATABASE_URL)

test(
  'register → referral PENDING → mark paid → GRANTED',
  { skip: !hasDb },
  async () => {
    process.env.REFERRAL_MIN_AGE_MINUTES = '0'
    const stamp = Date.now()
    const passwordHash = await argon2.hash('TestPass123!')

    const plan =
      (await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })) ||
      (await prisma.plan.create({
        data: {
          name: `Test Plan ${stamp}`,
          slug: `test-plan-${stamp}`,
          price: 199,
          currency: 'RUB',
          durationDays: 30,
          deviceLimit: 3,
          isActive: true,
        },
      }))

    const referrer = await prisma.user.create({
      data: {
        email: `referrer-${stamp}@example.com`,
        passwordHash,
        referralCode: `r${stamp.toString(36).slice(-7)}`,
        status: 'ACTIVE',
      },
    })

    await prisma.subscription.create({
      data: {
        userId: referrer.id,
        planId: plan.id,
        status: 'ACTIVE',
        isTrial: true,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    })

    const referred = await prisma.user.create({
      data: {
        email: `referred-${stamp}@example.com`,
        passwordHash,
        referralCode: `u${stamp.toString(36).slice(-7)}`,
        referredByUserId: referrer.id,
        status: 'ACTIVE',
      },
    })

    const pending = await createPendingReferralReward(referrer.id, referred.id)
    assert.ok(pending)
    assert.equal(pending.status, 'PENDING')

    const beforeGrant = await tryFulfillReferralForUser(referred.id)
    assert.equal(beforeGrant, null, 'should stay PENDING without activity')

    const order = await prisma.order.create({
      data: {
        userId: referred.id,
        planId: plan.id,
        status: 'PENDING',
        amount: plan.price,
        currency: plan.currency,
        payment: {
          create: {
            status: 'PENDING',
            amount: plan.price,
            currency: plan.currency,
            provider: 'test',
            providerPaymentId: `test-${randomUUID()}`,
          },
        },
      },
      include: { payment: true },
    })

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: 'SUCCEEDED', provider: 'test' },
        })
      }
    })

    await activatePaidSubscription(referred.id, plan.id, plan.durationDays)
    const granted = await tryFulfillReferralForUser(referred.id)

    assert.ok(granted)
    assert.equal(granted.status, 'GRANTED')
    assert.ok((granted.daysGranted || 0) > 0)
    assert.ok(granted.grantedAt)

    const reward = await prisma.referralReward.findUnique({
      where: {
        referrerUserId_referredUserId: {
          referrerUserId: referrer.id,
          referredUserId: referred.id,
        },
      },
    })
    assert.equal(reward?.status, 'GRANTED')

    await prisma.referralReward.deleteMany({
      where: { OR: [{ referrerUserId: referrer.id }, { referredUserId: referred.id }] },
    })
    await prisma.payment.deleteMany({ where: { order: { userId: { in: [referrer.id, referred.id] } } } })
    await prisma.order.deleteMany({ where: { userId: { in: [referrer.id, referred.id] } } })
    await prisma.subscription.deleteMany({ where: { userId: { in: [referrer.id, referred.id] } } })
    await prisma.user.deleteMany({ where: { id: { in: [referrer.id, referred.id] } } })
  },
)
