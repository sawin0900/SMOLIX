export const COUNTRY_FLAGS: Record<string, string> = {
  Россия: '🇷🇺',
  Russia: '🇷🇺',
  Германия: '🇩🇪',
  Germany: '🇩🇪',
  Нидерланды: '🇳🇱',
  Netherlands: '🇳🇱',
  США: '🇺🇸',
  USA: '🇺🇸',
  Финляндия: '🇫🇮',
  Finland: '🇫🇮',
  Турция: '🇹🇷',
  Turkey: '🇹🇷',
  Казахстан: '🇰🇿',
  Kazakhstan: '🇰🇿',
}

export function flagFor(country?: string | null) {
  if (!country) return '🌍'
  return COUNTRY_FLAGS[country] || '🌍'
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRemaining(seconds?: number | null) {
  if (seconds == null) return null
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days} д ${hours} ч`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours} ч ${mins} м`
}

export function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(data)}`
}
