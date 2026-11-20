import { Link } from 'react-router-dom'
import type { SubscriptionResponse } from '../api'

export function formatCabinetDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCabinetRemaining(seconds?: number | null) {
  if (seconds == null) return null
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days} д ${hours} ч`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours} ч ${mins} м`
}

export function TrialBanner({ subscription }: { subscription: SubscriptionResponse['subscription'] }) {
  if (!subscription || subscription.status !== 'ACTIVE' || !subscription.isTrial) return null
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="font-bold text-amber-900">Пробный Premium</p>
        <p className="text-sm text-amber-800/80 mt-1">
          Полный доступ ещё {formatCabinetRemaining(subscription.remainingSeconds)}
          {subscription.expiresAt ? ` · до ${formatCabinetDate(subscription.expiresAt)}` : ''}
        </p>
      </div>
      <Link to="/app/subscription" className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit">
        Оформить Premium
      </Link>
    </section>
  )
}
