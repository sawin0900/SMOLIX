import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { COOKIE_NAME, getSessionUser, hashToken } from '../lib/session.js'
import { prisma } from '../lib/prisma.js'
import { getActiveSubscription } from '../lib/subscription.js'
import { ensureRemnawaveProvisioned } from '../lib/vpn-provision.js'
import { ensureSupportCode } from '../lib/audit.js'
import type { FastifyReply } from 'fastify'

function rejectIfImpersonating(
  user: { impersonatedBy?: string | null },
  reply: FastifyReply,
) {
  if (!user.impersonatedBy) return false
  reply.code(403).send({ error: 'Действие недоступно в режиме просмотра саппорта' })
  return true
}

const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user) {
      return reply.code(401).send({
        error: 'Требуется авторизация',
      })
    }

    const supportCode = await ensureSupportCode(user.id)

    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
        supportCode,
      },
      vpnAccount: user.vpnAccount
        ? {
            isProvisioned: user.vpnAccount.isProvisioned,
            remnawaveUsername: user.vpnAccount.remnawaveUsername,
            subscriptionUrl: user.vpnAccount.subscriptionUrl,
            subscriptionShortUuid: user.vpnAccount.subscriptionShortUuid,
            proxyProvisioned: user.vpnAccount.proxyProvisioned,
          }
        : null,
    }
  })

  app.get('/overview', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const [activeSubscription, deviceCount, lastConnection] = await Promise.all([
      getActiveSubscription(user.id),
      prisma.extensionSession.count({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.connectionHistory.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const subscription = activeSubscription
      ? await prisma.subscription.findUnique({
          where: { id: activeSubscription.id },
          include: { plan: true },
        })
      : null

    const latestExtension = await prisma.extensionSession.findFirst({
      where: { userId: user.id },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, lastUsedAt: true, createdAt: true, revokedAt: true, expiresAt: true, deviceName: true },
    })

    const extensionLinked = deviceCount > 0
    const lastUsedAt = latestExtension?.lastUsedAt || latestExtension?.createdAt || null
    const staleMs = 36 * 60 * 60 * 1000 // 36h without popup activity
    const extensionStale = Boolean(
      lastUsedAt && Date.now() - new Date(lastUsedAt).getTime() > staleMs,
    )

    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
      },
      vpnAccount: user.vpnAccount
        ? {
            isProvisioned: user.vpnAccount.isProvisioned,
            remnawaveUsername: user.vpnAccount.remnawaveUsername,
            proxyProvisioned: user.vpnAccount.proxyProvisioned,
            subscriptionUrl: user.vpnAccount.subscriptionUrl,
            subscriptionShortUuid: user.vpnAccount.subscriptionShortUuid,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            isTrial: subscription.isTrial,
            startsAt: subscription.startsAt,
            expiresAt: subscription.expiresAt,
            remainingSeconds: subscription.expiresAt
              ? Math.max(0, Math.floor((subscription.expiresAt.getTime() - Date.now()) / 1000))
              : null,
            planName: subscription.plan.name,
            deviceLimit: subscription.plan.deviceLimit,
            trafficLimitBytes: subscription.plan.trafficLimit?.toString() ?? null,
          }
        : null,
      devices: {
        activeCount: deviceCount,
        deviceLimit: subscription?.plan?.deviceLimit ?? 1,
      },
      extension: {
        linked: extensionLinked,
        stale: extensionStale && !extensionLinked ? false : extensionStale,
        lastUsedAt,
        deviceName: latestExtension?.deviceName ?? null,
      },
      impersonation: user.impersonatedBy
        ? { active: true, actorId: user.impersonatedBy }
        : { active: false },
      lastConnection: lastConnection
        ? {
            status: lastConnection.status,
            mode: lastConnection.mode,
            serverId: lastConnection.serverId,
            startedAt: lastConnection.startedAt,
            endedAt: lastConnection.endedAt,
            message: lastConnection.message,
          }
        : null,
    }
  })

  app.get('/servers', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({
        error: 'Требуется авторизация',
      })
    }

    const servers = await prisma.server.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        hostname: true,
        port: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return {
      servers,
      note: 'Список из каталога jetsale.online. Premium-прокси в расширении сейчас через одну поддерживаемую ноду Remnawave.',
    }
  })

  app.get('/subscription', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({
        error: 'Требуется авторизация',
      })
    }

    const activeSubscription = await getActiveSubscription(user.id)

    const subscription = activeSubscription
      ? await prisma.subscription.findUnique({
          where: { id: activeSubscription.id },
          include: { plan: true },
        })
      : await prisma.subscription.findFirst({
          where: {
            userId: user.id,
            status: 'PENDING',
          },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        })

    return {
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            isTrial: subscription.isTrial,
            startsAt: subscription.startsAt,
            remainingSeconds: subscription.expiresAt
              ? Math.max(0, Math.floor((subscription.expiresAt.getTime() - Date.now()) / 1000))
              : null,
            expiresAt: subscription.expiresAt,
            plan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              description: subscription.plan.description,
              price: subscription.plan.price.toString(),
              currency: subscription.plan.currency,
              durationDays: subscription.plan.durationDays,
              deviceLimit: subscription.plan.deviceLimit,
            },
          }
        : null,
    }
  })

  app.post('/vpn/refresh', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (rejectIfImpersonating(user, reply)) return

    try {
      const result = await ensureRemnawaveProvisioned(user.id)
      if (result.skipped) {
        return reply.code(503).send({
          error: 'Remnawave не настроен на сервере',
          skipped: true,
        })
      }

      const vpnAccount = await prisma.vpnAccount.findUnique({
        where: { userId: user.id },
        select: {
          isProvisioned: true,
          remnawaveUsername: true,
          subscriptionUrl: true,
          subscriptionShortUuid: true,
        },
      })

      return {
        message: 'Ссылка подписки обновлена',
        vpnAccount,
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(502).send({
        error: error instanceof Error ? error.message : 'Не удалось обновить подписку Remnawave',
      })
    }
  })

  app.get('/orders', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        plan: { select: { name: true, slug: true } },
        payment: { select: { status: true, provider: true, createdAt: true } },
      },
    })

    return {
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        amount: order.amount.toString(),
        currency: order.currency,
        createdAt: order.createdAt,
        plan: order.plan,
        payment: order.payment,
      })),
    }
  })

  app.get('/devices', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const devices = await prisma.extensionSession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        deviceId: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return { devices }
  })

  app.post('/devices/revoke-all', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (rejectIfImpersonating(user, reply)) return

    const result = await prisma.extensionSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    return {
      message: 'Все сессии расширения отключены',
      revoked: result.count,
    }
  })

  app.post('/devices/:deviceId/revoke', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (rejectIfImpersonating(user, reply)) return

    const params = z.object({ deviceId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Некорректный deviceId' })
    }

    const device = await prisma.extensionSession.findFirst({
      where: {
        id: params.data.deviceId,
        userId: user.id,
        revokedAt: null,
      },
    })

    if (!device) {
      return reply.code(404).send({ error: 'Устройство не найдено' })
    }

    await prisma.extensionSession.update({
      where: { id: device.id },
      data: { revokedAt: new Date() },
    })

    return { message: 'Устройство отключено', revoked: 1 }
  })

  app.get('/history', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const history = await prisma.connectionHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    return { history }
  })

  app.get('/referral', async (request, reply) => {
    const user = await getSessionUser(request)

    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        referralCode: true,
        _count: { select: { referrals: true } },
      },
    })

    if (!dbUser) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const rewards = await prisma.referralReward.findMany({
      where: { referrerUserId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        daysGranted: true,
        status: true,
        grantedAt: true,
        createdAt: true,
        referred: { select: { email: true } },
      },
    })

    const webAppUrl = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    const pendingCount = rewards.filter((item) => item.status === 'PENDING').length
    const grantedCount = rewards.filter((item) => item.status === 'GRANTED').length

    return {
      code: dbUser.referralCode,
      inviteUrl: `${webAppUrl}/auth?mode=register&ref=${dbUser.referralCode}`,
      invitedCount: dbUser._count.referrals,
      daysPerInvite: Number(process.env.REFERRAL_REWARD_DAYS || 7),
      pendingCount,
      grantedCount,
      rewardHint: 'Бонус начисляется после того, как приглашённый войдёт в расширение или оплатит Premium.',
      rewards: rewards.map((item) => ({
        id: item.id,
        daysGranted: item.daysGranted,
        status: item.status,
        grantedAt: item.grantedAt,
        createdAt: item.createdAt,
        email: item.referred.email.replace(/(^.).*(@.*$)/, '$1***$2'),
      })),
    }
  })

  app.get('/notices', async (request, reply) => {
    const user = await getSessionUser(request)
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const [subscription, devices, pendingOrder, overviewDevices, latestExt] = await Promise.all([
      getActiveSubscription(user.id),
      prisma.extensionSession.count({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      prisma.order.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      getActiveSubscription(user.id).then(async (sub) => {
        const plan = sub
          ? await prisma.subscription.findUnique({
              where: { id: sub.id },
              include: { plan: true },
            })
          : null
        return plan?.plan.deviceLimit ?? 1
      }),
      prisma.extensionSession.findFirst({
        where: { userId: user.id },
        orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
        select: { lastUsedAt: true, createdAt: true },
      }),
    ])

    const notices: Array<{ id: string; level: 'info' | 'warning' | 'critical'; title: string; text: string; href?: string }> = []

    if (user.impersonatedBy) {
      notices.push({
        id: 'impersonation',
        level: 'warning',
        title: 'Режим просмотра саппорта',
        text: 'Вы смотрите кабинет от имени пользователя. Оплата и смена пароля недоступны.',
        href: '/app',
      })
    }

    if (!user.emailVerifiedAt) {
      notices.push({
        id: 'email-verify',
        level: 'info',
        title: 'Подтвердите email',
        text: 'Так проще восстановить доступ и получать важные письма.',
        href: '/app/settings',
      })
    }

    if (!user.vpnAccount?.subscriptionUrl) {
      notices.push({
        id: 'vpn-link',
        level: 'warning',
        title: 'Нет VPN-ссылки',
        text: 'Получите ссылку подписки для телефона и TV.',
        href: '/app/vpn',
      })
    } else if (user.vpnAccount && user.vpnAccount.isProvisioned === false) {
      notices.push({
        id: 'provision',
        level: 'warning',
        title: 'VPN ещё готовится',
        text: 'Обновите ссылку через минуту или откройте раздел VPN.',
        href: '/app/vpn',
      })
    }

    if (devices === 0) {
      notices.push({
        id: 'extension-offline',
        level: 'warning',
        title: 'Расширение не залогинено',
        text: 'Откройте popup jetsale.online и войдите тем же email — кабинет увидит сессию.',
        href: '/install',
      })
    } else {
      const last = latestExt?.lastUsedAt || latestExt?.createdAt
      if (last && Date.now() - new Date(last).getTime() > 36 * 60 * 60 * 1000) {
        notices.push({
          id: 'extension-stale',
          level: 'warning',
          title: 'Расширение давно не выходило в сеть',
          text: 'Откройте popup и войдите / нажмите «Подключить» — так кабинет обновит статус.',
          href: '/install',
        })
      }
    }

    const deviceLimit = overviewDevices
    if (devices > deviceLimit) {
      notices.push({
        id: 'device-limit',
        level: 'critical',
        title: 'Превышен лимит устройств',
        text: `Активно ${devices} из ${deviceLimit}. Отключите лишние сессии.`,
        href: '/app/devices',
      })
    }

    if (subscription?.isTrial && subscription.expiresAt) {
      const remainingMs = subscription.expiresAt.getTime() - Date.now()
      if (remainingMs > 0 && remainingMs <= 86400000) {
        notices.push({
          id: 'trial-ending-1d',
          level: 'critical',
          title: 'Trial заканчивается сегодня',
          text: 'Осталось меньше суток. Оформите Premium, чтобы не потерять полный интернет.',
          href: '/app/subscription',
        })
      } else if (remainingMs > 0 && remainingMs <= 3 * 86400000) {
        notices.push({
          id: 'trial-ending-3d',
          level: 'warning',
          title: 'Trial закончится через 1–3 дня',
          text: 'Мы также отправим письмо на email. Продлите доступ заранее.',
          href: '/app/subscription',
        })
      }
    }

    if (subscription && !subscription.isTrial && subscription.expiresAt) {
      const remainingMs = subscription.expiresAt.getTime() - Date.now()
      if (remainingMs > 0 && remainingMs <= 86400000) {
        notices.push({
          id: 'premium-ending-1d',
          level: 'critical',
          title: 'Premium заканчивается сегодня',
          text: 'Продлите подписку, чтобы не потерять доступ.',
          href: '/app/subscription',
        })
      } else if (remainingMs > 0 && remainingMs <= 3 * 86400000) {
        notices.push({
          id: 'premium-ending-3d',
          level: 'warning',
          title: 'Premium скоро закончится',
          text: 'Продлите заранее — письмо-напоминание тоже придёт на email.',
          href: '/app/subscription',
        })
      }
    }

    if (pendingOrder) {
      notices.push({
        id: 'pending-pay',
        level: 'info',
        title: 'Оплата обрабатывается',
        text: 'Если Premium не появился — обновите страницу подписки через минуту.',
        href: '/app/subscription',
      })
    }

    return { notices }
  })

  app.get('/web-sessions', async (request, reply) => {
    const user = await getSessionUser(request)
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const token = request.cookies?.[COOKIE_NAME]
    const currentHash = token ? hashToken(token) : null

    const sessions = await prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, createdAt: true, expiresAt: true, tokenHash: true },
    })

    return {
      sessions: sessions.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        current: currentHash === item.tokenHash,
      })),
    }
  })

  app.post('/web-sessions/:sessionId/revoke', async (request, reply) => {
    const user = await getSessionUser(request)
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (rejectIfImpersonating(user, reply)) return

    const params = z.object({ sessionId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'Некорректный sessionId' })
    }

    const result = await prisma.session.deleteMany({
      where: { id: params.data.sessionId, userId: user.id },
    })

    return { message: result.count ? 'Сессия завершена' : 'Сессия не найдена', revoked: result.count }
  })

  app.post('/web-sessions/revoke-others', async (request, reply) => {
    const user = await getSessionUser(request)
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (rejectIfImpersonating(user, reply)) return

    const token = request.cookies?.[COOKIE_NAME]
    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const result = await prisma.session.deleteMany({
      where: {
        userId: user.id,
        tokenHash: { not: hashToken(token) },
      },
    })

    return { message: `Завершено сессий: ${result.count}`, revoked: result.count }
  })

  /** Sign out everywhere except current browser session: other web + all extension devices. */
  app.post('/security/logout-everywhere', async (request, reply) => {
    const user = await getSessionUser(request)
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }
    if (rejectIfImpersonating(user, reply)) return

    const token = request.cookies?.[COOKIE_NAME]
    if (!token) {
      return reply.code(401).send({ error: 'Требуется авторизация' })
    }

    const [web, ext] = await prisma.$transaction([
      prisma.session.deleteMany({
        where: {
          userId: user.id,
          tokenHash: { not: hashToken(token) },
        },
      }),
      prisma.extensionSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    return {
      message: `Вышли везде: сайт ${web.count}, расширение ${ext.count}. Текущий браузер остаётся.`,
      revokedWeb: web.count,
      revokedExtension: ext.count,
    }
  })
}

export default accountRoutes
