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
  const expiringSoon =
    isPremiumActive &&
    typeof subscription.remainingSeconds === 'number' &&
    subscription.remainingSeconds > 0 &&
    subscription.remainingSeconds <= 3 * 86400

  const border = isTrial
    ? 'border-amber-200 bg-amber-50'
    : expiringSoon
      ? 'border-teal-200 bg-teal-50'
      : isPremiumActive
        ? 'border-emerald-200 bg-emerald-50/80'
        : 'border-[var(--border)] bg-[var(--canvas-band)]/60'

  const title = isTrial
    ? t.accessTrial
    : isPremiumActive
      ? expiringSoon
        ? t.accessExpiring
        : t.accessPremium
      : t.accessFree

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
        <p className="text-sm mt-1 opacity-80">{hint}</p>
        {subscriptionProgress != null && isPremiumActive && (
          <div className="mt-3 h-2 rounded-full bg-white/60 overflow-hidden max-w-xs">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${subscriptionProgress}%` }} />
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