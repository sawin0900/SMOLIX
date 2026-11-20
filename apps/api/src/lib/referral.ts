import { randomBytes } from 'node:crypto'
import { prisma } from './prisma.js'
import { extendActiveSubscription } from './subscription.js'
import { isProduction } from './security.js'

export function generateReferralCode() {
  return randomBytes(4).toString('hex')
}

export async function ensureUniqueReferralCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode()
    const existing = await prisma.user.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }
  return randomBytes(6).toString('hex')
}

function rewardDays() {
  return Number(process.env.REFERRAL_REWARD_DAYS || 7)
}

function minAgeMs() {
  const minutes = Number(
    process.env.REFERRAL_MIN_AGE_MINUTES
      ?? (isProduction() ? 30 : 0),
  )
  return Math.max(0, minutes) * 60_000
}

function dailyGrantCap() {
  return Number(process.env.REFERRAL_DAILY_GRANT_MAX || 10)
}

/** Create a pending reward — days are granted only after real activity */
export async function createPendingReferralReward(
  referrerUserId: string,
  referredUserId: string,
  options?: {
    signupIpHash?: string | null
    skipReason?: string | null
  },
) {
  if (referrerUserId === referredUserId) return null

  const existing = await prisma.referralReward.findUnique({
    where: {
      referrerUserId_referredUserId: {
        referrerUserId,
        referredUserId,
      },
    },
  })
  if (existing) return existing

  if (options?.skipReason) {
    return prisma.referralReward.create({
      data: {
        referrerUserId,
        referredUserId,
        daysGranted: 0,
        status: 'REJECTED',
        rejectReason: options.skipReason.slice(0, 120),
      },
    })
  }

  if (options?.signupIpHash) {
    const sameIpReferrer = await prisma.user.findFirst({
      where: {
        id: referrerUserId,
        signupIpHash: options.signupIpHash,
      },
      select: { id: true },
    })
    if (sameIpReferrer) {
      return prisma.referralReward.create({
        data: {
          referrerUserId,
          referredUserId,
          daysGranted: 0,
          status: 'REJECTED',
          rejectReason: 'same_signup_ip',
        },
      })
    }

    const sameIpRefsToday = await prisma.user.count({
      where: {
        referredByUserId: referrerUserId,
        signupIpHash: options.signupIpHash,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    if (sameIpRefsToday >= Number(process.env.REFERRAL_SAME_IP_DAY_MAX || 2)) {
      return prisma.referralReward.create({
        data: {
          referrerUserId,
          referredUserId,
          daysGranted: 0,
          status: 'REJECTED',
          rejectReason: 'ip_referral_cap',
        },
      })
    }
  }

  const pendingOrGrantedToday = await prisma.referralReward.count({
    where: {
      referrerUserId,
      status: { in: ['PENDING', 'GRANTED'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })
  if (pendingOrGrantedToday >= dailyGrantCap()) {
    return prisma.referralReward.create({
      data: {
        referrerUserId,
        referredUserId,
        daysGranted: 0,
        status: 'REJECTED',
        rejectReason: 'daily_cap',
      },
    })
  }

  return prisma.referralReward.create({
    data: {
      referrerUserId,
      referredUserId,
      daysGranted: rewardDays(),
      status: 'PENDING',
    },
  })
}

/** @deprecated immediate grant — kept for scripts; prefer createPending + tryFulfill */
export async function grantReferralReward(referrerUserId: string, referredUserId: string, days = 7) {
  if (referrerUserId === referredUserId) return null

  const existing = await prisma.referralReward.findUnique({
    where: {
      referrerUserId_referredUserId: {
        referrerUserId,
        referredUserId,
      },
    },
  })

  if (existing) {
    if (existing.status === 'GRANTED') return existing
    if (existing.status === 'REJECTED') return existing
  }

  await extendActiveSubscription(referrerUserId, days)

  if (existing) {
    return prisma.referralReward.update({
      where: { id: existing.id },
      data: {
        status: 'GRANTED',
        daysGranted: days,
        grantedAt: new Date(),
        rejectReason: null,
      },
    })
  }

  return prisma.referralReward.create({
    data: {
      referrerUserId,
      referredUserId,
      daysGranted: days,
      status: 'GRANTED',
      grantedAt: new Date(),
    },
  })
}

/**
 * Grant pending referral reward after the invited user shows real activity
 * (extension login or paid order) and account age threshold.
 */
export async function tryFulfillReferralForUser(referredUserId: string) {
  const pending = await prisma.referralReward.findFirst({
    where: {
      referredUserId,
      status: 'PENDING',
    },
  })
  if (!pending) return null

  const referred = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: {
      id: true,
      createdAt: true,
      signupIpHash: true,
      referredByUserId: true,
    },
  })
  if (!referred) return null

  const ageOk = Date.now() - referred.createdAt.getTime() >= minAgeMs()
  if (!ageOk) return null

  const [extensionSessions, paidOrders] = await Promise.all([
    prisma.extensionSession.count({ where: { userId: referredUserId } }),
    prisma.order.count({ where: { userId: referredUserId, status: 'PAID' } }),
  ])

  if (extensionSessions < 1 && paidOrders < 1) return null

  if (referred.signupIpHash && referred.referredByUserId) {
    const referrerSameIp = await prisma.user.findFirst({
      where: {
        id: referred.referredByUserId,
        signupIpHash: referred.signupIpHash,
      },
      select: { id: true },
    })
    if (referrerSameIp) {
      return prisma.referralReward.update({
        where: { id: pending.id },
        data: {
          status: 'REJECTED',
          daysGranted: 0,
          rejectReason: 'same_signup_ip',
        },
      })
    }
  }

  const grantedToday = await prisma.referralReward.count({
    where: {
      referrerUserId: pending.referrerUserId,
      status: 'GRANTED',
      grantedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })
  if (grantedToday >= dailyGrantCap()) {
    return prisma.referralReward.update({
      where: { id: pending.id },
      data: {
        status: 'REJECTED',
        daysGranted: 0,
        rejectReason: 'daily_cap',
      },
    })
  }

  const days = pending.daysGranted > 0 ? pending.daysGranted : rewardDays()
  await extendActiveSubscription(pending.referrerUserId, days)

  return prisma.referralReward.update({
    where: { id: pending.id },
    data: {
      status: 'GRANTED',
      daysGranted: days,
      grantedAt: new Date(),
      rejectReason: null,
    },
  })
}
