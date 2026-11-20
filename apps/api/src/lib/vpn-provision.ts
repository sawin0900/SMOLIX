import { prisma } from './prisma.js'
import { getActiveSubscription } from './subscription.js'
import {
  buildSubscriptionUrl,
  createRemnawaveUser,
  disableRemnawaveUser,
  enableRemnawaveUser,
  getRemnawaveUserByUsername,
  isRemnawaveConfigured,
  remnawaveUsernameFromUserId,
  remnawaveUserRef,
  updateRemnawaveUser,
} from './remnawave.js'

function defaultExpireAt() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
}

async function ensureVpnAccountRow(userId: string) {
  const existing = await prisma.vpnAccount.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.vpnAccount.create({ data: { userId } })
}

/**
 * Ensures Remnawave panel user exists and expireAt/status match SMOLIX subscription.
 * Safe to call repeatedly (idempotent). Skips when Remnawave env is not configured.
 */
export async function ensureRemnawaveProvisioned(userId: string) {
  if (!isRemnawaveConfigured()) {
    return { skipped: true as const, reason: 'not_configured' }
  }

  await ensureVpnAccountRow(userId)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vpnAccount: true },
  })

  if (!user?.vpnAccount) {
    throw new Error('VPN account not found')
  }

  const subscription = await getActiveSubscription(userId)
  const rawExpire = subscription?.expiresAt || defaultExpireAt()
  // Remnawave rejects expireAt in the past on update
  const expireAt =
    rawExpire.getTime() > Date.now() + 60_000
      ? rawExpire
      : new Date(Date.now() + 24 * 60 * 60 * 1000)
  const username = user.vpnAccount.remnawaveUsername || remnawaveUsernameFromUserId(userId)

  let remnawaveUser = await getRemnawaveUserByUsername(username)

  if (!remnawaveUser) {
    try {
      remnawaveUser = await createRemnawaveUser({
        username,
        email: user.email,
        expireAt,
        description: `SMOLIX ${user.email}`,
      })
    } catch (error) {
      // Race / already exists → re-fetch
      remnawaveUser = await getRemnawaveUserByUsername(username)
      if (!remnawaveUser) throw error
    }
  } else {
    remnawaveUser = await updateRemnawaveUser({
      id: remnawaveUser.id,
      username: remnawaveUser.username,
      expireAt,
      status: subscription ? 'ACTIVE' : remnawaveUser.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
      email: user.email,
    })

    if (subscription && remnawaveUser.status === 'DISABLED') {
      remnawaveUser = await enableRemnawaveUser(remnawaveUserRef(remnawaveUser))
    }
  }

  const storedId = remnawaveUserRef(remnawaveUser)
  const shortUuid = remnawaveUser.shortUuid
  const subscriptionUrl = buildSubscriptionUrl(shortUuid, remnawaveUser.subscriptionUrl)

  await prisma.vpnAccount.update({
    where: { id: user.vpnAccount.id },
    data: {
      remnawaveUserId: storedId,
      remnawaveUsername: remnawaveUser.username,
      isProvisioned: true,
      subscriptionShortUuid: shortUuid,
      subscriptionUrl,
    },
  })

  return {
    skipped: false as const,
    remnawaveUserId: storedId,
    username: remnawaveUser.username,
    expireAt: remnawaveUser.expireAt,
    shortUuid,
    subscriptionUrl,
  }
}

export async function syncRemnawaveExpireAt(userId: string, expireAt: Date) {
  if (!isRemnawaveConfigured()) {
    return { skipped: true as const }
  }

  const ensured = await ensureRemnawaveProvisioned(userId)
  if (ensured.skipped) return ensured

  const account = await prisma.vpnAccount.findUnique({ where: { userId } })
  const remnawaveId = account?.remnawaveUserId || ensured.remnawaveUserId
  if (!remnawaveId) {
    return { skipped: true as const, reason: 'no_remnawave_user' as const }
  }

  const updated = await updateRemnawaveUser({
    id: Number.isFinite(Number(remnawaveId)) ? Number(remnawaveId) : undefined,
    username: account?.remnawaveUsername || undefined,
    expireAt,
    status: 'ACTIVE',
  })

  await enableRemnawaveUser(remnawaveUserRef(updated)).catch(() => null)

  return {
    skipped: false as const,
    remnawaveUserId: remnawaveUserRef(updated),
    expireAt: updated.expireAt,
  }
}

export async function disableRemnawaveForUser(userId: string) {
  if (!isRemnawaveConfigured()) return { skipped: true as const }

  const account = await prisma.vpnAccount.findUnique({ where: { userId } })
  if (!account?.remnawaveUserId) {
    await ensureRemnawaveProvisioned(userId).catch(() => null)
  }

  const refreshed = await prisma.vpnAccount.findUnique({ where: { userId } })
  if (!refreshed?.remnawaveUserId) return { skipped: true as const, reason: 'no_remnawave_user' }

  await disableRemnawaveUser(refreshed.remnawaveUserId)
  return { skipped: false as const }
}

/** Fire-and-forget helper for request handlers */
export function provisionRemnawaveInBackground(userId: string, log?: { error: (err: unknown) => void }) {
  ensureRemnawaveProvisioned(userId).catch((error) => {
    log?.error(error)
    console.error('[remnawave-provision]', userId, error)
  })
}

/**
 * Await provision with a soft timeout so register/login stay responsive
 * if the panel is slow, while still creating the Remnawave user when possible.
 */
export async function provisionRemnawaveAwait(
  userId: string,
  options?: { timeoutMs?: number; log?: { error: (err: unknown) => void; info?: (obj: unknown, msg?: string) => void } },
) {
  const timeoutMs = options?.timeoutMs ?? 12000
  const log = options?.log

  if (!isRemnawaveConfigured()) {
    return { ok: false as const, skipped: true as const, reason: 'not_configured' as const }
  }

  try {
    const result = await Promise.race([
      ensureRemnawaveProvisioned(userId),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Remnawave provision timeout')), timeoutMs)
      }),
    ])

    if (result.skipped) {
      return { ok: false as const, skipped: true as const, reason: result.reason }
    }

    log?.info?.(
      { userId, username: result.username, remnawaveUserId: result.remnawaveUserId },
      'Remnawave user provisioned',
    )

    return {
      ok: true as const,
      skipped: false as const,
      username: result.username,
      remnawaveUserId: result.remnawaveUserId,
    }
  } catch (error) {
    log?.error?.(error)
    console.error('[remnawave-provision]', userId, error)
    // Keep trying in background so panel eventually gets the user
    provisionRemnawaveInBackground(userId, log)
    return {
      ok: false as const,
      skipped: false as const,
      error: error instanceof Error ? error.message : 'provision_failed',
    }
  }
}
