export const REMNAWAVE_SQUAD_UUID =
  process.env.REMWAVE_SQUAD_UUID || 'b73684c7-ce2e-4c3f-9065-fb940578214b'

export const SUPPORTED_PROXY_NODE_UUID =
  process.env.REMWAVE_PROXY_NODE_UUID || '3a20c063-8cdc-4d0f-9e82-67939df3e66e'

export type RemnawaveNode = {
  uuid: string
  nodeName: string
  countryCode: string
  configProfileUuid: string
  configProfileName: string
  activeInbounds: string[]
}

export type RemnawaveUser = {
  id: number
  uuid?: string
  shortUuid: string
  username: string
  status: 'ACTIVE' | 'DISABLED' | 'LIMITED' | 'EXPIRED'
  expireAt: string
  email: string | null
  subscriptionUrl: string
  activeInternalSquads: Array<{ uuid: string; name: string }>
}

/** Prefer UUID for actions when panel returns it; fall back to numeric id. */
export function remnawaveUserRef(user: Pick<RemnawaveUser, 'id' | 'uuid'>) {
  return user.uuid || String(user.id)
}

type RemnawaveApiResponse<T> = {
  response: T
}

function isProvisioningEnabled() {
  if (process.env.REMWAVE_PROVISIONING === '0' || process.env.REMWAVE_PROVISIONING === 'false') {
    return false
  }
  return Boolean(
    process.env.REMWAVE_BASE_URL &&
      process.env.REMWAVE_API_TOKEN &&
      process.env.REMWAVE_TINYAUTH_X_API_KEY,
  )
}

export function isRemnawaveConfigured() {
  return isProvisioningEnabled()
}

async function remnawaveRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.REMWAVE_BASE_URL
  const apiToken = process.env.REMWAVE_API_TOKEN
  const tinyAuthApiKey = process.env.REMWAVE_TINYAUTH_X_API_KEY

  if (!baseUrl || !apiToken || !tinyAuthApiKey) {
    throw new Error('Remnawave environment variables are missing')
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const url = new URL(`/api${path}`, normalizedBaseUrl)

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiToken}`,
      'X-Api-Key': tinyAuthApiKey,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.text()
      detail = body.slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new Error(
      `Remnawave API ${options.method || 'GET'} ${path} failed: ${response.status}${detail ? ` — ${detail}` : ''}`,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function remnawaveUsernameFromUserId(userId: string) {
  const normalized = userId.replace(/-/g, '').toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    throw new Error('Invalid user UUID for Remnawave username')
  }
  return `smx_${normalized}`
}

/**
 * Remnawave subscription page URL:
 * https://<SUB_PUBLIC_DOMAIN>/<shortUuid>
 * Example: https://node.jetsale.online/HWYq2JVpKfk2V1fq
 */
export function getSubscriptionPublicDomain() {
  return (
    process.env.REMWAVE_SUB_PUBLIC_DOMAIN ||
    process.env.SUB_PUBLIC_DOMAIN ||
    'node.jetsale.online'
  )
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}

export function buildSubscriptionUrl(shortUuid: string, fromApi?: string | null) {
  if (fromApi && /^https?:\/\//i.test(fromApi.trim())) {
    return fromApi.trim().replace(/\/+$/, '')
  }
  const cleaned = shortUuid.replace(/^\/+/, '').trim()
  if (!cleaned) {
    throw new Error('shortUuid is required for subscription URL')
  }
  return `https://${getSubscriptionPublicDomain()}/${cleaned}`
}

export async function getAccessibleNodes(): Promise<RemnawaveNode[]> {
  const result = await remnawaveRequest<
    RemnawaveApiResponse<{
      squadUuid: string
      accessibleNodes: RemnawaveNode[]
    }>
  >(`/internal-squads/${REMNAWAVE_SQUAD_UUID}/accessible-nodes`)

  return result.response.accessibleNodes
}

export async function getSystemHealth() {
  return remnawaveRequest<RemnawaveApiResponse<unknown>>('/system/health')
}

export async function getRemnawaveUserByUsername(username: string) {
  const baseUrl = process.env.REMWAVE_BASE_URL
  const apiToken = process.env.REMWAVE_API_TOKEN
  const tinyAuthApiKey = process.env.REMWAVE_TINYAUTH_X_API_KEY

  if (!baseUrl || !apiToken || !tinyAuthApiKey) {
    throw new Error('Remnawave environment variables are missing')
  }

  const url = new URL(
    `/api/users/by-username/${encodeURIComponent(username)}`,
    baseUrl.replace(/\/+$/, ''),
  )

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiToken}`,
      'X-Api-Key': tinyAuthApiKey,
    },
    signal: AbortSignal.timeout(20000),
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Remnawave API GET /users/by-username failed: ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
    )
  }

  const body = (await response.json()) as RemnawaveApiResponse<RemnawaveUser>
  return body.response
}

export async function createRemnawaveUser(input: {
  username: string
  email?: string
  expireAt: Date
  description?: string
}) {
  const payload = {
    username: input.username,
    status: 'ACTIVE' as const,
    email: input.email ?? null,
    expireAt: input.expireAt.toISOString(),
    description: input.description ?? 'SMOLIX',
    trafficLimitStrategy: 'NO_RESET' as const,
    activeInternalSquads: [REMNAWAVE_SQUAD_UUID],
    tag: 'SMOLIX',
  }

  try {
    const result = await remnawaveRequest<RemnawaveApiResponse<RemnawaveUser>>('/users/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return result.response
  } catch (error) {
    // Some panels reject custom tags — retry without tag
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('tag') && !message.includes('400')) {
      throw error
    }

    const { tag: _tag, ...withoutTag } = payload
    const result = await remnawaveRequest<RemnawaveApiResponse<RemnawaveUser>>('/users/', {
      method: 'POST',
      body: JSON.stringify(withoutTag),
    })
    return result.response
  }
}

export async function updateRemnawaveUser(input: {
  id?: number
  username?: string
  expireAt?: Date
  status?: 'ACTIVE' | 'DISABLED'
  email?: string | null
}) {
  const result = await remnawaveRequest<RemnawaveApiResponse<RemnawaveUser>>('/users/', {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.id != null ? { id: input.id } : {}),
      ...(input.username ? { username: input.username } : {}),
      ...(input.expireAt ? { expireAt: input.expireAt.toISOString() } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      activeInternalSquads: [REMNAWAVE_SQUAD_UUID],
    }),
  })

  return result.response
}

export async function extendRemnawaveUser(userRef: string | number, days: number) {
  const result = await remnawaveRequest<RemnawaveApiResponse<RemnawaveUser>>(
    `/users/${userRef}/actions/extend`,
    {
      method: 'POST',
      body: JSON.stringify({ days }),
    },
  )
  return result.response
}

export async function enableRemnawaveUser(userRef: string | number) {
  const result = await remnawaveRequest<RemnawaveApiResponse<RemnawaveUser>>(
    `/users/${userRef}/actions/enable`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  return result.response
}

export async function disableRemnawaveUser(userRef: string | number) {
  const result = await remnawaveRequest<RemnawaveApiResponse<RemnawaveUser>>(
    `/users/${userRef}/actions/disable`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  return result.response
}

export function getRemnawavePanelUrl() {
  const base = (process.env.REMWAVE_BASE_URL || '').replace(/\/+$/, '')
  return base || null
}

export async function getRemnawaveOverview() {
  const panelUrl = getRemnawavePanelUrl()
  const started = Date.now()
  const configured = isRemnawaveConfigured()

  const subPublicDomain = getSubscriptionPublicDomain()

  if (!configured) {
    return {
      status: 'error' as const,
      panelUrl,
      subPublicDomain,
      squadUuid: REMNAWAVE_SQUAD_UUID,
      supportedProxyNodeUuid: SUPPORTED_PROXY_NODE_UUID,
      nodesCount: 0,
      latencyMs: Date.now() - started,
      nodes: [],
      provisioning: false,
      systemHealth: null,
      error: 'Remnawave env not configured (REMWAVE_BASE_URL / API_TOKEN / TINYAUTH)',
      contract: {
        apiPrefix: '/api',
        auth: 'Bearer REMWAVE_API_TOKEN + X-Api-Key REMWAVE_TINYAUTH_X_API_KEY',
        note: `Set REMWAVE_*. Sub links: https://${subPublicDomain}/<shortUuid>`,
      },
    }
  }

  try {
    const [nodes, health] = await Promise.all([
      getAccessibleNodes(),
      getSystemHealth().catch(() => null),
    ])

    return {
      status: 'ok' as const,
      panelUrl,
      subPublicDomain,
      squadUuid: REMNAWAVE_SQUAD_UUID,
      supportedProxyNodeUuid: SUPPORTED_PROXY_NODE_UUID,
      nodesCount: nodes.length,
      latencyMs: Date.now() - started,
      provisioning: true,
      systemHealth: health?.response ?? health,
      nodes: nodes.map((node) => ({
        uuid: node.uuid,
        name: node.nodeName,
        countryCode: node.countryCode,
        configProfileName: node.configProfileName,
        activeInbounds: node.activeInbounds,
        isSupportedProxy: node.uuid === SUPPORTED_PROXY_NODE_UUID,
      })),
      contract: {
        apiPrefix: '/api',
        auth: 'Bearer REMWAVE_API_TOKEN + X-Api-Key REMWAVE_TINYAUTH_X_API_KEY',
        note: `Users → Remnawave + sub https://${subPublicDomain}/<shortUuid>`,
      },
    }
  } catch (error) {
    return {
      status: 'error' as const,
      panelUrl,
      subPublicDomain,
      squadUuid: REMNAWAVE_SQUAD_UUID,
      supportedProxyNodeUuid: SUPPORTED_PROXY_NODE_UUID,
      nodesCount: 0,
      latencyMs: Date.now() - started,
      provisioning: true,
      systemHealth: null,
      nodes: [] as Array<{
        uuid: string
        name: string
        countryCode: string
        configProfileName: string
        activeInbounds: string[]
        isSupportedProxy: boolean
      }>,
      error: error instanceof Error ? error.message : 'Remnawave unavailable',
      contract: {
        apiPrefix: '/api',
        auth: 'Bearer REMWAVE_API_TOKEN + X-Api-Key REMWAVE_TINYAUTH_X_API_KEY',
        note: `Users → Remnawave + sub https://${subPublicDomain}/<shortUuid>`,
      },
    }
  }
}
