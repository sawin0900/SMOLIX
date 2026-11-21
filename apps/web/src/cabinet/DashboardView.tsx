import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Globe2, Clock3, Check, AlertCircle, Download, MonitorSmartphone, RefreshCw, Smartphone,
} from 'lucide-react'
import {
  getAccountNotices,
  refreshVpnSubscription,
  type User,
  type ServerItem,
  type SubscriptionResponse,
  type AccountOverview,
  type AccountDevice,
  type ConnectionHistoryItem,
  type AccountResponse,
  type VpnAccountInfo,
} from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { CHROME_STORE_URL, IS_CHROME_STORE_LIVE } from '../config'
import { flagFor, formatDate, formatRemaining } from './format'
import { UnifiedAccessStatus } from './UnifiedAccessStatus'
import { Skeleton } from './Skeleton'
import { SubscriptionLinkCard } from './SubscriptionLinkCard'
import type { AccountNotice } from './types'

export function DashboardView({
  greetingName,
  user,
  vpnAccount,
  overview,
  subscription,
  subscriptionProgress,
  isLikelyConnected,
  servers,
  serversLoading,
  selectedServer,
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
  const selected = servers.find((s) => s.id === selectedServer) ?? servers[0]
  const extensionLinked = overview?.extension?.linked ?? (devices.length > 0 || (overview?.devices.activeCount ?? 0) > 0)
  const extensionStale = Boolean(overview?.extension?.stale)
  const provisioned = vpnAccount?.isProvisioned
  const hasSubUrl = Boolean(vpnAccount?.subscriptionUrl)
  const hasFirstConnection = history.length > 0
  const deviceLimit = overview?.devices.deviceLimit ?? subscription?.plan.deviceLimit ?? 1
  const deviceCount = Math.max(overview?.devices.activeCount ?? 0, devices.length)
  const step1Done = extensionLinked
  const step2Done = hasSubUrl && provisioned !== false
  const step3Done = hasFirstConnection
  const allStepsDone = step1Done && step2Done && step3Done
  const showOnboarding = welcome || !allStepsDone
  const [provisionBusy, setProvisionBusy] = useState(false)
  const [notices, setNotices] = useState<AccountNotice[]>([])

  useEffect(() => {
    getAccountNotices()
      .then((res) => setNotices(res.notices))
      .catch(() => setNotices([]))
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

  const steps = [
    {
      done: step1Done,
      title: t.step1Title,
      text: step1Done ? t.step1Done : t.step1Text,
      cta: step1Done ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/install" className="inline-flex items-center gap-1.5 rounded-lg brand-gradient text-white px-3 py-2 text-xs font-bold">
            <Download size={14} /> {t.step1Cta}
          </Link>
          {IS_CHROME_STORE_LIVE && (
            <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--ink)]">
              Chrome Store
            </a>
          )}
        </div>
      ),
    },
    {
      done: step2Done,
      title: t.step2Title,
      text: step2Done ? t.step2Done : t.step2Text,
      cta: step2Done ? null : (
        <Link to="/app/vpn" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-900 px-3 py-2 text-xs font-bold">
          <Smartphone size={14} /> {t.step2Cta}
        </Link>
      ),
    },
    {
      done: step3Done,
      title: t.step3Title,
      text: step3Done ? t.step3Done : t.step3Text,
      cta: step3Done ? null : (
        <Link to="/install" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--ink)]">
          <Download size={14} /> {t.step1Cta}
        </Link>
      ),
    },
  ]

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

      <section className={`rounded-2xl border px-5 py-4 mb-4 ${extensionLinked && !extensionStale ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50'}`}>
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
        {!extensionLinked && (
          <Link to="/install" className="mt-3 inline-flex items-center gap-1.5 rounded-lg brand-gradient text-white px-3 py-2 text-xs font-bold">
            <Download size={14} /> {t.step1Cta}
          </Link>
        )}
      </section>

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
          <p className="text-xs mt-2 opacity-70">{t.statusRuSplit}</p>
        </div>
        <div className="status-banner-meta">
          <div>
            <small>{t.location}</small>
            <strong>{selected ? `${flagFor(selected.country)} ${selected.country}` : t.locationInExt}</strong>
          </div>
          <div>
            <small>{t.devices}</small>
            <strong>{deviceCount}/{deviceLimit}</strong>
          </div>
        </div>
      </section>

      {showOnboarding && (
        <section className="glass-card glass-card-accent rounded-2xl p-5 md:p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-700">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{t.onboardTitle}</h3>
              <p className="text-sm text-[var(--muted)] mt-1">{t.onboardLead}</p>
            </div>
          </div>
          <ol className="mt-5 grid md:grid-cols-3 gap-3">
            {steps.map((step, index) => (
              <li key={step.title} className={`rounded-xl border p-4 ${step.done ? 'border-emerald-100 bg-emerald-50/60' : 'border-[var(--border)] bg-[var(--canvas-band)]/80'}`}>
                <div className={`w-8 h-8 rounded-lg text-white text-sm font-bold flex items-center justify-center ${step.done ? 'bg-emerald-500' : 'brand-gradient'}`}>
                  {step.done ? <Check size={16} /> : index + 1}
                </div>
                <p className="font-bold text-sm mt-3">{step.title}</p>
                <p className="text-xs text-[var(--muted)] mt-1">{step.text}</p>
                {!step.done && step.cta}
              </li>
            ))}
          </ol>
        </section>
      )}

      {provisioned === false && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-bold text-rose-800">{t.provisionWait}</p>
            <p className="text-sm text-rose-700/80 mt-1">{t.provisionWaitText}</p>
          </div>
          <button
            type="button"
            disabled={provisionBusy}
            onClick={refreshProvision}
            className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCw size={15} className={provisionBusy ? 'animate-spin' : ''} />
            {provisionBusy ? '…' : t.step2Cta}
          </button>
        </section>
      )}

      {!hasSubUrl && provisioned !== false && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-bold text-amber-900">{t.provisionMissing}</p>
            <p className="text-sm text-amber-800/80 mt-1">{t.step2Text}</p>
          </div>
          <button
            type="button"
            disabled={provisionBusy}
            onClick={refreshProvision}
            className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCw size={15} className={provisionBusy ? 'animate-spin' : ''} />
            {t.step2Cta}
          </button>
        </section>
      )}

      <section className="glass-card rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">{t.devicesTitle}</h3>
            <p className="text-sm text-[var(--muted)] mt-1">
              {t.devicesLead.replace('{used}', String(deviceCount)).replace('{limit}', String(deviceLimit))}
            </p>
          </div>
          <Link
            to="/app/devices"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--canvas-band)] w-fit"
          >
            <MonitorSmartphone size={16} />
            {t.devicesCta}
          </Link>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-[var(--canvas-2)] overflow-hidden">
          <div
            className={`h-full transition-all ${deviceCount > deviceLimit ? 'bg-rose-500' : 'bg-teal-600'}`}
            style={{ width: `${Math.min(100, (deviceCount / Math.max(deviceLimit, 1)) * 100)}%` }}
          />
        </div>
      </section>

      <div className="mb-6">
        <SubscriptionLinkCard
          locale={locale}
          vpnAccount={vpnAccount}
          onVpnUpdated={onVpnUpdated}
          onToast={onToast}
          compact
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted)] font-medium">Аккаунт</span>
            <ShieldCheck size={18} className="text-emerald-600" />
          </div>
          {loadingExtra ? <Skeleton className="h-7 w-24 mt-4" /> : (
            <>
              <p className="text-xl font-bold mt-4">{user.status === 'ACTIVE' ? t.statusActive : user.status}</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                VPN: {provisioned ? t.provisionReady : provisioned === false ? t.provisionWait : '—'}
              </p>
            </>
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
              {subscriptionProgress != null && (
                <div className="mt-3 h-2 rounded-full bg-[var(--canvas-2)] overflow-hidden">
                  <div className="h-full bg-teal-600" style={{ width: `${subscriptionProgress}%` }} />
                </div>
              )}
            </>
          )}
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted)] font-medium">{t.devices}</span>
            <MonitorSmartphone size={18} className="text-cyan-700" />
          </div>
          {loadingExtra ? <Skeleton className="h-7 w-12 mt-4" /> : (
            <>
              <p className="text-xl font-bold mt-4">{deviceCount}/{deviceLimit}</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                <Link to="/app/devices" className="font-semibold text-teal-800 hover:underline">{t.devicesCta}</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <section className="glass-card rounded-2xl p-5 md:p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">Недавние подключения</h3>
            <p className="text-xs text-[var(--muted)] mt-1">История из расширения SMOLIX</p>
          </div>
          <Link to="/app/history" className="text-xs font-bold text-teal-800 hover:underline">Все</Link>
        </div>
        {loadingExtra ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Пока пусто — подключитесь через popup расширения.</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-xl bg-[var(--canvas-band)] px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">
                  {item.mode === 'youtube' ? 'YouTube' : 'Весь интернет'}
                  <span className="text-[var(--muted)] font-normal"> · {item.status}</span>
                </span>
                <span className="text-xs text-[var(--muted)]">{formatDate(item.startedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-5 md:p-6 mt-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-lg">Локации</h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              Рабочий выбор — только в расширении (Remnawave). Ниже справочный каталог сайта, он не меняет popup.
            </p>
          </div>
          <Globe2 className="text-teal-600" size={22} />
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {serversLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : servers.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-teal-200 bg-teal-50/50 p-6 text-center">
              <Globe2 className="mx-auto text-teal-500 mb-2" size={26} />
              <p className="font-semibold text-sm text-[var(--ink)]">{t.catalogEmpty}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{t.catalogEmptyHint}</p>
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="text-left rounded-xl p-4 border border-[var(--border)] bg-[var(--canvas-band)]/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{flagFor(server.country)}</span>
                  <span className="text-[11px] font-bold text-[var(--muted)]">{t.catalogBadge}</span>
                </div>
                <p className="font-bold mt-3 text-sm">{server.name}</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {server.city}, {server.country}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}
