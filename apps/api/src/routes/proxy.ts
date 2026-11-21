import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { getActiveSubscription } from '../lib/subscription.js'
import {
  decryptProxyPassword,
  encryptProxyPassword,
} from '../lib/proxy-crypto.js'
import {
  createProxyUser,
  generateProxyPassword,
  generateProxyUsername,
} from '../lib/proxy-manager.js'
import { ensureRemnawaveProvisioned } from '../lib/vpn-provision.js'
import { getEnabledExtensionNode } from '../lib/extension-nodes.js'

function getBearerToken(authorization?: string) {
  if (!authorization) return null
  const match = authorization.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

const proxyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/proxy', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return reply.code(401).send({ code: 'UNAUTHORIZED' })
    }

    const session = await prisma.extensionSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: { vpnAccount: true },
        },
      },
    })

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ code: 'INVALID_SESSION' })
    }

    if (session.user.status !== 'ACTIVE') {
      return reply.code(403).send({ code: 'ACCOUNT_DISABLED' })
    }

    const query = request.query as { serverId?: string; mode?: string }
    const mode = query.mode === 'youtube' ? 'youtube' : 'full'

    if (mode === 'full') {
      const subscription = await getActiveSubscription(session.user.id)

      if (!subscription) {
        return reply.code(403).send({
          code: 'SUBSCRIPTION_REQUIRED',
        })
      }
    }

    const serverId = query.serverId?.trim()
    if (!serverId) {
      return reply.code(400).send({
        code: 'PROXY_NOT_CONFIGURED',
        message: 'Выберите локацию в расширении',
      })
    }

    const node = await getEnabledExtensionNode(serverId)
    if (!node || !node.hostname?.trim()) {
      return reply.code(400).send({
        code: 'PROXY_NOT_CONFIGURED',
        message: 'Эта локация выключена в админке или не задан proxy host',
      })
    }

    const account = session.user.vpnAccount

    if (!account) {
      return reply.code(404).send({
        code: 'VPN_ACCOUNT_NOT_FOUND',
      })
    }

    await ensureRemnawaveProvisioned(session.user.id).catch((error) => {
      request.log.error(error)
    })

    let username = account.proxyUsername
    let password: string

    if (
      account.proxyProvisioned &&
      account.proxyUsername &&
      account.proxyPasswordEncrypted
    ) {
      password = decryptProxyPassword(account.proxyPasswordEncrypted)
    } else {
      username = generateProxyUsername(session.user.id)
      password = generateProxyPassword()

      try {
        await createProxyUser(username, password)
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: string }).code)
            : null
        const message = error instanceof Error ? error.message : 'Не удалось создать proxy-учётку'
        request.log.error(error)
        return reply.code(503).send({
          code: code === 'PROXY_MANAGER_MISSING' ? 'PROXY_MANAGER_MISSING' : 'PROXY_PROVISION_FAILED',
          message:
            code === 'PROXY_MANAGER_MISSING'
              ? message
              : 'Сервис прокси временно недоступен. Попробуйте позже или напишите в поддержку.',
        })
      }

      try {
        await prisma.vpnAccount.update({
          where: { id: account.id },
          data: {
            proxyUsername: username,
            proxyPasswordEncrypted: encryptProxyPassword(password),
            proxyProvisioned: true,
          },
        })
      } catch (error) {
        try {
          const { deleteProxyUser } = await import('../lib/proxy-manager.js')
          await deleteProxyUser(username)
        } catch {
          // Provisioning cleanup can be retried separately.
        }
        request.log.error(error)
        return reply.code(503).send({
          code: 'PROXY_PROVISION_FAILED',
          message: 'Не удалось сохранить доступ к прокси. Попробуйте ещё раз.',
        })
      }
    }

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    return {
      proxy: {
        scheme: 'https',
        host: node.hostname.trim(),
        port: node.port || 8443,
        username,
        password,
      },
      server: {
        id: node.remnawaveNodeUuid,
        name: node.name,
        country: node.countryName,
      },
    }
  })
}

export default proxyRoutes
