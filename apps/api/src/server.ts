import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import dotenv from 'dotenv'
import { prisma } from './lib/prisma.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/account.js'
import extensionRoutes from './routes/extension.js'
import proxyRoutes from './routes/proxy.js'
import adminRoutes from './routes/admin.js'
import marketingRoutes from './routes/marketing.js'
import billingRoutes from './routes/billing.js'
import statusRoutes from './routes/status.js'
import {
  getAllowedWebOrigins,
  isAllowedOrigin,
  isProduction,
} from './lib/security.js'
import { startBlockMonitorScheduler } from './lib/block-monitor.js'

dotenv.config()

const app = Fastify({
  logger: true,
  bodyLimit: 32 * 1024,
  trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
  requestTimeout: 30_000,
  connectionTimeout: 10_000,
  maxParamLength: 200,
  // Do not expose internals in production error replies
  disableRequestLogging: false,
})

const allowedOrigins = getAllowedWebOrigins()

await app.register(cors, {
  origin: (origin, callback) => {
    // Non-browser / same-origin tooling may omit Origin
    if (!origin) {
      callback(null, true)
      return
    }

    if (isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin is not allowed'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600,
})

app.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  reply.header('Cross-Origin-Opener-Policy', 'same-origin')
  reply.header('Cross-Origin-Resource-Policy', 'same-site')
  reply.header('X-DNS-Prefetch-Control', 'off')
  reply.header('Cache-Control', 'no-store')

  if (isProduction()) {
    reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // Never leak stack traces to clients
  if (reply.statusCode >= 500 && typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as { error?: string; message?: string; stack?: string }
      if (parsed.stack) {
        delete parsed.stack
        return JSON.stringify({ error: parsed.error || parsed.message || 'Внутренняя ошибка сервера' })
      }
    } catch {
      /* keep payload */
    }
  }

  return payload
})

app.addHook('onRequest', async (request, reply) => {
  // Block obviously malicious paths early
  const url = request.url.split('?')[0] || ''
  if (
    url.includes('..') ||
    url.includes('%2e%2e') ||
    url.includes('\\') ||
    /\/(wp-admin|wp-login|phpmyadmin|\.env|\.git)/i.test(url)
  ) {
    return reply.code(404).send({ error: 'Not found' })
  }

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return

  // YooKassa webhook has no browser Origin — allow by path
  if (request.url.startsWith('/billing/webhook/')) return

  const origin = request.headers.origin
  const hasBearer = Boolean(request.headers.authorization?.toLowerCase().startsWith('bearer '))

  // Browser cookie CSRF: require allowlisted Origin when Origin is present
  if (origin && !isAllowedOrigin(origin)) {
    return reply.code(403).send({
      error: 'Запрос отклонён: недопустимый источник',
    })
  }

  // In production, mutating cookie-auth requests without Origin are suspicious
  // (except extension Bearer flows which often still send chrome-extension Origin)
  if (isProduction() && !origin && !hasBearer) {
    const referer = request.headers.referer || request.headers.referrer
    if (typeof referer === 'string') {
      try {
        const refOrigin = new URL(referer).origin
        if (!isAllowedOrigin(refOrigin)) {
          return reply.code(403).send({ error: 'Запрос отклонён: недопустимый источник' })
        }
        return
      } catch {
        return reply.code(403).send({ error: 'Запрос отклонён: недопустимый источник' })
      }
    }
    return reply.code(403).send({ error: 'Запрос отклонён: отсутствует Origin' })
  }
})

await app.register(cookie, {
  // Defense in depth for cookie parsing
  parseOptions: {},
})

await app.register(rateLimit, {
  global: true,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 200),
  timeWindow: process.env.RATE_LIMIT_GLOBAL_WINDOW || '1 minute',
  ban: 0,
  allowList: (request) => {
    // Health for LB probes — still limited lightly via own handlers if needed
    return request.url === '/health'
  },
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Слишком много запросов. Подождите немного.',
  }),
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
})

await app.register(authRoutes, {
  prefix: '/auth',
})

await app.register(accountRoutes, {
  prefix: '/account',
})

await app.register(extensionRoutes, {
  prefix: '/extension',
})

await app.register(proxyRoutes, {
  prefix: '/extension',
})

await app.register(adminRoutes, {
  prefix: '/admin',
})

await app.register(marketingRoutes, {
  prefix: '/marketing',
})

await app.register(billingRoutes, {
  prefix: '/billing',
})

await app.register(statusRoutes, {
  prefix: '/status',
})

function requireInternalHealthKey(request: { headers: Record<string, unknown> }, reply: {
  code: (n: number) => { send: (body: unknown) => unknown }
  sent?: boolean
}) {
  const key = process.env.INTERNAL_HEALTH_KEY
  if (!key) {
    if (isProduction()) {
      reply.code(404).send({ error: 'Not found' })
      return false
    }
    return true
  }

  const provided = request.headers['x-health-key']
  if (provided !== key) {
    reply.code(404).send({ error: 'Not found' })
    return false
  }
  return true
}

app.get('/remnawave-health', async (request, reply) => {
  if (!requireInternalHealthKey(request, reply)) return

  try {
    const { getAccessibleNodes } = await import('./lib/remnawave.js')
    const nodes = await getAccessibleNodes()

    return {
      status: 'ok',
      remnawave: 'connected',
      nodesCount: nodes.length,
    }
  } catch (error) {
    request.log.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Remnawave connection check failed',
    )

    return reply.code(503).send({
      status: 'error',
      remnawave: 'unavailable',
    })
  }
})

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'SMOLIX API',
    timestamp: new Date().toISOString(),
  }
})

app.get('/db-health', async (request, reply) => {
  if (!requireInternalHealthKey(request, reply)) return

  try {
    await prisma.$queryRaw`SELECT 1`

    return {
      status: 'ok',
      database: 'connected',
    }
  } catch (error) {
    app.log.error(error)

    return reply.code(503).send({
      status: 'error',
      database: 'disconnected',
    })
  }
})

app.get('/', async () => {
  return {
    name: 'SMOLIX API',
    status: 'ok',
  }
})

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).send({ error: 'Not found' })
})

app.setErrorHandler(async (error, request, reply) => {
  if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode?: number }).statusCode === 429) {
    return reply.code(429).send({ error: 'Слишком много запросов. Подождите немного.' })
  }

  // CORS rejection from @fastify/cors
  if (error instanceof Error && error.message === 'Origin is not allowed') {
    return reply.code(403).send({ error: 'Запрос отклонён: недопустимый источник' })
  }

  request.log.error(error)

  const statusCode =
    error && typeof error === 'object' && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500

  if (statusCode >= 500) {
    return reply.code(500).send({ error: 'Внутренняя ошибка сервера' })
  }

  return reply.code(statusCode).send({
    error: error instanceof Error ? error.message : 'Ошибка запроса',
  })
})

const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || (isProduction() ? '127.0.0.1' : '127.0.0.1')

if (isProduction()) {
  if (!process.env.ALLOWED_ORIGINS) {
    app.log.warn('ALLOWED_ORIGINS is missing in production')
  }
  if (!process.env.ALLOWED_EXTENSION_IDS) {
    app.log.warn('ALLOWED_EXTENSION_IDS is empty — Chrome extension CORS will be denied in production')
  }
  app.log.info({ webOrigins: allowedOrigins.length }, 'Security allowlists loaded')
}

try {
  await app.listen({
    port,
    host,
  })
  startBlockMonitorScheduler(app.log)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
