import { prisma } from './prisma.js'

export type PublicStatusOverride = {
  /** null / omit = auto from probes */
  mode: 'auto' | 'operational' | 'degraded' | 'major_outage'
  message?: string | null
}

const PUBLIC_STATUS_KEY = 'public_status'

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  if (!row) return null
  return row.value as T
}

export async function setSetting<T>(
  key: string,
  value: T,
  updatedBy?: string | null,
) {
  return prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: value as object,
      updatedBy: updatedBy ?? null,
    },
    update: {
      value: value as object,
      updatedBy: updatedBy ?? null,
    },
  })
}

export async function getPublicStatusOverride(): Promise<PublicStatusOverride> {
  const raw = await getSetting<PublicStatusOverride>(PUBLIC_STATUS_KEY)
  if (!raw || typeof raw !== 'object') {
    return { mode: 'auto', message: null }
  }
  const mode = raw.mode
  if (mode !== 'auto' && mode !== 'operational' && mode !== 'degraded' && mode !== 'major_outage') {
    return { mode: 'auto', message: null }
  }
  return {
    mode,
    message: typeof raw.message === 'string' ? raw.message : null,
  }
}

export async function setPublicStatusOverride(
  input: PublicStatusOverride,
  updatedBy?: string | null,
) {
  return setSetting(PUBLIC_STATUS_KEY, {
    mode: input.mode,
    message: input.message?.trim() || null,
  }, updatedBy)
}
