type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    gtag?: (...args: unknown[]) => void
  }
}

export function track(event: string, payload: AnalyticsPayload = {}) {
  const detail = { event, ...payload, ts: Date.now() }

  try {
    window.dispatchEvent(new CustomEvent('smolix:analytics', { detail }))
  } catch {
    /* ignore */
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', event, payload)
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(detail)
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', detail)
  }
}
