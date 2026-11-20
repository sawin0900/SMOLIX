import { prisma } from './prisma.js'

export async function getActiveSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!subscription) return null

  const now = new Date()

  if (subscription.expiresAt && subscription.expiresAt <= now) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    })

    return null
  }

  if (
    !subscription.startsAt ||
    subscription.startsAt > now ||
    !subscription.expiresAt
  ) {
    return null
  }

  return subscription
}

export async function extendActiveSubscription(userId: string, days: number) {
  const active = await getActiveSubscription(userId)
  const now = new Date()

  if (active?.expiresAt) {
    const base = active.expiresAt > now ? active.expiresAt : now
    const expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
    const updated = await prisma.subscription.update({
      where: { id: active.id },
      data: { expiresAt },
    })
    const { syncRemnawaveExpireAt } = await import('./vpn-provision.js')
    await syncRemnawaveExpireAt(userId, expiresAt).catch((error) => {
      console.error('[remnawave-sync]', userId, error)
    })
    return updated
  }

  const premiumPlan = await prisma.plan.findFirst({
    where: {
      OR: [{ slug: 'premium-month' }, { name: 'Premium' }],
      isActive: true,
    },
    orderBy: { price: 'asc' },
  })

  if (!premiumPlan) {
    throw new Error('Premium plan is not configured')
  }

  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const created = await prisma.subscription.create({
    data: {
      userId,
      planId: premiumPlan.id,
      status: 'ACTIVE',
      isTrial: false,
      startsAt: now,
      expiresAt,
    },
  })
  const { provisionRemnawaveInBackground } = await import('./vpn-provision.js')
  provisionRemnawaveInBackground(userId)
  return created
}

export async function activatePaidSubscription(userId: string, planId: string, durationDays: number) {
  const now = new Date()
  const active = await getActiveSubscription(userId)

  if (active) {
    await prisma.subscription.update({
      where: { id: active.id },
      data: { status: 'EXPIRED' },
    })
  }

  const startsAt = now
  const base = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now
  const expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000)

  const created = await prisma.subscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      isTrial: false,
      startsAt,
      expiresAt,
    },
  })

  const { syncRemnawaveExpireAt, provisionRemnawaveInBackground } = await import('./vpn-provision.js')
  await syncRemnawaveExpireAt(userId, expiresAt).catch((error) => {
    console.error('[remnawave-sync]', userId, error)
    provisionRemnawaveInBackground(userId)
  })

  return created
}
