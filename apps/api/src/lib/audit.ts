import { prisma } from './prisma.js'

type AuditInput = {
  actorId: string
  actorEmail: string
  action: string
  targetType?: string
  targetId?: string
  meta?: Record<string, unknown>
}

export async function writeAdminAudit(input: AuditInput) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        actorEmail: input.actorEmail.slice(0, 254),
        action: input.action.slice(0, 64),
        targetType: input.targetType?.slice(0, 64),
        targetId: input.targetId?.slice(0, 64),
        meta: input.meta ? (input.meta as object) : undefined,
      },
    })
  } catch (error) {
    console.error('[audit]', error)
  }
}

export function generateSupportCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'SMX'
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export async function ensureSupportCode(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, supportCode: true },
  })
  if (!user) return null
  if (user.supportCode) return user.supportCode

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateSupportCode()
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { supportCode: code },
        select: { supportCode: true },
      })
      return updated.supportCode
    } catch {
      /* unique collision */
    }
  }
  return null
}
