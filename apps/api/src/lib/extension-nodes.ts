import { prisma } from './prisma.js'
import {
  getAccessibleNodes,
  SUPPORTED_PROXY_NODE_UUID,
} from './remnawave.js'

const COUNTRY_NAMES: Record<string, string> = {
  US: 'США',
  CA: 'Канада',
  RU: 'Россия',
  DE: 'Германия',
  NL: 'Нидерланды',
  FI: 'Финляндия',
  SE: 'Швеция',
  PL: 'Польша',
  LV: 'Латвия',
  LT: 'Литва',
  EE: 'Эстония',
  GB: 'Великобритания',
  FR: 'Франция',
  TR: 'Турция',
  KZ: 'Казахстан',
  SG: 'Сингапур',
  JP: 'Япония',
  KR: 'Южная Корея',
  AE: 'ОАЭ',
  IL: 'Израиль',
  CZ: 'Чехия',
  AT: 'Австрия',
  CH: 'Швейцария',
  IT: 'Италия',
  ES: 'Испания',
}

function defaultProxyHost() {
  return (process.env.PROXY_PUBLIC_HOST || 'rassiya.jetsale.online').trim()
}

function defaultProxyPort() {
  const n = Number(process.env.PROXY_PUBLIC_PORT || 8443)
  return Number.isFinite(n) && n > 0 ? n : 8443
}

export function countryNameForCode(code: string) {
  return COUNTRY_NAMES[code] ?? code
}

/** Upsert Remnawave squad nodes into ExtensionNode; preserves admin toggles. */
export async function syncExtensionNodesFromRemnawave() {
  const nodes = await getAccessibleNodes()
  const proxyHost = defaultProxyHost()
  const proxyPort = defaultProxyPort()
  let created = 0
  let updated = 0

  for (const [index, node] of nodes.entries()) {
    const countryName = countryNameForCode(node.countryCode)
    const isDefaultProxy = node.uuid === SUPPORTED_PROXY_NODE_UUID
    const existing = await prisma.extensionNode.findUnique({
      where: { remnawaveNodeUuid: node.uuid },
    })

    if (!existing) {
      await prisma.extensionNode.create({
        data: {
          remnawaveNodeUuid: node.uuid,
          name: node.nodeName || countryName,
          countryCode: node.countryCode,
          countryName,
          hostname: isDefaultProxy ? proxyHost : null,
          port: proxyPort,
          isEnabled: isDefaultProxy,
          sortOrder: index,
        },
      })
      created += 1
      continue
    }

    await prisma.extensionNode.update({
      where: { id: existing.id },
      data: {
        name: node.nodeName || existing.name,
        countryCode: node.countryCode,
        countryName,
        sortOrder: index,
        // Keep admin hostname/enabled; only fill hostname for default proxy if empty
        ...(isDefaultProxy && !existing.hostname
          ? { hostname: proxyHost, port: existing.port || proxyPort }
          : {}),
      },
    })
    updated += 1
  }

  return { created, updated, total: nodes.length, nodes }
}

export async function listExtensionNodes() {
  return prisma.extensionNode.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

/** Nodes visible in Chrome extension for all accounts. */
export async function listEnabledExtensionServers() {
  const rows = await prisma.extensionNode.findMany({
    where: {
      isEnabled: true,
      hostname: { not: null },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return rows
    .filter((row) => Boolean(row.hostname?.trim()))
    .map((row) => ({
      id: row.remnawaveNodeUuid,
      name: row.name,
      country: row.countryName,
      countryCode: row.countryCode,
      city: null as string | null,
      hostname: row.hostname!,
      port: row.port,
      chromeProxySupported: true,
    }))
}

export async function getEnabledExtensionNode(remnawaveNodeUuid: string) {
  const row = await prisma.extensionNode.findUnique({
    where: { remnawaveNodeUuid },
  })
  if (!row || !row.isEnabled || !row.hostname?.trim()) return null
  return row
}
