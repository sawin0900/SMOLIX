import type { FastifyRequest } from 'fastify'
import { createHash } from 'node:crypto'
import { prisma } from './prisma.js'

const COOKIE_NAME = 'smolix_session'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getSessionUser(request: FastifyRequest) {
  const token = request.cookies?.[COOKIE_NAME]

  if (!token) return null

  // Reject oversized / malformed cookies early
  if (token.length < 20 || token.length > 200) return null

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

  if (!session) return null

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({
      where: { id: session.id },
    }).catch(() => undefined)
    return null
  }

  if (session.user.status !== 'ACTIVE') {
    await prisma.session.deleteMany({ where: { userId: session.userId } }).catch(() => undefined)
    await prisma.extensionSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }).catch(() => undefined)
    return null
  }

  return {
    ...session.user,
    sessionId: session.id,
    impersonatedBy: session.impersonatedBy,
  }
}

export { COOKIE_NAME, hashToken }
