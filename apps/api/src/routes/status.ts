import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getAccessibleNodes } from '../lib/remnawave.js'
import { isYooKassaConfigured } from '../lib/yookassa.js'
import { getPublicStatusOverride } from '../lib/system-settings.js'

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    const started = Date.now()

    let database: 'ok' | 'error' = 'ok'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'error'
    }

    let remnawave: 'ok' | 'error' = 'ok'
    let nodesCount = 0
    try {
      const nodes = await getAccessibleNodes()
      nodesCount = nodes.length
    } catch {
      remnawave = 'error'
    }

    const servers = await prisma.server.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        isActive: true,
      },
    })

    const computed =
      database === 'ok' && remnawave === 'ok'
        ? 'operational'
        : database === 'error'
          ? 'major_outage'
          : 'degraded'

    const override = await getPublicStatusOverride().catch(() => ({
      mode: 'auto' as const,
      message: null as string | null,
    }))

    const overall =
      override.mode === 'auto' ? computed : override.mode

    return {
      status: overall,
      computedStatus: computed,
      overrideMode: override.mode,
      message: override.message || undefined,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      components: [
        { id: 'api', name: 'API', status: 'ok' },
        { id: 'database', name: 'База данных', status: database },
        { id: 'remnawave', name: 'VPN-панель', status: remnawave, meta: { nodesCount } },
        {
          id: 'payments',
          name: 'Оплата',
          status: 'ok',
          meta: { provider: isYooKassaConfigured() ? 'yookassa' : 'mock' },
        },
      ],
      servers: servers.map((server) => ({
        ...server,
        status: server.isActive ? 'ok' : 'error',
      })),
    }
  })
}

export default statusRoutes
