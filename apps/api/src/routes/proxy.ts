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

const RUSSIA_NODE_ID = '3a20c063-8cdc-4d0f-9e82-67939df3e66e'

const PROXY_HOST = 'rassiya.jetsale.online'
const PROXY_PORT = 8443

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

    if (query.serverId !== RUSSIA_NODE_ID) {
      return reply.code(400).send({
        code: 'PROXY_NOT_CONFIGURED',
        message: 'Proxy is currently available only in Russia',
      })
    }

    const account = session.user.vpnAccount

    if (!account) {
      return reply.code(404).send({
        code: 'VPN_ACCOUNT_NOT_FOUND',
      })
    }

    // Keep Remnawave panel user in sync (expireAt / squad) when proxy is requested
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

      await createProxyUser(username, password)

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
        throw error
      }
    }

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    return {
      proxy: {
        scheme: 'https',
        host: PROXY_HOST,
        port: PROXY_PORT,
        username,
        password,
      },
    }
  })
}

export default proxyRoutes
