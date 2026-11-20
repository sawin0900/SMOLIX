import { randomUUID } from 'node:crypto'

export type YooPaymentCreateInput = {
  amount: string
  currency: string
  description: string
  returnUrl: string
  metadata: Record<string, string>
}

export type YooPaymentCreateResult = {
  id: string
  status: string
  confirmationUrl: string
  mock: boolean
}

function shopId() {
  return process.env.YOOKASSA_SHOP_ID || ''
}

function secretKey() {
  return process.env.YOOKASSA_SECRET_KEY || ''
}

export function isYooKassaConfigured() {
  return Boolean(shopId() && secretKey())
}

export async function createYooPayment(input: YooPaymentCreateInput): Promise<YooPaymentCreateResult> {
  if (!isYooKassaConfigured()) {
    const id = `mock_${randomUUID()}`
    const orderId = input.metadata.orderId
    const base = (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    return {
      id,
      status: 'pending',
      confirmationUrl: `${base}/app/subscription?mockPay=${encodeURIComponent(orderId)}`,
      mock: true,
    }
  }

  const auth = Buffer.from(`${shopId()}:${secretKey()}`).toString('base64')
  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Idempotence-Key': randomUUID(),
    },
    body: JSON.stringify({
      amount: {
        value: input.amount,
        currency: input.currency,
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: input.returnUrl,
      },
      description: input.description,
      metadata: input.metadata,
    }),
  })

  const data = await response.json() as {
    id?: string
    status?: string
    confirmation?: { confirmation_url?: string }
    description?: string
    message?: string
  }

  if (!response.ok || !data.id || !data.confirmation?.confirmation_url) {
    throw new Error(data.description || data.message || 'Не удалось создать платёж ЮKassa')
  }

  return {
    id: data.id,
    status: data.status || 'pending',
    confirmationUrl: data.confirmation.confirmation_url,
    mock: false,
  }
}

export function verifyYooWebhookBasicAuth(header?: string) {
  // YooKassa IP allowlist is preferred in production; basic auth optional via env.
  const user = process.env.YOOKASSA_WEBHOOK_USER
  const pass = process.env.YOOKASSA_WEBHOOK_PASS
  if (!user || !pass) return true
  if (!header?.startsWith('Basic ')) return false
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  return decoded === `${user}:${pass}`
}
