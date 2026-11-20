export const CHROME_STORE_URL = (
  import.meta.env.VITE_CHROME_STORE_URL as string | undefined
)?.trim() || ''

export const IS_CHROME_STORE_LIVE = Boolean(CHROME_STORE_URL)

/** Optional Cloudflare Turnstile site key (pair with API TURNSTILE_SECRET_KEY) */
export const TURNSTILE_SITE_KEY = (
  import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
)?.trim() || ''