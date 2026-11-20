import type { FastifyPluginAsync } from 'fastify'
import '@fastify/cookie'
import '@fastify/rate-limit'
import argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createPendingReferralReward, ensureUniqueReferralCode } from '../lib/referral.js'
import { emailVerificationEmail, passwordResetEmail, sendMail } from '../lib/mailer.js'
import { provisionRemnawaveAwait, provisionRemnawaveInBackground } from '../lib/vpn-provision.js'
import {
  checkFormTiming,
  checkHoneypot,
  checkReferralIpCap,
  checkRegisterIpLimits,
  isDisposableEmail,
  isTurnstileRequired,
  logSignupEvent,
  recordReferralIp,
  recordRegisterIp,
  signupIpHash,
  verifyTurnstileToken,
} from '../lib/antibot.js'
import { ensureSupportCode } from '../lib/audit.js'
import { getSessionUser } from '../lib/session.js'
import {
  authDelay,
  clearLoginFailures,
  clientIp,
  getLoginLockRemaining,
  isAllowedChromeExtensionOrigin,
  isProduction,
  recordLoginFailure,
  validatePasswordStrength,
} from '../lib/security.js'

const COOKIE_NAME = 'smolix_session'
const SESSION_DAYS = process.env.NODE_ENV === 'production' ? 1 : 7
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60
const MAX_WEB_SESSIONS = Number(process.env.MAX_WEB_SESSIONS || 5)

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  referralCode: z.string().trim().min(4).max(16).optional(),
  /** Honeypot — must stay empty */
  website: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  formStartedAt: z.union([z.number(), z.string()]).optional(),
  turnstileToken: z.string().max(2048).optional(),
})

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
})

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function cookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction() || process.env.COOKIE_SECURE === '1',
    sameSite: 'lax' as const,
    maxAge: SESSION_SECONDS,
  }
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)

  const existing = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (existing.length >= MAX_WEB_SESSIONS) {
    const toDelete = existing.slice(0, existing.length - MAX_WEB_SESSIONS + 1)
    await prisma.session.deleteMany({
      where: { id: { in: toDelete.map((item) => item.id) } },
    })
  }

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  })

  return token
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/antibot', async () => {
    const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || null
    return {
      turnstileRequired: isTurnstileRequired(),
      turnstileSiteKey: siteKey,
      minFormMs: Number(process.env.REGISTER_MIN_MS || (isProduction() ? 2500 : 800)),
    }
  })

  app.post('/register', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Введите корректный Email и пароль длиной от 8 до 128 символов',
      })
    }

    const honeypotHit = checkHoneypot(parsed.data.website) || checkHoneypot(parsed.data.company)
    if (honeypotHit) {
      await authDelay(400)
      await logSignupEvent('honeypot', { emailDomain: parsed.data.email.split('@')[1]?.toLowerCase() })
      // Fake success so bots don't iterate
      return reply.code(201).send({
        message: 'Регистрация успешна',
        user: { id: '00000000-0000-0000-0000-000000000000', email: parsed.data.email.toLowerCase(), status: 'ACTIVE' },
      })
    }

    const fromExtension = isAllowedChromeExtensionOrigin(
      typeof request.headers.origin === 'string' ? request.headers.origin : undefined,
    )

    const timingError = checkFormTiming(parsed.data.formStartedAt)
    if (timingError) {
      return reply.code(400).send({ error: timingError })
    }

    const ip = clientIp(request)
    const ipLimitError = checkRegisterIpLimits(ip)
    if (ipLimitError) {
      return reply.code(429).send({ error: ipLimitError })
    }

    // Turnstile is for browser forms; trusted Chrome extension uses origin allowlist
    if (!fromExtension) {
      const turnstileError = await verifyTurnstileToken(parsed.data.turnstileToken, ip)
      if (turnstileError) {
        return reply.code(400).send({ error: turnstileError, turnstileRequired: isTurnstileRequired() })
      }
    }

    const weak = validatePasswordStrength(parsed.data.password)
    if (weak) {
      return reply.code(400).send({ error: weak })
    }

    const email = parsed.data.email.toLowerCase()
    if (isDisposableEmail(email)) {
      await logSignupEvent('disposable', {
        ipHash: signupIpHash(ip),
        emailDomain: email.split('@')[1],
      })
      return reply.code(400).send({ error: 'Временные почтовые ящики не поддерживаются' })
    }

    const passwordHash = await argon2.hash(parsed.data.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    })

    const ipHash = signupIpHash(ip)
    let referrerUserId: string | null = null
    let referralSkipReason: string | null = null
    if (parsed.data.referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: parsed.data.referralCode.toLowerCase() },
        select: { id: true, status: true },
      })
      if (referrer && referrer.status === 'ACTIVE') {
        const referralIpError = checkReferralIpCap(ip, referrer.id)
        if (referralIpError) {
          referralSkipReason = 'ip_referral_cap'
        } else {
          referrerUserId = referrer.id
        }
      }
    }

    try {
      const referralCode = await ensureUniqueReferralCode()

      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            referralCode,
            referredByUserId: referrerUserId,
            signupIpHash: ipHash,
          },
        })

        await tx.vpnAccount.create({
          data: {
            userId: createdUser.id,
          },
        })

        const trialPlan = await tx.plan.findFirst({
          where: {
            name: 'Пробный период',
            isActive: true,
            price: 0,
            durationDays: 14,
          },
        })

        if (!trialPlan) {
          throw new Error('Не найден активный тариф пробного периода')
        }

        const trialStartsAt = new Date()
        const trialExpiresAt = new Date(
          trialStartsAt.getTime() + 14 * 24 * 60 * 60 * 1000
        )

        await tx.subscription.create({
          data: {
            userId: createdUser.id,
            planId: trialPlan.id,
            status: 'ACTIVE',
            isTrial: true,
            startsAt: trialStartsAt,
            expiresAt: trialExpiresAt,
          },
        })

        return createdUser
      })

      recordRegisterIp(ip)
      await ensureSupportCode(user.id)
      await logSignupEvent('register_ok', {
        ipHash: ipHash,
        emailDomain: email.split('@')[1],
        extra: { referred: Boolean(referrerUserId) },
      })

      if (referrerUserId) {
        try {
          recordReferralIp(ip, referrerUserId)
          await createPendingReferralReward(referrerUserId, user.id, {
            signupIpHash: ipHash,
            skipReason: referralSkipReason,
          })
        } catch (rewardError) {
          request.log.error(rewardError)
        }
      }

      // Site + extension both hit this route — user must land in Remnawave panel too
      const remnawave = await provisionRemnawaveAwait(user.id, {
        timeoutMs: 12000,
        log: request.log,
      })

      const token = await createSession(user.id)

      reply.setCookie(COOKIE_NAME, token, cookieOptions())

      return reply.code(201).send({
        message: remnawave.ok
          ? 'Регистрация успешна'
          : remnawave.skipped
            ? 'Регистрация успешна (Remnawave не настроен)'
            : 'Регистрация успешна (синхронизация Remnawave продолжается)',
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          role: user.role,
        },
        remnawave: remnawave.ok
          ? {
              provisioned: true,
              username: remnawave.username,
              remnawaveUserId: remnawave.remnawaveUserId,
            }
          : {
              provisioned: false,
              skipped: Boolean(remnawave.skipped),
              error: 'error' in remnawave ? remnawave.error : undefined,
            },
      })
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return reply.code(409).send({
          error: 'Пользователь с таким Email уже существует',
        })
      }

      request.log.error(error)
      return reply.code(500).send({
        error: 'Не удалось создать аккаунт',
      })
    }
  })

  app.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Проверьте Email и пароль',
      })
    }

    const ip = clientIp(request)
    const email = parsed.data.email.toLowerCase()
    const lockSeconds = getLoginLockRemaining(ip, email)
    if (lockSeconds > 0) {
      return reply.code(429).send({
        error: `Слишком много попыток входа. Повторите через ${lockSeconds} сек.`,
      })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { vpnAccount: true },
    })

    const passwordOk = user
      ? await argon2.verify(user.passwordHash, parsed.data.password)
      : false

    if (!user || user.status !== 'ACTIVE' || !passwordOk) {
      recordLoginFailure(ip, email)
      await authDelay()
      return reply.code(401).send({
        error: 'Неверный Email или пароль',
      })
    }

    clearLoginFailures(ip, email)

    // Backfill Remnawave if registration sync failed earlier
    if (!user.vpnAccount?.isProvisioned) {
      provisionRemnawaveInBackground(user.id, request.log)
    }

    const token = await createSession(user.id)
    reply.setCookie(COOKIE_NAME, token, cookieOptions())

    return {
      message: 'Вход выполнен',
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
      },
    }
  })

  app.post('/logout', async (request, reply) => {
    const token = request.cookies?.[COOKIE_NAME]

    if (token) {
      await prisma.session.deleteMany({
        where: {
          tokenHash: hashToken(token),
        },
      })
    }

    reply.clearCookie(COOKIE_NAME, { path: '/' })

    return {
      message: 'Вы вышли из аккаунта',
    }
  })

  app.get('/me', async (request, reply) => {
    const token = request.cookies?.[COOKIE_NAME]

    if (!token) {
      return reply.code(401).send({
        error: 'Требуется авторизация',
      })
    }

    const session = await prisma.session.findUnique({
      where: {
        tokenHash: hashToken(token),
      },
      include: {
        user: {
          include: {
            vpnAccount: true,
          },
        },
      },
    })

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.session.delete({
          where: { id: session.id },
        })
      }

      reply.clearCookie(COOKIE_NAME, { path: '/' })

      return reply.code(401).send({
        error: 'Сессия истекла или недействительна',
      })
    }

    if (session.user.status !== 'ACTIVE') {
      return reply.code(403).send({
        error: 'Аккаунт заблокирован',
      })
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        status: session.user.status,
        role: session.user.role,
        createdAt: session.user.createdAt,
      },
      vpnAccount: session.user.vpnAccount
        ? {
            isProvisioned: session.user.vpnAccount.isProvisioned,
          }
        : null,
    }
  })

  app.post('/change-password', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const schema = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    })

    const parsed = schema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Введите текущий пароль и новый пароль от 8 символов',
      })
    }

    const weak = validatePasswordStrength(parsed.data.newPassword)
    if (weak) {
      return reply.code(400).send({ error: weak })
    }

    const token = request.cookies?.[COOKIE_NAME]

    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })

    if (!session || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла' })
    }

    const valid = await argon2.verify(session.user.passwordHash, parsed.data.currentPassword)

    if (!valid) {
      return reply.code(403).send({ error: 'Текущий пароль указан неверно' })
    }

    const passwordHash = await argon2.hash(parsed.data.newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({ where: { userId: session.userId } }),
      prisma.extensionSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    reply.clearCookie(COOKIE_NAME, { path: '/' })

    return { message: 'Пароль изменён. Войдите заново на всех устройствах.' }
  })

  app.post('/password-reset/request', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parsed = z.object({
      email: z.string().trim().email().max(254),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Введите корректный Email' })
    }

    const email = parsed.data.email.toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      const token = randomBytes(32).toString('base64url')

      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      })

      const webAppUrl = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
      const resetUrl = `${webAppUrl}/auth?mode=reset&token=${encodeURIComponent(token)}`
      const mail = passwordResetEmail(resetUrl)
      await sendMail({ to: email, ...mail })
      request.log.info({ email, resetTokenCreated: true }, 'Password reset requested')
    }

    return {
      message: 'Если аккаунт существует, инструкции по восстановлению будут отправлены на Email.',
    }
  })

  app.post('/password-reset/confirm', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parsed = z.object({
      token: z.string().min(20).max(128),
      newPassword: z.string().min(8).max(128),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Проверьте токен и пароль от 8 символов' })
    }

    const weak = validatePasswordStrength(parsed.data.newPassword)
    if (weak) {
      return reply.code(400).send({ error: weak })
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      include: { user: true },
    })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return reply.code(400).send({ error: 'Ссылка недействительна или истекла' })
    }

    const passwordHash = await argon2.hash(parsed.data.newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
      prisma.extensionSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    return { message: 'Пароль изменён. Войдите заново.' }
  })

  app.post('/email-verification/request', {
    config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const user = await getSessionUser(request as any)
    if (!user) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (user.emailVerifiedAt) {
      return { message: 'Email уже подтверждён' }
    }

    const token = randomBytes(32).toString('base64url')
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    const webAppUrl = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    const verifyUrl = `${webAppUrl}/auth?mode=verify-email&token=${token}`
    const mail = emailVerificationEmail(verifyUrl)
    await sendMail({ to: user.email, subject: mail.subject, text: mail.text })

    return { message: 'Письмо с подтверждением отправлено' }
  })

  app.post('/email-verification/confirm', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const parsed = z.object({ token: z.string().min(20).max(200) }).safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Некорректный токен' })
    }

    const row = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
    })
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      return reply.code(400).send({ error: 'Ссылка недействительна или истекла' })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ])

    return { message: 'Email подтверждён' }
  })
}

export default authRoutes
