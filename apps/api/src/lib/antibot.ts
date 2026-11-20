import { createHash } from 'node:crypto'
import { prisma } from './prisma.js'
import { isProduction } from './security.js'

export async function logSignupEvent(kind: string, meta?: {
  ipHash?: string | null
  emailDomain?: string | null
  extra?: Record<string, unknown>
}) {
  try {
    await prisma.signupEvent.create({
      data: {
        kind: kind.slice(0, 32),
        ipHash: meta?.ipHash?.slice(0, 64),
        emailDomain: meta?.emailDomain?.slice(0, 120),
        meta: meta?.extra ? (meta.extra as object) : undefined,
      },
    })
  } catch {
    /* non-fatal */
  }
}

/** Common disposable / throwaway mail domains used for mass signups */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'sharklasers.com',
  'grr.la',
  'yopmail.com',
  'tempmail.com',
  'temp-mail.org',
  'tempmailo.com',
  '10minutemail.com',
  '10minemail.com',
  'throwaway.email',
  'trashmail.com',
  'trashmail.me',
  'getnada.com',
  'nada.ltd',
  'emailondeck.com',
  'maildrop.cc',
  'dispostable.com',
  'mailnesia.com',
  'moakt.com',
  'tempail.com',
  'fakeinbox.com',
  'mintemail.com',
  'mytemp.email',
  'tmpmail.org',
  'tmpmail.net',
  'discard.email',
  'discardmail.com',
  'spamgourmet.com',
  'mailcatch.com',
  'inboxkitten.com',
  'getairmail.com',
  'burnermail.io',
  'mailnull.com',
  'spam4.me',
  'mailinator.net',
  'mailinator.org',
])

type CounterBucket = {
  count: number
  windowStart: number
}

const registerHour = new Map<string, CounterBucket>()
const registerDay = new Map<string, CounterBucket>()
const referralIpDay = new Map<string, CounterBucket>()

function hashIp(ip: string) {
  return createHash('sha256').update(`smolix-signup|${ip}`).digest('hex').slice(0, 32)
}

export function signupIpHash(ip: string) {
  return hashIp(ip)
}

function bump(map: Map<string, CounterBucket>, key: string, windowMs: number) {
  const now = Date.now()
  const bucket = map.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    map.set(key, { count: 1, windowStart: now })
    return 1
  }
  bucket.count += 1
  map.set(key, bucket)
  return bucket.count
}

function peek(map: Map<string, CounterBucket>, key: string, windowMs: number) {
  const bucket = map.get(key)
  if (!bucket) return 0
  if (Date.now() - bucket.windowStart > windowMs) {
    map.delete(key)
    return 0
  }
  return bucket.count
}

setInterval(() => {
  const now = Date.now()
  for (const [map, maxAge] of [
    [registerHour, 2 * 60 * 60 * 1000],
    [registerDay, 2 * 24 * 60 * 60 * 1000],
    [referralIpDay, 2 * 24 * 60 * 60 * 1000],
  ] as const) {
    for (const [key, bucket] of map) {
      if (now - bucket.windowStart > maxAge) map.delete(key)
    }
  }
}, 60_000).unref?.()

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return true
  if (DISPOSABLE_DOMAINS.has(domain)) return true
  // catch common patterns like mailinator.co.uk variants already covered; block +temp aliases on free hosts is too aggressive
  return false
}

export function checkHoneypot(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string' && value.trim() === '') return null
  return 'Регистрация отклонена'
}

export function checkFormTiming(formStartedAt: unknown): string | null {
  const minMs = Number(process.env.REGISTER_MIN_MS || (isProduction() ? 2500 : 800))
  const maxMs = Number(process.env.REGISTER_MAX_MS || 2 * 60 * 60 * 1000)

  const started = typeof formStartedAt === 'number'
    ? formStartedAt
    : typeof formStartedAt === 'string'
      ? Number(formStartedAt)
      : NaN

  if (!Number.isFinite(started)) {
    return 'Обновите страницу и попробуйте снова'
  }

  const elapsed = Date.now() - started
  if (elapsed < minMs) {
    return 'Слишком быстрая регистрация. Подождите секунду и попробуйте снова'
  }
  if (elapsed > maxMs) {
    return 'Форма устарела. Обновите страницу и попробуйте снова'
  }
  return null
}

export function checkRegisterIpLimits(ip: string): string | null {
  const hourMax = Number(process.env.REGISTER_IP_HOUR_MAX || 3)
  const dayMax = Number(process.env.REGISTER_IP_DAY_MAX || 8)
  const hourKey = hashIp(ip)
  const dayKey = hashIp(ip)

  if (peek(registerHour, hourKey, 60 * 60 * 1000) >= hourMax) {
    return 'Слишком много регистраций с этого адреса. Попробуйте позже'
  }
  if (peek(registerDay, dayKey, 24 * 60 * 60 * 1000) >= dayMax) {
    return 'Достигнут дневной лимит регистраций. Попробуйте завтра'
  }
  return null
}

export function recordRegisterIp(ip: string) {
  bump(registerHour, hashIp(ip), 60 * 60 * 1000)
  bump(registerDay, hashIp(ip), 24 * 60 * 60 * 1000)
}

export function checkReferralIpCap(ip: string, referrerUserId: string): string | null {
  const max = Number(process.env.REFERRAL_IP_DAY_MAX || 3)
  const key = `${hashIp(ip)}:${referrerUserId}`
  if (peek(referralIpDay, key, 24 * 60 * 60 * 1000) >= max) {
    return 'Слишком много приглашений с одного адреса'
  }
  return null
}

export function recordReferralIp(ip: string, referrerUserId: string) {
  bump(referralIpDay, `${hashIp(ip)}:${referrerUserId}`, 24 * 60 * 60 * 1000)
}

export function isTurnstileRequired() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
}

export async function verifyTurnstileToken(token: unknown, ip: string): Promise<string | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return null

  if (typeof token !== 'string' || token.trim().length < 10) {
    return 'Пройдите проверку «я не робот»'
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
      remoteip: ip,
    })
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      return 'Проверка «я не робот» не пройдена'
    }
    return null
  } catch {
    return 'Не удалось проверить защиту от ботов. Попробуйте позже'
  }
}
