export function formatAdminMoney(value?: string | null) {
  if (value == null) return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return `${num.toLocaleString('ru-RU')} ₽`
}