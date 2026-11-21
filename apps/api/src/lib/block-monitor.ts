import { createConnection } from 'node:net'
import { lookup } from 'node:dns/promises'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

type ProbeKind = 'proxy' | 'panel' | 'sub' | 'custom'

type ProbeOutcome = {
  key: string
  label: string
  host: string
  port: number
  kind: ProbeKind
  ok: boolean
  ip: string | null
  latencyMs: number | null
  blocked: boolean | null
  error: string | null
}

type AntifilterCache = {
  fetchedAt: number
  cidrs: Array<{ network: number; mask: number }>
  rawCount: number
}

let antifilterCache: AntifilterCache | null = null
const ANTIFILTER_TTL_MS = 6 * 60 * 60 * 1000
const ANTIFILTER_URLS = [
  'https://antifilter.download/list/ipsum.list',
  'https://antifilter.download/list/ally.list',
]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function parseCidr(line: string): { network: number; mask: number } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  if (trimmed.includes('/')) {
    const [ip, bitsRaw] = trimmed.split('/')
    const ipInt = ipv4ToInt(ip)
    const bits = Number(bitsRaw)
    if (ipInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return { network: (ipInt & mask) >>> 0, mask }
  }

  const ipInt = ipv4ToInt(trimmed)
  if (ipInt == null) return null
  return { network: ipInt, mask: 0xffffffff }
}

async function loadAntifilterLists(): Promise<AntifilterCache> {
  if (antifilterCache && Date.now() - antifilterCache.fetchedAt < ANTIFILTER_TTL_MS) {
    return antifilterCache
  }

  const cidrs: Array<{ network: number; mask: number }> = []
  let rawCount = 0

  for (const url of ANTIFILTER_URLS) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/plain', 'User-Agent': 'jetsale.online-block-monitor/1.0' },
        signal: AbortSignal.timeout(25000),
      })
      if (!response.ok) continue
      const text = await response.text()
      for (const line of text.split(/\r?\n/)) {
        const parsed = parseCidr(line)
        if (!parsed) continue
        cidrs.push(parsed)
        rawCount += 1
      }
    } catch {
      /* try next source */
    }
  }

  antifilterCache = {
    fetchedAt: Date.now(),
    cidrs,
    rawCount,
  }
  return antifilterCache
}

export async function isIpLikelyBlockedInRu(ip: string): Promise<{ blocked: boolean; listSize: number }> {
  const ipInt = ipv4ToInt(ip)
  if (ipInt == null) return { blocked: false, listSize: 0 }

  try {
    const list = await loadAntifilterLists()
    if (list.cidrs.length === 0) return { blocked: false, listSize: 0 }

    for (const cidr of list.cidrs) {
      if ((ipInt & cidr.mask) >>> 0 === cidr.network) {
        return { blocked: true, listSize: list.rawCount }
      }
    }
    return { blocked: false, listSize: list.rawCount }
  } catch {
    return { blocked: false, listSize: 0 }
  }
}

function tcpProbe(host: string, port: number, timeoutMs = 5000): Promise<{ ok: boolean; latencyMs: number; error: string | null }> {
  const started = Date.now()
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    let settled = false

    const finish = (ok: boolean, error: string | null) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ ok, latencyMs: Date.now() - started, error })
    }

    socket.setTimeout(timeoutMs)
    socket.on('connect', () => finish(true, null))
    socket.on('timeout', () => finish(false, 'timeout'))
    socket.on('error', (err) => finish(false, err.message))
  })
}

async function resolveIpv4(host: string): Promise<string | null> {
  try {
    const result = await lookup(host, { family: 4 })
    return result.address
  } catch {
    return null
  }
}

function defaultTargets(): Array<{ key: string; label: string; host: string; port: number; kind: ProbeKind }> {
  const proxyHost = process.env.PROXY_PUBLIC_HOST || 'rassiya.jetsale.online'
  const proxyPort = Number(process.env.PROXY_PUBLIC_PORT || 8443)
  const panelHost = (process.env.REMWAVE_BASE_URL || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '') || 'panel.jetsale.online'
  const subHost = (process.env.REMWAVE_SUB_PUBLIC_DOMAIN || 'node.jetsale.online')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')

  return [
    { key: 'proxy', label: 'jetsale.online Proxy', host: proxyHost, port: proxyPort, kind: 'proxy' },
    { key: 'panel', label: 'Remnawave Panel', host: panelHost, port: 443, kind: 'panel' },
    { key: 'sub', label: 'Subscription page', host: subHost, port: 443, kind: 'sub' },
  ]
}

async function upsertTargetsFromDefaults() {
  const defaults = defaultTargets()
  for (const target of defaults) {
    await prisma.probeTarget.upsert({
      where: { key: target.key },
      create: {
        key: target.key,
        label: target.label,
        host: target.host,
        port: target.port,
        kind: target.kind,
        isActive: true,
      },
      update: {
        label: target.label,
        host: target.host,
        port: target.port,
        kind: target.kind,
      },
    })
  }
}

async function openOrUpdateAlert(input: {
  type: string
  target: string
  title: string
  message: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  meta?: Prisma.InputJsonValue
}) {
  const existing = await prisma.adminAlert.findFirst({
    where: {
      type: input.type,
      target: input.target,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existing) {
    await prisma.adminAlert.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        message: input.message,
        severity: input.severity,
        meta: input.meta ?? undefined,
      },
    })
    return { created: false, id: existing.id }
  }

  const created = await prisma.adminAlert.create({
    data: {
      type: input.type,
      target: input.target,
      title: input.title,
      message: input.message,
      severity: input.severity,
      status: 'OPEN',
      meta: input.meta ?? undefined,
    },
  })
  return { created: true, id: created.id }
}

async function resolveAlert(type: string, target: string) {
  await prisma.adminAlert.updateMany({
    where: {
      type,
      target,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  })
}

export async function runBlockMonitor(): Promise<{
  checkedAt: string
  probes: ProbeOutcome[]
  alertsCreated: number
  antifilterSize: number
}> {
  await upsertTargetsFromDefaults()

  const targets = await prisma.probeTarget.findMany({
    where: { isActive: true },
    orderBy: { key: 'asc' },
  })

  const probes: ProbeOutcome[] = []
  let alertsCreated = 0
  let antifilterSize = 0

  for (const target of targets) {
    const ip = await resolveIpv4(target.host)
    const tcp = await tcpProbe(target.host, target.port)
    let blocked: boolean | null = null

    if (ip) {
      const block = await isIpLikelyBlockedInRu(ip)
      blocked = block.blocked
      antifilterSize = Math.max(antifilterSize, block.listSize)
    }

    const ok = tcp.ok
    const outcome: ProbeOutcome = {
      key: target.key,
      label: target.label,
      host: target.host,
      port: target.port,
      kind: target.kind as ProbeKind,
      ok,
      ip,
      latencyMs: tcp.latencyMs,
      blocked,
      error: tcp.error,
    }
    probes.push(outcome)

    await prisma.probeTarget.update({
      where: { id: target.id },
      data: {
        lastStatus: ok ? (blocked ? 'blocked' : 'ok') : 'down',
        lastIp: ip,
        lastLatencyMs: tcp.latencyMs,
        lastBlocked: blocked,
        lastError: tcp.error,
        lastCheckedAt: new Date(),
      },
    })

    const targetKey = `${target.host}:${target.port}`

    if (!ok) {
      const result = await openOrUpdateAlert({
        type: 'server_down',
        target: targetKey,
        title: `${target.label} недоступен`,
        message: `Хост ${target.host}:${target.port} не отвечает (${tcp.error || 'error'}). IP: ${ip || '—'}`,
        severity: target.kind === 'proxy' ? 'CRITICAL' : 'WARNING',
        meta: { ...outcome } as Prisma.InputJsonValue,
      })
      if (result.created) alertsCreated += 1
    } else {
      await resolveAlert('server_down', targetKey)
    }

    if (blocked) {
      const result = await openOrUpdateAlert({
        type: 'ip_blocked',
        target: targetKey,
        title: `${target.label}: IP в списках блокировок`,
        message: `IP ${ip} хоста ${target.host} найден в antifilter/community blocklists (как в cheburcheck). Возможна блокировка в РФ.`,
        severity: 'CRITICAL',
        meta: { ...outcome, antifilterSize } as Prisma.InputJsonValue,
      })
      if (result.created) alertsCreated += 1
    } else if (blocked === false) {
      await resolveAlert('ip_blocked', targetKey)
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    probes,
    alertsCreated,
    antifilterSize,
  }
}

let monitorTimer: NodeJS.Timeout | null = null

export function startBlockMonitorScheduler(log?: { info: (obj: unknown, msg?: string) => void; error: (err: unknown) => void }) {
  const enabled = process.env.BLOCK_MONITOR !== '0' && process.env.BLOCK_MONITOR !== 'false'
  if (!enabled) {
    log?.info?.({}, 'Block monitor disabled (BLOCK_MONITOR=0)')
    return
  }

  const intervalMs = Number(process.env.BLOCK_MONITOR_INTERVAL_MS || 5 * 60 * 1000)

  const tick = () => {
    runBlockMonitor()
      .then((result) => {
        log?.info?.(
          { probes: result.probes.length, alertsCreated: result.alertsCreated },
          'Block monitor tick',
        )
      })
      .catch((error) => {
        log?.error?.(error)
        console.error('[block-monitor]', error)
      })
  }

  // First run shortly after boot
  setTimeout(tick, 15_000)
  monitorTimer = setInterval(tick, intervalMs)
  monitorTimer.unref?.()
}

export function stopBlockMonitorScheduler() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}
