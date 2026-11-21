import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Clock3, Check, AlertCircle, Download, MonitorSmartphone, RefreshCw, Smartphone,
  Copy, Gift, LockKeyhole, LogOut,
} from 'lucide-react'
import {
  getAccountNotices,
  getReferral,
  getPublicStatus,
  logoutEverywhere,
  refreshVpnSubscription,
  type User,
  type ServerItem,
  type SubscriptionResponse,
  type AccountOverview,
  type AccountDevice,
  type ConnectionHistoryItem,
  type AccountResponse,
  type VpnAccountInfo,
  type PublicStatus,
} from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { CHROME_STORE_URL, IS_CHROME_STORE_LIVE } from '../config'
import { formatDate, formatRemaining } from './format'
import { UnifiedAccessStatus } from './UnifiedAccessStatus'
import { Skeleton } from './Skeleton'
import { SubscriptionLinkCard } from './SubscriptionLinkCard'
import type { AccountNotice } from './types'

function formatTrafficGb(bytes: string | null | undefined, unlimitedLabel: string, limitedLabel: string) {
  if (!bytes) return unlimitedLabel
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return unlimitedLabel
  const gb = Math.round((n / (1024 ** 3)) * 10) / 10
  return limitedLabel.replace('{gb}', String(gb))
}

export function DashboardView({
  greetingName,
  user,
  vpnAccount,
  overview,
  subscription,
  subscriptionProgress,
  isLikelyConnected,
  devices,
  history,
  loadingExtra,
  welcome,
  locale,
  onVpnUpdated,
  onToast,
}: {
  greetingName: string
  user: User
  vpnAccount: AccountResponse['vpnAccount']
  overview: AccountOverview | null
  subscription: SubscriptionResponse['subscription']
  subscriptionProgress: number | null
  isLikelyConnected: boolean
  servers: ServerItem[]
  serversLoading: boolean
  selectedServer: string
  devices: AccountDevice[]
  history: ConnectionHistoryItem[]
  loadingExtra: boolean
  welcome: boolean
  locale: Locale
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const t = CABINET_COPY[locale]
  const extensionLinked = overview?.extension?.linked ?? (devices.length > 0 || (overview?.devices.activeCount ?? 0) > 0)
  const extensionStale = Boolean(overview?.extension?.stale)
  const provisioned = vpnAccount?.isProvisioned
  const hasSubUrl = Boolean(vpnAccount?.subscriptionUrl)
  const hasFirstConnection = history.length > 0
  const deviceLimit = overview?.devices.deviceLimit ?? subscription?.plan.deviceLimit ?? 1
  const deviceCount = Math.max(overview?.devices.activeCount ?? 0, devices.length)
  const step2Done = extensionLinked
  const step3Done = hasFirstConnection || (overview?.lastConnection?.mode === 'youtube')
  const isTrial = subscription?.status === 'ACTIVE' && Boolean(subscription.isTrial)
  const trialSeconds = isTrial ? subscription?.remainingSeconds ?? null : null
  const trialEndingSoon = typeof trialSeconds === 'number' && trialSeconds > 0 && trialSeconds <= 3 * 86400
  const trialEndingCritical = typeof trialSeconds === 'number' && trialSeconds > 0 && trialSeconds <= 86400

  const [provisionBusy, setProvisionBusy] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [notices, setNotices] = useState<AccountNotice[]>([])
  const [publicStatus, setPublicStatus] = useState<PublicStatus | null>(null)
  const [inviteUrl, setInviteUrl] = useState('')
  const [daysPerInvite, setDaysPerInvite] = useState(7)

  useEffect(() => {
    getAccountNotices()
      .then((res) => setNotices(res.notices))
      .catch(() => setNotices([]))
    getPublicStatus()
      .then(setPublicStatus)
      .catch(() => setPublicStatus(null))
    getReferral()
      .then((data) => {
        setInviteUrl(data.inviteUrl)
        setDaysPerInvite(data.daysPerInvite || 7)
      })
      .catch(() => undefined)
  }, [])

  const refreshProvision = async () => {
    setProvisionBusy(true)
    try {
      const result = await refreshVpnSubscription()
      onVpnUpdated(result.vpnAccount)
      onToast(result.message, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t.provisionWait, 'error')
    } finally {
      setProvisionBusy(false)
    }
  }

  const copyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      onToast(t.linkCopied, 'success')
    } catch {
      onToast(t.copyFailed, 'error')
    }
  }

  const doLogoutEverywhere = async () => {
    setLogoutBusy(true)
    try {
      const res = await logoutEverywhere()
      onToast(res.message, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t.genericError, 'error')
    } finally {
      setLogoutBusy(false)
    }
  }

  type NextAction = {
    title: string
    text: string
    cta: ReactNode
    tone: 'amber' | 'rose' | 'teal'
  }

  const nextAction: NextAction = (() => {
    if (!extensionLinked) {
      return {
        title: t.nextActionTitle,
        text: t.nextActionInstall,
        tone: 'amber',
        cta: (
          <div className="flex flex-wrap gap-2">
            <Link to="/install" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3.5 text-sm font-bold min-h-12">
              <Download size={16} /> {t.step2Cta}
            </Link>
            {IS_CHROME_STORE_LIVE && (
              <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-bold min-h-12">
                Chrome Store
              </a>
            )}
          </div>
        ),
      }
    }
    if (extensionStale) {
      return {
        title: t.nextActionTitle,
        text: t.extStaleHint,
        tone: 'amber',
        cta: (
          <Link to="/install" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3.5 text-sm font-bold min-h-12">
            <Download size={16} /> {t.extStale}
          </Link>
        ),
      }
    }
    if (!hasSubUrl) {
      return {
        title: t.nextActionTitle,
        text: t.nextActionVpn,
        tone: 'amber',
        cta: (
          <button
            type="button"
            disabled={provisionBusy}
            onClick={refreshProvision}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3.5 text-sm font-bold min-h-12 disabled:opacity-60"
          >
            <RefreshCw size={16} className={provisionBusy ? 'animate-spin' : ''} />
            {provisionBusy ? t.creatingLink : t.getLink}
          </button>
        ),
      }
    }
    if (trialEndingSoon || trialEndingCritical) {
      return {
        title: t.nextActionTitle,
        text: trialEndingCritical ? t.nextActionTrial : t.nextActionTrial,
        tone: trialEndingCritical ? 'rose' : 'amber',
        cta: (
          <Link to="/app/subscription" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3.5 text-sm font-bold min-h-12">
            {t.accessCtaUpgrade}
          </Link>
        ),
      }
    }
    if (!subscription || subscription.status !== 'ACTIVE') {
      return {
        title: t.nextActionTitle,
        text: t.nextActionExpired,
        tone: 'rose',
        cta: (
          <Link to="/app/subscription" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3.5 text-sm font-bold min-h-12">
            {t.accessCtaUpgrade}
          </Link>
        ),
      }
    }
    if (!step3Done) {
      return {
        title: t.nextActionTitle,
        text: t.nextActionConnect,
        tone: 'teal',
        cta: (
          <Link to="/install" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3.5 text-sm font-bold min-h-12">
            <Smartphone size={16} /> {t.step3Title}
          </Link>
        ),
      }
    }
    return {
      title: t.nextActionOk,
      text: t.onboardLead,
      tone: 'teal',
      cta: (
        <Link to="/app/subscription" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-bold min-h-12">
          {t.nextActionOkCta}
        </Link>
      ),
    }
  })()

  const toneClass =
    nextAction.tone === 'rose'
      ? 'border-rose-200 bg-rose-50'
      : nextAction.tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50/70'

  const outage = publicStatus?.status === 'degraded' || publicStatus?.status === 'major_outage'
  const trafficLabel = formatTrafficGb(
    overview?.subscription?.trafficLimitBytes,
    t.trafficUnlimited,
    t.trafficLimit,
  )

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-teal-700 font-semibold mb-2">
          {welcome ? t.welcomeBadge : t.greetingEyebrow}
        </p>
        <h1 className="text-3xl md:text-[34px] font-bold tracking-normal">
          {t.greetingHi}, {greetingName}
        </h1>
        <p className="text-[var(--muted)] mt-2 text-sm">{user.email}</p>
      </div>

      {outage && (
        <section className={`rounded-2xl border px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
          publicStatus?.status === 'major_outage' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <div>
            <p className="font-bold">{t.statusOutageTitle}</p>
            <p className="text-sm text-[var(--muted)] mt-1">
              {publicStatus?.message || t.statusOutageText}
            </p>
          </div>
          <Link to="/status" className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold w-fit">
            {t.statusOutageCta}
          </Link>
        </section>
      )}

      {notices.length > 0 && (
        <div className="space-y-3 mb-6">
          {notices.map((notice) => {
            const levelClass =
              notice.level === 'critical'
                ? 'border-rose-200 bg-rose-50'
                : notice.level === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-teal-200 bg-teal-50/70'
            const inner = (
              <div className={`rounded-2xl border px-5 py-4 ${levelClass}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{t.noticesEyebrow}</p>
                <p className="font-bold mt-1">{notice.title}</p>
                <p className="text-sm text-[var(--muted)] mt-1">{notice.text}</p>
              </div>
            )
            if (!notice.href) return <div key={notice.id}>{inner}</div>
            const external = /^https?:\/\//i.test(notice.href) || notice.href.startsWith('mailto:')
            return external ? (
              <a key={notice.id} href={notice.href} className="block hover:opacity-95 transition" target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <Link key={notice.id} to={notice.href} className="block hover:opacity-95 transition">
                {inner}
              </Link>
            )
          })}
        </div>
      )}

      {overview?.impersonation?.active && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 mb-6">
          <p className="font-bold text-amber-950">{t.impersonationBanner}</p>
          <p className="text-sm text-amber-900/80 mt-1">{t.impersonationHint}</p>
        </section>
      )}

      <UnifiedAccessStatus subscription={subscription} subscriptionProgress={subscriptionProgress} locale={locale} />

      <section className={`rounded-2xl border px-5 py-5 mb-6 ${toneClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{t.nextActionTitle}</p>
        <h2 className="text-2xl font-extrabold mt-2">{nextAction.title}</h2>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">{nextAction.text}</p>
        <div className="mt-4">{nextAction.cta}</div>
        {(welcome || !step2Done || !step3Done) && (
          <ul className="mt-5 flex flex-wrap gap-2 text-xs">
            {[
              { done: true, label: t.step1Title },
              { done: step2Done, label: t.step2Title },
              { done: step3Done, label: t.step3Title },
            ].map((s) => (
              <li
                key={s.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold border ${
                  s.done ? 'border-emerald-200 bg-white text-emerald-800' : 'border-[var(--border)] bg-white/70 text-[var(--muted)]'
                }`}
              >
                {s.done ? <Check size={12} /> : <AlertCircle size={12} />}
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`rounded-2xl border px-5 py-4 mb-6 ${extensionLinked && !extensionStale ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50'}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{t.statusEyebrow}</p>
        <p className="font-bold mt-1">
          {!extensionLinked ? t.extOffline : extensionStale ? t.extStale : t.extLinked}
        </p>
        <p className="text-sm text-[var(--muted)] mt-1">
          {!extensionLinked
            ? t.extOfflineHint
            : extensionStale
              ? t.extStaleHint
              : overview?.extension?.deviceName
                ? `${t.extDevice}: ${overview.extension.deviceName}`
                : t.step1Done}
          {overview?.extension?.lastUsedAt ? ` · ${formatDate(overview.extension.lastUsedAt)}` : ''}
        </p>
      </section>

      <div className="mb-6">
        <SubscriptionLinkCard
          locale={locale}
          vpnAccount={vpnAccount}
          onVpnUpdated={onVpnUpdated}
          onToast={onToast}
        />
      </div>

      <section className="glass-card rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Gift className="text-teal-700 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold">{t.referralStrip.replace('{days}', String(daysPerInvite))}</p>
            <p className="text-xs text-[var(--muted)] mt-1 break-all">{inviteUrl || '…'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyInvite}
            disabled={!inviteUrl}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            <Copy size={15} /> {t.referralStripCta}
          </button>
          <Link to="/app/referral" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
            {t.navReferral}
          </Link>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <section className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <LockKeyhole size={18} className="text-teal-700" />
            <h3 className="font-bold">{t.securityTitle}</h3>
          </div>
          <p className="text-sm text-[var(--muted)]">{t.securityLead}</p>
          <p className="text-xs text-[var(--muted)] mt-2">{t.securityLogoutAllHint}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/app/settings" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold">
              {t.securityPassword}
            </Link>
            <button
              type="button"
              disabled={logoutBusy}
              onClick={doLogoutEverywhere}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              <LogOut size={15} /> {logoutBusy ? '…' : t.securityLogoutAll}
            </button>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <MonitorSmartphone size={18} className="text-teal-700" />
            <h3 className="font-bold">{t.devicesMultiTitle}</h3>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {t.devicesMultiLead.replace('{limit}', String(deviceLimit))}
          </p>
          <p className="text-2xl font-extrabold mt-3">{deviceCount}/{deviceLimit}</p>
          <p className="text-xs text-[var(--muted)] mt-2">{t.trafficTitle}: {trafficLabel}</p>
          <div className="mt-3 h-2.5 rounded-full bg-[var(--canvas-2)] overflow-hidden">
            <div
              className={`h-full transition-all ${deviceCount > deviceLimit ? 'bg-rose-500' : 'bg-teal-600'}`}
              style={{ width: `${Math.min(100, (deviceCount / Math.max(deviceLimit, 1)) * 100)}%` }}
            />
          </div>
          <Link to="/app/devices" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-800 hover:underline">
            {t.devicesCta}
          </Link>
        </section>
      </div>

      <section className={`status-banner mb-6 ${isLikelyConnected ? 'online' : 'offline'}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{t.statusEyebrow}</p>
          <h2 className="text-2xl font-extrabold mt-2">
            {isLikelyConnected ? t.statusOnline : t.statusOffline}
          </h2>
          <p className="text-sm mt-2 opacity-80">
            {overview?.lastConnection
              ? `${overview.lastConnection.mode === 'youtube' ? t.modeYoutube : t.modeFull} · ${formatDate(overview.lastConnection.startedAt)}`
              : t.statusHint}
          </p>
        </div>
        <div className="status-banner-meta">
          <div>
            <small>{t.devices}</small>
            <strong>{deviceCount}/{deviceLimit}</strong>
          </div>
          <div>
            <small>VPN</small>
            <strong>{provisioned ? t.provisionReady : provisioned === false ? t.provisionWait : '—'}</strong>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted)] font-medium">Аккаунт</span>
            <ShieldCheck size={18} className="text-emerald-600" />
          </div>
          {loadingExtra ? <Skeleton className="h-7 w-24 mt-4" /> : (
            <p className="text-xl font-bold mt-4">{user.status === 'ACTIVE' ? t.statusActive : user.status}</p>
          )}
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted)] font-medium">Подписка</span>
            <Clock3 size={18} className="text-teal-700" />
          </div>
          {loadingExtra ? <Skeleton className="h-7 w-28 mt-4" /> : (
            <>
              <p className="text-xl font-bold mt-4">
                {subscription?.status === 'ACTIVE'
                  ? subscription.isTrial ? 'Trial' : 'Premium'
                  : 'Free YouTube'}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {subscription?.remainingSeconds != null
                  ? `${t.remainingPrefix} ${formatRemaining(subscription.remainingSeconds)}`
                  : 'YouTube без оплаты'}
              </p>
            </>
          )}
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted)] font-medium">{t.trafficTitle}</span>
            <Smartphone size={18} className="text-cyan-700" />
          </div>
          <p className="text-sm font-bold mt-4 leading-snug">{trafficLabel}</p>
          <Link to="/app/subscription" className="text-xs font-bold text-teal-800 hover:underline mt-2 inline-block">
            {t.navSub}
          </Link>
        </div>
      </div>
    </>
  )
}
