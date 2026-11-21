import type { AdminOrder } from '../api'

export function exportOrdersCsv(orders: AdminOrder[]) {
  const esc = (value: string) => `"${value.replace(/"/g, '""')}"`
  const header = ['id', 'email', 'plan', 'amount', 'currency', 'status', 'createdAt', 'provider']
  const rows = orders.map((o) => [
    o.id,
    o.user.email,
    o.plan.name,
    o.amount,
    o.currency,
    o.status,
    o.createdAt,
    o.payment?.provider ?? '',
  ])
  const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `smolix-orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}