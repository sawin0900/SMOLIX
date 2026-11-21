import type { FastifyPluginAsync } from 'fastify'
import argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getActiveSubscription } from '../lib/subscription.js'
import {
  listEnabledExtensionServers,
  syncExtensionNodesFromRemnawave,
} from '../lib/extension-nodes.js'
import { tryFulfillReferralForUser } from '../lib/referral.js'
import {
  authDelay,
  clearLoginFailures,
  clientIp,
  getLoginLockRemaining,
  recordLoginFailure,
} from '../lib/security.js'

const SESSION_DAYS = 7
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  deviceName: z.string().trim().min(1).max(100).optional(),
  deviceId: z.string().trim().regex(/^[A-Z0-9_-]{8,64}$/).optional(),
})

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function getBearerToken(authorization?: string) {
  if (!authorization) return null

  const match = authorization.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

const extensionRoutes: FastifyPluginAsync = async (app) => {
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

    const activeSub = await getActiveSubscription(user.id)
    const plan = activeSub
      ? await prisma.subscription.findUnique({
          where: { id: activeSub.id },
          include: { plan: true },
        })
      : null
    const deviceLimit = plan?.plan.deviceLimit ?? 1

    const activeDevices = await prisma.extensionSession.count({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (activeDevices >= deviceLimit) {
      // Revoke oldest so login still works within limit
      const oldest = await prisma.extensionSession.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
        take: Math.max(0, activeDevices - deviceLimit + 1),
        select: { id: true },
      })
      if (oldest.length) {
        await prisma.extensionSession.updateMany({
          where: { id: { in: oldest.map((item) => item.id) } },
          data: { revokedAt: new Date() },
        })
      }
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)

    await prisma.extensionSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        deviceName: parsed.data.deviceName ?? 'Chrome Extension',
        deviceId: parsed.data.deviceId,
        expiresAt,
      },
    })

    try {
      await tryFulfillReferralForUser(user.id)
    } catch (err) {
      request.log.error(err)
    }

    return {
      token,
      tokenType: 'Bearer',
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    }
  })

  app.get('/me', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({
        error: 'Требуется авторизация',
      })
    }

    const session = await prisma.extensionSession.findUnique({
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

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({
        error: 'Сессия истекла или недействительна',
      })
    }

    if (session.user.status !== 'ACTIVE') {
      return reply.code(403).send({
        error: 'Аккаунт заблокирован',
      })
    }

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    const subscription = await getActiveSubscription(session.user.id)

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        status: session.user.status,
        role: session.user.role,
      },
      vpnAccount: session.user.vpnAccount
        ? {
            isProvisioned: session.user.vpnAccount.isProvisioned,
          }
        : null,
      subscription: subscription
        ? {
            status: subscription.status,
            isTrial: subscription.isTrial,
            startsAt: subscription.startsAt,
            expiresAt: subscription.expiresAt,
            remainingSeconds: Math.max(
              0,
              Math.floor((subscription.expiresAt!.getTime() - Date.now()) / 1000)
            ),
          }
        : null,
      deviceId: (session as typeof session & { deviceId?: string | null }).deviceId ?? null,
    }
  })


  app.get('/servers', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({
        error: 'Требуется авторизация',
      })
    }

    const session = await prisma.extensionSession.findUnique({
      where: {
        tokenHash: hashToken(token),
      },
      include: {
        user: true,
      },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({
        error: 'Сессия истекла или недействительна',
      })
    }

    if (session.user.status !== 'ACTIVE') {
      return reply.code(403).send({
        error: 'Аккаунт заблокирован',
      })
    }

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    const query = request.query as { mode?: string }

    if (query.mode !== 'youtube') {
      const subscription = await getActiveSubscription(session.user.id)

      if (!subscription) {
        return reply.code(403).send({
          error: 'Пробный период или подписка закончились',
          code: 'SUBSCRIPTION_REQUIRED',
        })
      }
    }

    try {
      await syncExtensionNodesFromRemnawave()
    } catch {
      /* use DB cache if Remnawave briefly unavailable */
    }

    const servers = await listEnabledExtensionServers()
    return { servers }
  })
  app.post('/logout', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (token) {
      await prisma.extensionSession.updateMany({
        where: {
          tokenHash: hashToken(token),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      })
    }

    return {
      message: 'Сессия расширения завершена',
    }
  })

  app.get('/devices', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { tokenHash: hashToken(token) },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла или недействительна' })
    }

    const devices = await prisma.extensionSession.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        deviceId: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    })

    return {
      devices: devices.map((device) => ({
        ...device,
        isCurrent: device.id === session.id,
      })),
    }
  })

  app.post('/devices/revoke-others', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { tokenHash: hashToken(token) },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла или недействительна' })
    }

    await prisma.extensionSession.updateMany({
      where: {
        userId: session.userId,
        id: { not: session.id },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    return { message: 'Другие устройства отключены' }
  })

  app.get('/history', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { tokenHash: hashToken(token) },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла или недействительна' })
    }

    const history = await prisma.connectionHistory.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return { history }
  })

  app.post('/history/event', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const schema = z.object({
      status: z.enum(['CONNECTED', 'DISCONNECTED', 'FAILED']),
      serverId: z.string().max(128).nullable().optional(),
      mode: z.enum(['youtube', 'full']),
      message: z.string().max(500).nullable().optional(),
    })

    const parsed = schema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Некорректные данные события' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { tokenHash: hashToken(token) },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла или недействительна' })
    }

    if (parsed.data.status === 'DISCONNECTED') {
      const active = await prisma.connectionHistory.findFirst({
        where: {
          userId: session.userId,
          status: 'CONNECTED',
          endedAt: null,
        },
        orderBy: { startedAt: 'desc' },
      })

      if (active) {
        await prisma.connectionHistory.update({
          where: { id: active.id },
          data: {
            status: 'DISCONNECTED',
            endedAt: new Date(),
            message: parsed.data.message,
          },
        })
      }
    } else {
      await prisma.connectionHistory.create({
        data: {
          userId: session.userId,
          serverId: parsed.data.serverId,
          mode: parsed.data.mode,
          status: parsed.data.status,
          message: parsed.data.message,
          endedAt: parsed.data.status === 'FAILED' ? new Date() : null,
        },
      })
    }

    return { success: true }
  })
  app.post('/change-password', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const parsed = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Введите текущий пароль и новый пароль от 8 символов' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла или недействительна' })
    }

    if (!(await argon2.verify(session.user.passwordHash, parsed.data.currentPassword))) {
      return reply.code(403).send({ error: 'Текущий пароль указан неверно' })
    }

    const passwordHash = await argon2.hash(parsed.data.newPassword, {
      type: argon2.argon2id,
    })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash },
      }),
      prisma.extensionSession.updateMany({
        where: {
          userId: session.userId,
          id: { not: session.id },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ])

    return { message: 'Пароль изменён. Другие устройства отключены.' }
  })
}

export default extensionRoutes

const connectionHistory = (prisma as typeof prisma & {
      connectionHistory: {
        findMany(args: unknown): Promise<unknown[]>
        findFirst(args: unknown): Promise<any>
        update(args: unknown): Promise<unknown>
        create(args: unknown): Promise<unknown>
      }
    }).connectionHistory

