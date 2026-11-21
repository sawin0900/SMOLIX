import { Link } from 'react-router-dom'
import type { SubscriptionResponse } from '../api'
import { CABINET_COPY, readCabinetLocale } from '../i18n/cabinet'
import { formatDate, formatRemaining } from './format'

export { formatDate as formatCabinetDate, formatRemaining as formatCabinetRemaining } from './format'

export function TrialBanner({ subscription }: { subscription: SubscriptionResponse['subscription'] }) {
  const locale = readCabinetLocale()
  const t = CABINET_COPY[locale]
  if (!subscription || subscription.status !== 'ACTIVE' || !subscription.isTrial) return null
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="font-bold text-amber-900">{t.trialBannerTitle}</p>
        <p className="text-sm text-amber-800/80 mt-1">
          {t.trialBannerLead.replace('{remaining}', formatRemaining(subscription.remainingSeconds) ?? '—')}
          {subscription.expiresAt ? ` · ${t.trialBannerUntil} ${formatDate(subscription.expiresAt)}` : ''}
        </p>
      </div>
      <Link to="/app/subscription" className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit">
        {t.trialBannerCta}
      </Link>
    </section>
  )
}