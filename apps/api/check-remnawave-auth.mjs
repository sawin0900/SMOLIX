import 'dotenv/config'

const baseUrl = (process.env.REMWAVE_BASE_URL || '').trim().replace(/\/+$/, '')
const apiToken = (process.env.REMWAVE_API_TOKEN || '').trim()
const apiKey = (process.env.REMWAVE_TINYAUTH_X_API_KEY || '').trim()
const squad =
  (process.env.REMWAVE_SQUAD_UUID || '').trim() ||
  'b73684c7-ce2e-4c3f-9065-fb940578214b'

console.log({
  REMWAVE_BASE_URL: baseUrl || '(пусто)',
  REMWAVE_API_TOKEN: apiToken ? `задан (${apiToken.length} символов)` : '(пусто)',
  REMWAVE_TINYAUTH_X_API_KEY: apiKey ? `задан (${apiKey.length} символов)` : '(пусто)',
})

if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
  console.error(
    'Ошибка: REMWAVE_BASE_URL должен быть полным URL, например https://panel.jetsale.online',
  )
  process.exit(1)
}
if (!apiToken) {
  console.error('Ошибка: REMWAVE_API_TOKEN пустой')
  process.exit(1)
}
if (!apiKey) {
  console.error('Ошибка: REMWAVE_TINYAUTH_X_API_KEY пустой')
  process.exit(1)
}

const url = new URL(`/api/internal-squads/${squad}/accessible-nodes`, `${baseUrl}/`)

const response = await fetch(url, {
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${apiToken}`,
    'X-Api-Key': apiKey,
  },
  redirect: 'manual',
})

const location = response.headers.get('location')
let bodyPreview = ''
try {
  bodyPreview = (await response.text()).slice(0, 200)
} catch {
  /* ignore */
}

console.log({
  status: response.status,
  contentType: response.headers.get('content-type'),
  redirect: location
    ? new URL(location, url).origin + new URL(location, url).pathname
    : null,
  bodyPreview,
})

if (response.status !== 200) {
  process.exit(2)
}
