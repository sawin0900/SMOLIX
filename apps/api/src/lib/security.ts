import { createHash } from 'node:crypto'

const isProd = () => process.env.NODE_ENV === 'production'

/** Password rules for register / reset / change */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Пароль должен быть не короче 8 символов'
  if (password.length > 128) return 'Пароль слишком длинный'
  if (!/[A-Za-zА-Яа-я]/.test(password) || !/[0-9]/.test(password)) {
    return 'Пароль должен содержать буквы и цифры'
  }
  const lowered = password.toLowerCase()
  const banned = ['password', 'qwerty', '12345678', 'smolix123', 'admin123']
  if (banned.some((item) => lowered.includes(item))) {
    return 'Слишком простой пароль'
  }
  return null
}

export function getAllowedExtensionIds(): Set<string> {
  const raw = process.env.ALLOWED_EXTENSION_IDS || ''
  const ids = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-p]{32}$/.test(item))

  // Dev fallback when unset — still required in production via env
  if (ids.length === 0 && !isProd()) {
    return new Set(['jknfeedfndhdcgehbbelangakfiiiehe'])
  }

  return new Set(ids)
}

export function isAllowedChromeExtensionOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  const match = origin.match(/^chrome-extension:\/\/([a-p]{32})$/i)
  if (!match) return false
  const allowed = getAllowedExtensionIds()
  if (allowed.size === 0) return false
  return allowed.has(match[1].toLowerCase())
}

export function getAllowedWebOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  if (getAllowedWebOrigins().includes(origin)) return true
  return isAllowedChromeExtensionOrigin(origin)
}

type AttemptBucket = {
  count: number
  firstAt: number
  lockedUntil: number
}

const loginAttempts = new Map<string, AttemptBucket>()

function attemptKey(ip: string, email: string) {
  return createHash('sha256').update(`${ip}|${email.toLowerCase()}`).digest('hex')
}

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 8)
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000)
const LOCK_MS = Number(process.env.LOGIN_LOCK_MS || 15 * 60 * 1000)

/** Returns remaining lock seconds, or 0 if allowed */
export function getLoginLockRemaining(ip: string, email: string): number {
  const key = attemptKey(ip, email)
  const bucket = loginAttempts.get(key)
  if (!bucket) return 0
  const now = Date.now()
  if (bucket.lockedUntil > now) {
    return Math.ceil((bucket.lockedUntil - now) / 1000)
  }
  if (now - bucket.firstAt > WINDOW_MS) {
    loginAttempts.delete(key)
    return 0
  }
  return 0
}

export function recordLoginFailure(ip: string, email: string) {
  const key = attemptKey(ip, email)
  const now = Date.now()
  const bucket = loginAttempts.get(key)

  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now, lockedUntil: 0 })
    return
  }

  bucket.count += 1
  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.lockedUntil = now + LOCK_MS
  }
  loginAttempts.set(key, bucket)
}

export function clearLoginFailures(ip: string, email: string) {
  loginAttempts.delete(attemptKey(ip, email))
}

/** Uniform delay so timing leaks less about user existence */
export async function authDelay(ms = 250) {
  await new Promise((resolve) => setTimeout(resolve, ms + Math.floor(Math.random() * 150)))
}

// Periodic cleanup to avoid unbounded Map growth
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of loginAttempts) {
    if (bucket.lockedUntil < now && now - bucket.firstAt > WINDOW_MS) {
      loginAttempts.delete(key)
    }
  }
}, 60_000).unref?.()

export function clientIp(request: { ip: string; headers: Record<string, unknown> }): string {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim().slice(0, 64)
  }
  return (request.ip || 'unknown').slice(0, 64)
}

export function isProduction() {
  return isProd()
}
