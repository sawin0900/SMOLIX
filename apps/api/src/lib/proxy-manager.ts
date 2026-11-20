import { randomBytes } from 'node:crypto'

const USERNAME_PREFIX = 'smx_'

function getConfig() {
  const baseUrl = process.env.PROXY_MANAGER_URL
  const token = process.env.PROXY_MANAGER_TOKEN

  if (!baseUrl || !token) {
    throw new Error('Proxy Manager configuration is missing')
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), token }
}

async function managerRequest(
  path: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
) {
  const { baseUrl, token } = getConfig()

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`Proxy Manager request failed: ${response.status}`)
  }

  return response.json() as Promise<{ success: boolean; username?: string }>
}

export function generateProxyUsername(userId: string): string {
  const normalized = userId.replace(/-/g, '').toLowerCase()

  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    throw new Error('Invalid user UUID')
  }

  return USERNAME_PREFIX + normalized
}

export function generateProxyPassword(): string {
  return randomBytes(48).toString('base64url')
}

export async function createProxyUser(
  username: string,
  password: string,
) {
  return managerRequest('/v1/users', 'POST', { username, password })
}

export async function deleteProxyUser(username: string) {
  return managerRequest(`/v1/users/${encodeURIComponent(username)}`, 'DELETE')
}