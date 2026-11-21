import { Link } from 'react-router-dom'
import type { SubscriptionResponse } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { formatDate, formatRemaining } from './format'

export function UnifiedAccessStatus({
  subscription,
  subscriptionProgress,
  locale,
}: {
  subscription: SubscriptionResponse['subscription']
  subscriptionProgress: number | null
  locale: Locale
}) {
  const t = CABINET_COPY[locale]
  const isPremiumActive = subscription?.status === 'ACTIVE' && !subscription.isTrial
  const isTrial = subscription?.status === 'ACTIVE' && subscription.isTrial
  const remaining = subscription?.remainingSeconds
  const ending1d = typeof remaining === 'number' && remaining > 0 && remaining <= 86400
  const ending3d = typeof remaining === 'number' && remaining > 0 && remaining <= 3 * 86400
  const expiringSoon = isPremiumActive && ending3d

  const border = ending1d && (isTrial || isPremiumActive)
    ? 'border-rose-300 bg-rose-50'
    : isTrial && ending3d
      ? 'border-amber-300 bg-amber-50'
      : isTrial
        ? 'border-amber-200 bg-amber-50'
        : expiringSoon
          ? 'border-teal-200 bg-teal-50'
          : isPremiumActive
            ? 'border-emerald-200 bg-emerald-50/80'
            : 'border-[var(--border)] bg-[var(--canvas-band)]/60'

  const title = isTrial
    ? ending1d
      ? t.nextActionTrial
      : t.accessTrial
    : isPremiumActive
      ? expiringSoon
        ? t.accessExpiring
        : t.accessPremium
      : t.accessFree

  const daysLeft =
    typeof remaining === 'number' && remaining > 0
      ? Math.max(1, Math.ceil(remaining / 86400))
      : null
  const trialCountdown =
    isTrial && remaining != null
      ? remaining < 86400
        ? t.trialHoursLeft
        : ending3d
          ? t.trialDaysLeft.replace('{days}', String(daysLeft ?? 1))
          : t.trialDaysLeft.replace('{days}', String(daysLeft ?? 1))
      : null

  const hint =
    isTrial || isPremiumActive
      ? subscription?.expiresAt
        ? `${formatDate(subscription.expiresAt)}${subscription.remainingSeconds != null ? ` · ${formatRemaining(subscription.remainingSeconds)}` : ''}`
        : '—'
      : t.accessFreeHint

  const ctaLabel = isTrial
    ? t.accessCtaUpgrade
    : isPremiumActive
      ? expiringSoon
        ? t.accessCtaRenew
        : t.accessCtaManage
      : t.accessCtaUpgrade

  return (
    <section
      className={`rounded-2xl border px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${border}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide opacity-70">{t.accessEyebrow}</p>
        <p className="font-extrabold text-xl mt-1">{title}</p>
        {trialCountdown && (
          <p className="text-2xl font-extrabold tracking-tight text-amber-900 mt-2">{trialCountdown}</p>
        )}
        <p className="text-sm mt-1 opacity-80">{hint}</p>
        {(subscriptionProgress != null && (isPremiumActive || isTrial)) && (
          <div className="mt-3 h-2 rounded-full bg-white/60 overflow-hidden max-w-xs">
            <div
              className={`h-full transition-all ${isTrial ? 'bg-amber-500' : 'bg-teal-600'}`}
              style={{ width: `${subscriptionProgress}%` }}
            />
          </div>
        )}
      </div>
      <Link
        to="/app/subscription"
        className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit shrink-0"
      >
        {ctaLabel}
      </Link>
    </section>
  )
}