import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma.js'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createImpersonationToken(actorId: string, targetUserId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await prisma.impersonationToken.create({
    data: {
      tokenHash: hashToken(token),
      targetUserId,
      actorId,
      expiresAt,
    },
  })
  return { token, expiresAt }
}

export async function consumeImpersonationToken(rawToken: string) {
  const row = await prisma.impersonationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  })
  if (!row || row.usedAt || row.expiresAt <= new Date()) {
    return null
  }
  await prisma.impersonationToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  })
  return row
}
