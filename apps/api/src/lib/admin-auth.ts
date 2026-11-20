import type { FastifyReply, FastifyRequest } from 'fastify'
import { getSessionUser } from './session.js'
import { clientIp } from './security.js'

export type AdminActor = {
  id: string
  email: string
  role: 'ADMIN' | 'SUPPORT' | 'USER'
  status: string
}

export async function requireStaff(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AdminActor | null> {
  const user = await getSessionUser(request)
  if (!user) {
    reply.code(401).send({ error: 'Требуется авторизация' })
    return null
  }
  if (user.role !== 'ADMIN' && user.role !== 'SUPPORT') {
    reply.code(403).send({ error: 'Недостаточно прав' })
    return null
  }

  const allow = (process.env.ADMIN_ALLOWED_IPS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (allow.length > 0) {
    const ip = clientIp(request)
    if (!allow.includes(ip)) {
      reply.code(403).send({ error: 'Доступ с этого IP запрещён' })
      return null
    }
  }

  return user as AdminActor
}

export async function requireAdminOnly(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AdminActor | null> {
  const user = await requireStaff(request, reply)
  if (!user) return null
  if (user.role !== 'ADMIN') {
    reply.code(403).send({ error: 'Только для ADMIN' })
    return null
  }
  return user
}

export function isDestructiveAllowed(role: string) {
  return role === 'ADMIN'
}
