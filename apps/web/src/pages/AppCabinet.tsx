import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ShieldCheck, Zap, Globe2, Clock3, Settings, LayoutDashboard,
  CreditCard, LifeBuoy, LogOut, Menu, X, Check, LockKeyhole, ArrowUpRight,
  MonitorSmartphone, History, Download, AlertCircle, Gift, Copy, QrCode,
  ExternalLink, RefreshCw, Smartphone,
} from 'lucide-react'
import {
  getAccount,
  getAccountOverview,
  getAccountDevices,
  getAccountHistory,
  getAccountOrders,
  getServers,
  getSubscription,
  getBillingPlans,
  createCheckout,
  confirmMockPayment,
  getReferral,
  joinWaitlist,
  revokeAllExtensionDevices,
  revokeExtensionDevice,
  refreshVpnSubscription,
  changePassword,
  logout,
  getAccountNotices,
  getWebSessions,
  revokeWebSession,
  revokeOtherWebSessions,
  requestEmailVerification,
  type User,
  type ServerItem,
  type SubscriptionResponse,
  type AccountOverview,
  type AccountDevice,
  type AccountOrder,
  type ConnectionHistoryItem,
  type BillingPlan,
  type AccountResponse,
  type VpnAccountInfo,
} from '../api'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'
import { CABINET_COPY, readCabinetLocale, writeCabinetLocale } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { CHROME_STORE_URL, IS_CHROME_STORE_LIVE } from '../config'
import { TrialBanner } from '../cabinet/shared'

const COUNTRY_FLAGS: Record<string, string> = {
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

function flagFor(country?: string | null) {
  if (!country) return '🌍'
  return COUNTRY_FLAGS[country] || '🌍'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRemaining(seconds?: number | null) {
  if (seconds == null) return null
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days} д ${hours} ч`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours} ч ${mins} м`
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center shadow-lg shadow-teal-200">
        <ShieldCheck size={22} className="text-white" />
      </div>
      <span className="text-[22px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">SMOLIX</span>
    </div>
  )
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 2800)
    return () => window.clearTimeout(id)
  }, [onClose])

  return (
    <div className={`cabinet-toast ${type === 'success' ? 'success' : 'error'}`} role="status">
      {message}
    </div>
  )
}

type AccountNotice = { id: string; level: 'info' | 'warning' | 'critical'; title: string; text: string; href?: string }

function UnifiedAccessStatus({
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

  const hint = isTrial || isPremiumActive
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
    <section className={`rounded-2xl border px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${border}`}>
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
      <Link to="/app/subscription" className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit shrink-0">
        {ctaLabel}
      </Link>
    </section>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`cabinet-skeleton ${className}`} />
}

export default function AppCabinet() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [locale, setLocale] = useState<Locale>(() => readCabinetLocale())
  const t = CABINET_COPY[locale]
  const welcome = searchParams.get('welcome') === '1'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [vpnAccount, setVpnAccount] = useState<AccountResponse['vpnAccount']>(null)
  const [overview, setOverview] = useState<AccountOverview | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionResponse['subscription']>(null)
  const [servers, setServers] = useState<ServerItem[]>([])
  const [serversLoading, setServersLoading] = useState(true)
  const [selectedServer, setSelectedServer] = useState(() => localStorage.getItem('smolixSelectedServerId') || '')
  const [devices, setDevices] = useState<AccountDevice[]>([])
  const [history, setHistory] = useState<ConnectionHistoryItem[]>([])
  const [loadingExtra, setLoadingExtra] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!welcome) return
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      next.delete('welcome')
      setSearchParams(next, { replace: true })
    }, 12000)
    return () => window.clearTimeout(timer)
  }, [welcome, searchParams, setSearchParams])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const refreshAll = async () => {
    const [account, overviewData, sub, serverData, deviceData, historyData] = await Promise.all([
      getAccount(),
      getAccountOverview().catch(() => null),
      getSubscription().catch(() => ({ subscription: null })),
      getServers().catch(() => ({ servers: [] as ServerItem[] })),
      getAccountDevices().catch(() => ({ devices: [] as AccountDevice[] })),
      getAccountHistory().catch(() => ({ history: [] as ConnectionHistoryItem[] })),
    ])

    setUser(account.user)
    setVpnAccount(overviewData?.vpnAccount || account.vpnAccount)
    setOverview(overviewData)
    setSubscription(sub.subscription)
    setServers(serverData.servers)
    if (!selectedServer && serverData.servers[0]) {
      setSelectedServer(serverData.servers[0].id)
      localStorage.setItem('smolixSelectedServerId', serverData.servers[0].id)
    }
    setDevices(deviceData.devices)
    setHistory(historyData.history)
  }

  useEffect(() => {
    let active = true

    refreshAll()
      .catch(() => {
        if (active) navigate('/auth?mode=login', { replace: true })
      })
      .finally(() => {
        if (!active) return
        setCheckingSession(false)
        setServersLoading(false)
        setLoadingExtra(false)
      })

    return () => {
      active = false
    }
  }, [navigate])

  useEffect(() => {
    if (!user) return
    const interval = window.setInterval(() => {
      refreshAll().catch(() => undefined)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [user])

  const handleLogout = async () => {
    try {
      await logout()
      showToast('Вы вышли из аккаунта', 'success')
    } catch {
      showToast('Не удалось выйти корректно', 'error')
    } finally {
      navigate('/auth?mode=login', { replace: true })
    }
  }

  const lastConnection = overview?.lastConnection
  const isLikelyConnected = lastConnection?.status === 'CONNECTED' && !lastConnection.endedAt
  const greetingName = user?.email?.split('@')[0] || 'друг'

  const subscriptionProgress = useMemo(() => {
    if (!subscription?.expiresAt || !subscription.startsAt) return null
    const start = new Date(subscription.startsAt).getTime()
    const end = new Date(subscription.expiresAt).getTime()
    const now = Date.now()
    if (end <= start) return 0
    return Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100))
  }, [subscription])

  const navItems = [
    { to: '/app', end: true, label: t.navOverview, icon: LayoutDashboard },
    { to: '/app/vpn', end: false, label: t.navVpn, icon: Smartphone },
    { to: '/app/subscription', end: false, label: t.navSub, icon: CreditCard },
    { to: '/app/referral', end: false, label: t.navReferral, icon: Gift },
    { to: '/app/devices', end: false, label: t.navDevices, icon: MonitorSmartphone },
    { to: '/app/history', end: false, label: t.navHistory, icon: History },
    { to: '/app/settings', end: false, label: t.navSettings, icon: Settings },
  ]

  const refreshSubscription = async () => {
    const [sub, overviewRes] = await Promise.all([getSubscription(), getAccountOverview()])
    setSubscription(sub.subscription)
    setOverview(overviewRes)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <div className="text-teal-800 font-semibold">{t.sessionChecking}</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen app-bg text-[var(--ink)]">
      <SeoHead {...SEO_PAGES.app} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="h-[76px] bg-white/85 backdrop-blur-xl border-b border-[var(--border)] flex items-center justify-between px-5 md:px-9 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-[var(--canvas-2)]" aria-label="Меню">
            <Menu size={21} />
          </button>
          <Link to="/"><Brand /></Link>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-[var(--muted)] font-semibold">
          <span className={`w-2.5 h-2.5 rounded-full ${isLikelyConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {isLikelyConnected ? t.connectedHeader : t.cabinetHeader}
        </div>
        <div className="flex items-center gap-2">
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="hidden sm:inline-flex text-xs font-bold px-3 py-2 rounded-full bg-teal-50 text-teal-800 hover:bg-teal-100 transition">
              {t.admin}
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-full bg-teal-50 pl-2 pr-4 py-1.5">
            <div className="w-8 h-8 rounded-full brand-gradient text-white flex items-center justify-center text-xs font-bold">
              {user.email.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-semibold hidden sm:block max-w-[140px] truncate">{user.email}</span>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <button
          className="cabinet-backdrop md:hidden"
          aria-label="Закрыть меню"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="max-w-[1440px] mx-auto flex">
        <aside className={`cabinet-aside ${mobileOpen ? 'is-open' : ''}`}>
          <div className="flex items-center justify-between md:hidden mb-4">
            <span className="font-bold">Меню</span>
            <button onClick={() => setMobileOpen(false)} aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>
          <div className="text-[10px] tracking-[1.8px] font-bold text-[var(--muted)] px-3 mb-3 mt-1">{t.menu}</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition ${
                      isActive ? 'bg-teal-50 text-teal-800' : 'text-[var(--muted)] hover:bg-[var(--canvas-band)] hover:text-[var(--ink)]'
                    }`
                  }
                >
                  <Icon size={19} /> {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-auto">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-teal-50 to-cyan-50 border border-white">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-teal-700 mb-3 shadow-sm">
                <LifeBuoy size={19} />
              </div>
              <p className="font-bold text-sm">{t.helpTitle}</p>
              <p className="text-xs text-[var(--muted)] mt-1 leading-5">{t.helpText}</p>
              <Link to="/install" className="mt-3 text-xs font-bold text-teal-800 flex items-center gap-1">
                {t.helpLink} <ArrowUpRight size={13} />
              </Link>
            </div>
            <button
              onClick={handleLogout}
              className="mt-4 flex items-center gap-3 px-3 py-3 w-full rounded-xl text-sm text-[var(--muted)] hover:text-rose-500 hover:bg-rose-50 transition"
            >
              <LogOut size={18} /> {t.logout}
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-5 md:p-9 lg:p-10 cabinet-page-enter">
          <Routes>
            <Route
              index
              element={
                <DashboardView
                  greetingName={greetingName}
                  user={user}
                  vpnAccount={vpnAccount}
                  overview={overview}
                  subscription={subscription}
                  subscriptionProgress={subscriptionProgress}
                  isLikelyConnected={isLikelyConnected}
                  servers={servers}
                  serversLoading={serversLoading}
                  selectedServer={selectedServer}
                  devices={devices}
                  history={history}
                  loadingExtra={loadingExtra}
                  welcome={welcome}
                  locale={locale}
                  onVpnUpdated={setVpnAccount}
                  onToast={showToast}
                />
              }
            />
            <Route
              path="vpn"
              element={
                <VpnLinkView
                  vpnAccount={vpnAccount}
                  subscription={subscription}
                  onVpnUpdated={setVpnAccount}
                  onToast={showToast}
                />
              }
            />
            <Route
              path="subscription"
              element={
                <SubscriptionView
                  subscription={subscription}
                  subscriptionProgress={subscriptionProgress}
                  userEmail={user.email}
                  vpnAccount={vpnAccount}
                  deviceLimit={overview?.devices.deviceLimit ?? subscription?.plan.deviceLimit ?? 1}
                  deviceCount={devices.length}
                  onRefresh={refreshSubscription}
                  onVpnUpdated={setVpnAccount}
                  onToast={showToast}
                />
              }
            />
            <Route
              path="referral"
              element={<ReferralView onToast={showToast} />}
            />
            <Route
              path="devices"
              element={
                <DevicesView
                  devices={devices}
                  loading={loadingExtra}
                  subscription={subscription}
                  deviceLimit={overview?.devices.deviceLimit ?? subscription?.plan.deviceLimit ?? 1}
                  onRevokeOne={async (deviceId) => {
                    try {
                      const result = await revokeExtensionDevice(deviceId)
                      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
                      showToast(result.message, 'success')
                      const overviewData = await getAccountOverview().catch(() => null)
                      setOverview(overviewData)
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Ошибка', 'error')
                    }
                  }}
                  onRevoke={async () => {
                    try {
                      const result = await revokeAllExtensionDevices()
                      setDevices([])
                      showToast(result.message, 'success')
                      const overviewData = await getAccountOverview().catch(() => null)
                      setOverview(overviewData)
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Ошибка', 'error')
                    }
                  }}
                />
              }
            />
            <Route
              path="history"
              element={<HistoryView history={history} loading={loadingExtra} />}
            />
            <Route
              path="settings"
              element={
                <SettingsView
                  user={user}
                  locale={locale}
                  onLocaleChange={(next) => {
                    writeCabinetLocale(next)
                    setLocale(next)
                    showToast(next === 'en' ? 'Language: English' : 'Язык: русский', 'success')
                  }}
                  onPasswordChanged={() => {
                    showToast(locale === 'en' ? 'Password changed. Sign in again.' : 'Пароль изменён. Войдите снова.', 'success')
                    navigate('/auth?mode=login', { replace: true })
                  }}
                  onError={(message) => showToast(message, 'error')}
                  onToast={showToast}
                  onUserRefresh={async () => {
                    const account = await getAccount()
                    setUser(account.user)
                  }}
                />
              }
            />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(data)}`
}

function SubscriptionLinkCard({
  vpnAccount,
  onVpnUpdated,
  onToast,
  compact = false,
}: {
  vpnAccount: VpnAccountInfo | null
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const url = vpnAccount?.subscriptionUrl || null

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      onToast('Ссылка скопирована', 'success')
    } catch {
      onToast('Не удалось скопировать', 'error')
    }
  }

  const refresh = async () => {
    setBusy(true)
    try {
      const result = await refreshVpnSubscription()
      onVpnUpdated(result.vpnAccount)
      onToast(result.message, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Не удалось обновить ссылку', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`glass-card rounded-2xl ${compact ? 'p-5' : 'p-5 md:p-6'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Remnawave подписка</p>
          <h3 className="font-bold text-lg mt-1">Компьютер, телефон и TV</h3>
          <p className="text-sm text-[var(--muted)] mt-1">
            Одна ссылка для Windows / macOS / Linux / Android / iOS — как на странице{' '}
            <span className="font-mono text-xs">node.jetsale.online/…</span>
          </p>
        </div>
        <Smartphone className="text-teal-600 shrink-0" size={22} />
      </div>

      {!url ? (
        <div className="mt-5 rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-amber-900">Ссылка ещё не готова</p>
          <p className="text-xs text-amber-800/80 mt-1">Нажмите «Получить ссылку» — создадим пользователя в Remnawave.</p>
          <button
            type="button"
            disabled={busy}
            onClick={refresh}
            className="mt-3 inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Создаём…' : 'Получить ссылку'}
          </button>
        </div>
      ) : (
        <div className={`mt-5 grid gap-5 ${compact ? '' : 'md:grid-cols-[200px_1fr]'}`}>
          <div className="rounded-2xl bg-white border border-[var(--border)] p-3 w-fit mx-auto md:mx-0">
            <img
              src={qrUrl(url)}
              alt="QR код подписки SMOLIX"
              width={200}
              height={200}
              className="rounded-xl"
            />
            <p className="text-[11px] text-center text-[var(--muted)] mt-2 flex items-center justify-center gap-1">
              <QrCode size={12} /> QR для телефона
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">Ваша ссылка подписки</p>
            <p className="font-mono text-sm break-all bg-[var(--canvas-band)] border border-[var(--border)] rounded-xl px-3 py-3">
              {url}
            </p>
            {vpnAccount?.subscriptionShortUuid && (
              <p className="text-xs text-[var(--muted)] mt-2">
                shortUuid: <span className="font-mono">{vpnAccount.subscriptionShortUuid}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold"
              >
                <ExternalLink size={15} /> Открыть страницу установки
              </a>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--canvas-band)]"
              >
                <Copy size={15} /> Копировать ссылку
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--muted)] hover:bg-[var(--canvas-band)] disabled:opacity-60"
              >
                <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                Обновить
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              На странице подписки: выбор ОС → скачать FlClashX / Koala Clash / Prizrak-Box → «Добавить подписку».
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function VpnLinkView({
  vpnAccount,
  subscription,
  onVpnUpdated,
  onToast,
}: {
  vpnAccount: AccountResponse['vpnAccount']
  subscription: SubscriptionResponse['subscription']
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">Все устройства</p>
      <h1 className="text-3xl font-bold tracking-normal">VPN-ссылка</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8 max-w-2xl">
        Персональная подписка Remnawave. Работает на компьютере и телефоне: откройте ссылку —
        там установка клиента и кнопка «Добавить подписку».
      </p>
      <div className="max-w-3xl">
        <TrialBanner subscription={subscription} />
        <SubscriptionLinkCard
          vpnAccount={vpnAccount}
          onVpnUpdated={onVpnUpdated}
          onToast={onToast}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5 max-w-3xl">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold mb-3">Компьютер (Windows / macOS / Linux)</h3>
          <ol className="space-y-2 text-sm text-[var(--muted)] list-decimal pl-5">
            <li>Откройте ссылку подписки в браузере</li>
            <li>Выберите ОС и клиент: FlClashX, Koala Clash или Prizrak-Box</li>
            <li>Скачайте установщик и установите приложение</li>
            <li>Нажмите «Добавить подписку» (или вставьте URL вручную в Profiles → + → URL)</li>
            <li>Обновите профиль и подключитесь</li>
          </ol>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold mb-3">Телефон и TV</h3>
          <ol className="space-y-2 text-sm text-[var(--muted)] list-decimal pl-5">
            <li>Отсканируйте QR или откройте ту же ссылку</li>
            <li>Android / iOS / Android TV / Apple TV — клиент со страницы подписки</li>
            <li>Либо Happ / v2rayNG / Streisand / Shadowrocket → импорт по URL</li>
            <li>Обновите список серверов и подключитесь</li>
          </ol>
        </div>
      </div>
    </>
  )
}

function DashboardView({
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
  const needsSetup = devices.length === 0 && (overview?.devices.activeCount ?? 0) === 0
  const provisioned = vpnAccount?.isProvisioned
  const hasSubUrl = Boolean(vpnAccount?.subscriptionUrl)
  const hasFirstConnection = history.length > 0
  const deviceLimit = overview?.devices.deviceLimit ?? subscription?.plan.deviceLimit ?? 1
  const deviceCount = Math.max(overview?.devices.activeCount ?? 0, devices.length)
  const step1Done = !needsSetup
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

      <UnifiedAccessStatus subscription={subscription} subscriptionProgress={subscriptionProgress} locale={locale} />

      <section className={`status-banner mb-6 ${isLikelyConnected ? 'online' : 'offline'}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{t.statusEyebrow}</p>
          <h2 className="text-2xl font-extrabold mt-2">
            {isLikelyConnected ? t.statusOnline : t.statusOffline}
          </h2>
          <p className="text-sm mt-2 opacity-80">
            {overview?.lastConnection
              ? `${overview.lastConnection.mode === 'youtube' ? 'YouTube' : 'Весь интернет'} · ${formatDate(overview.lastConnection.startedAt)}`
              : t.statusHint}
          </p>
          <p className="text-xs mt-2 opacity-70">{t.statusRuSplit}</p>
        </div>
        <div className="status-banner-meta">
          <div>
            <small>{t.location}</small>
            <strong>{selected ? `${flagFor(selected.country)} ${selected.country}` : 'в расширении'}</strong>
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
              <p className="text-xl font-bold mt-4">{user.status === 'ACTIVE' ? 'Активен' : user.status}</p>
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
                  ? `осталось ${formatRemaining(subscription.remainingSeconds)}`
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
              <p className="font-semibold text-sm text-[var(--ink)]">Каталог пуст</p>
              <p className="text-xs text-[var(--muted)] mt-1">Подключайтесь через расширение — список нод там актуальный.</p>
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="text-left rounded-xl p-4 border border-[var(--border)] bg-[var(--canvas-band)]/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{flagFor(server.country)}</span>
                  <span className="text-[11px] font-bold text-[var(--muted)]">справочник</span>
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

function SubscriptionView({
  subscription,
  subscriptionProgress,
  userEmail,
  vpnAccount,
  deviceLimit,
  deviceCount,
  onRefresh,
  onVpnUpdated,
  onToast,
}: {
  subscription: SubscriptionResponse['subscription']
  subscriptionProgress: number | null
  userEmail: string
  vpnAccount: AccountResponse['vpnAccount']
  deviceLimit: number
  deviceCount: number
  onRefresh: () => Promise<void>
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [params, setParams] = useSearchParams()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [provider, setProvider] = useState<'yookassa' | 'mock'>('mock')
  const [busy, setBusy] = useState(false)
  const [payState, setPayState] = useState<'idle' | 'checking' | 'success' | 'pending'>('idle')
  const [orders, setOrders] = useState<AccountOrder[]>([])
  const [couponCode, setCouponCode] = useState('')

  const loadOrders = async () => {
    try {
      const res = await getAccountOrders()
      setOrders(res.orders)
    } catch {
      setOrders([])
    }
  }

  useEffect(() => {
    getBillingPlans()
      .then((res) => {
        setPlans(res.plans)
        setProvider(res.provider)
      })
      .catch(() => {
        setPlans([])
      })
    loadOrders()
  }, [])

  useEffect(() => {
    const mockPay = params.get('mockPay')
    if (!mockPay) return

    let cancelled = false
    ;(async () => {
      setBusy(true)
      setPayState('checking')
      try {
        const result = await confirmMockPayment(mockPay)
        if (!cancelled) {
          await onRefresh()
          await loadOrders()
          setPayState('success')
          onToast(result.message, 'success')
          const next = new URLSearchParams(params)
          next.delete('mockPay')
          setParams(next, { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          setPayState('idle')
          onToast(err instanceof Error ? err.message : 'Не удалось подтвердить оплату', 'error')
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params, onRefresh, onToast, setParams])

  useEffect(() => {
    if (params.get('paid') !== '1') return

    let cancelled = false
    let attempts = 0
    setPayState('checking')
    setBusy(true)

    const poll = async () => {
      attempts += 1
      try {
        await onRefresh()
        await loadOrders()
        const sub = await getSubscription()
        if (cancelled) return
        if (sub.subscription?.status === 'ACTIVE' && !sub.subscription.isTrial) {
          setPayState('success')
          onToast('Premium активирован', 'success')
          const next = new URLSearchParams(params)
          next.delete('paid')
          setParams(next, { replace: true })
          setBusy(false)
          return
        }
        if (attempts >= 8) {
          setPayState('pending')
          onToast('Оплата ещё обрабатывается — обновите через минуту', 'success')
          const next = new URLSearchParams(params)
          next.delete('paid')
          setParams(next, { replace: true })
          setBusy(false)
          return
        }
        window.setTimeout(poll, 2000)
      } catch {
        if (!cancelled) {
          setPayState('pending')
          setBusy(false)
        }
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [params, onRefresh, onToast, setParams])

  const premiumPlan = plans[0]
  const isPremiumActive = subscription?.status === 'ACTIVE' && !subscription.isTrial
  const isTrial = subscription?.status === 'ACTIVE' && subscription.isTrial

  const handleCheckout = async () => {
    setBusy(true)
    try {
      const checkout = await createCheckout({
        planId: premiumPlan?.id,
        planSlug: premiumPlan?.slug || 'premium-month',
        couponCode: couponCode.trim() || undefined,
      })
      window.location.href = checkout.confirmationUrl
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Не удалось начать оплату', 'error')
      setBusy(false)
    }
  }

  const handleWaitlist = async () => {
    setBusy(true)
    try {
      await joinWaitlist(userEmail, 'cabinet-premium')
      onToast('Вы в waitlist Premium', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Не удалось записаться', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">Доступ</p>
      <h1 className="text-3xl font-bold tracking-normal">Подписка</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8">
        Тариф, срок действия и оплата Premium{provider === 'mock' ? ' (mock-режим)' : ' через ЮKassa'}.
      </p>

      <div className="max-w-4xl">
        <TrialBanner subscription={subscription} />
      </div>

      <div className="mb-6 max-w-4xl">
        <SubscriptionLinkCard
          vpnAccount={vpnAccount}
          onVpnUpdated={onVpnUpdated}
          onToast={onToast}
          compact
        />
      </div>

      {payState === 'checking' && (
        <div className="glass-card rounded-2xl p-5 mb-5 max-w-4xl border border-teal-100 bg-teal-50/50">
          <p className="font-bold text-teal-900">Проверяем оплату…</p>
          <p className="text-sm text-teal-800/80 mt-1">Обычно занимает несколько секунд.</p>
        </div>
      )}
      {payState === 'success' && (
        <div className="glass-card glass-card-accent rounded-2xl p-5 mb-5 max-w-4xl border border-emerald-100 bg-emerald-50/70">
          <p className="font-bold text-emerald-900">Оплата прошла — чек-лист</p>
          <ol className="mt-3 space-y-2 text-sm text-emerald-900/90 list-decimal pl-5">
            <li>Ссылка подписки готова в блоке ниже{vpnAccount?.subscriptionUrl ? ' ✓' : ' — нажмите «Получить ссылку»'}</li>
            <li>Откройте QR или скопируйте URL на телефон / TV</li>
            <li>В Chrome переподключите расширение в режиме «Весь интернет»</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/app/vpn" className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold">
              <Smartphone size={16} /> VPN-ссылка
            </Link>
            <Link to="/install" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900">
              <Download size={16} /> Инструкция
            </Link>
          </div>
        </div>
      )}

      {payState === 'pending' && (
        <div className="glass-card rounded-2xl p-5 mb-5 max-w-4xl border border-amber-100 bg-amber-50/70">
          <p className="font-bold text-amber-900">Оплата ещё обрабатывается</p>
          <p className="text-sm text-amber-800/80 mt-1">Обновите страницу через минуту. Если Premium не появится — напишите в поддержку с email заказа.</p>
        </div>
      )}

      <div className="glass-card rounded-2xl p-5 mb-5 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Текущий доступ</p>
            <p className="text-xl font-extrabold mt-1">
              {isPremiumActive
                ? `Premium · ${subscription?.plan.name ?? 'Premium'}`
                : isTrial
                  ? `Trial Premium · ${subscription?.plan.name ?? 'Trial'}`
                  : 'Free YouTube'}
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">
              {subscription?.expiresAt
                ? `До ${formatDate(subscription.expiresAt)}${subscription.remainingSeconds != null ? ` · ещё ${formatRemaining(subscription.remainingSeconds)}` : ''}`
                : 'Без срока — YouTube в расширении'}
            </p>
            {isTrial && (
              <p className="text-xs text-amber-700 mt-2">После trial останется бесплатный YouTube; полный интернет — только с Premium.</p>
            )}
          </div>
          <div className="text-right">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              isPremiumActive ? 'bg-emerald-50 text-emerald-700' : isTrial ? 'bg-amber-50 text-amber-700' : 'bg-[var(--canvas-2)] text-[var(--muted)]'
            }`}>
              {isPremiumActive ? 'АКТИВНА' : isTrial ? 'TRIAL' : 'FREE'}
            </span>
            <p className="text-sm text-[var(--muted)] mt-3">Устройства</p>
            <p className="font-extrabold text-lg">{deviceCount}/{deviceLimit}</p>
          </div>
        </div>
        {subscriptionProgress != null && (
          <div className="mt-4 h-2.5 rounded-full bg-[var(--canvas-2)] overflow-hidden">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${subscriptionProgress}%` }} />
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 max-w-4xl">
        <div className="glass-card rounded-3xl p-7 border border-emerald-100">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Zap size={24} />
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">FREE</span>
          </div>
          <h2 className="text-2xl font-bold mt-5">YouTube</h2>
          <p className="text-sm text-[var(--muted)] mt-2">Бесплатный режим в расширении без оплаты.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {['YouTube и Shorts', 'Без подписки', 'Остальные сайты напрямую'].map((item) => (
              <li key={item} className="flex items-center gap-2"><Check size={16} className="text-emerald-500" />{item}</li>
            ))}
          </ul>
          <div className="mt-7 w-full rounded-xl bg-emerald-50 text-emerald-700 py-3 font-semibold text-center">
            Доступен в расширении
          </div>
        </div>

        <div className="glass-card rounded-3xl p-7">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <Globe2 size={24} />
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              isPremiumActive ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'
            }`}>
              {isPremiumActive ? 'АКТИВНА' : 'PREMIUM'}
            </span>
          </div>
          <h2 className="text-2xl font-bold mt-5">Весь интернет</h2>
          <p className="text-3xl font-extrabold mt-2">
            {premiumPlan ? `${premiumPlan.price} ${premiumPlan.currency === 'RUB' ? '₽' : premiumPlan.currency}` : '299 ₽'}/мес
          </p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Полный доступ через прокси SMOLIX
            {premiumPlan?.deviceLimit ? ` · до ${premiumPlan.deviceLimit} устройств` : ''}.
          </p>
          <label className="block mt-5 text-sm font-semibold">
            Промокод
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.trim())}
              placeholder="Необязательно"
              className="mt-2 w-full h-11 rounded-xl border border-[var(--border)] px-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={handleCheckout}
            className="mt-4 w-full rounded-xl brand-gradient text-white py-3 font-semibold hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {busy ? 'Подождите…' : isPremiumActive ? 'Продлить Premium' : isTrial ? 'Купить Premium сейчас' : 'Оплатить Premium'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleWaitlist}
            className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white py-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--canvas-band)] transition disabled:opacity-60"
          >
            Или в waitlist
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden max-w-4xl mt-6">
        <div className="px-5 py-4 border-b border-[var(--border)] font-bold">История оплат</div>
        {orders.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--muted)]">Пока нет оплат</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {orders.map((order) => (
              <div key={order.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{order.plan.name}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {formatDate(order.createdAt)} · заказ <span className="font-mono">{order.id.slice(0, 8)}</span>
                    {order.payment?.provider ? ` · ${order.payment.provider}` : ''}
                    {order.payment?.status ? ` · pay ${order.payment.status}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{order.amount} {order.currency === 'RUB' ? '₽' : order.currency}</span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    order.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--canvas-2)] text-[var(--muted)]'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ReferralView({ onToast }: { onToast: (message: string, type: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    code: string
    inviteUrl: string
    invitedCount: number
    daysPerInvite: number
    pendingCount?: number
    grantedCount?: number
    rewardHint?: string
    rewards: Array<{
      id: string
      daysGranted: number
      status?: 'PENDING' | 'GRANTED' | 'REJECTED'
      createdAt: string
      email: string
    }>
  } | null>(null)

  useEffect(() => {
    getReferral()
      .then(setData)
      .catch((err) => onToast(err instanceof Error ? err.message : 'Не удалось загрузить рефералку', 'error'))
      .finally(() => setLoading(false))
  }, [onToast])

  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.inviteUrl)
      onToast('Ссылка скопирована', 'success')
    } catch {
      onToast('Не удалось скопировать', 'error')
    }
  }

  const statusLabel = (status?: string) => {
    if (status === 'PENDING') return 'ожидает'
    if (status === 'REJECTED') return 'не засчитано'
    return 'начислено'
  }

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">Бонусы</p>
      <h1 className="text-3xl font-bold tracking-normal">Рефералка</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8">
        Пригласите друга — получите +{data?.daysPerInvite ?? 7} дней Premium после его реального входа.
      </p>

      <div className="glass-card rounded-3xl p-6 max-w-3xl">
        {loading || !data ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--muted)]">Ваш код</p>
                <p className="text-2xl font-extrabold tracking-wide mt-1">{data.code}</p>
              </div>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-teal-50 text-teal-800">
                +{data.daysPerInvite} дней / друг
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-4 break-all">{data.inviteUrl}</p>
            <button
              type="button"
              onClick={copy}
              className="mt-5 inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-3 text-sm font-bold"
            >
              <Copy size={16} /> Скопировать ссылку
            </button>
            <p className="text-sm text-[var(--muted)] mt-5">
              Приглашено: {data.invitedCount}
              {typeof data.grantedCount === 'number' ? ` · начислено: ${data.grantedCount}` : ''}
              {typeof data.pendingCount === 'number' && data.pendingCount > 0 ? ` · ожидает: ${data.pendingCount}` : ''}
            </p>
            {data.rewardHint && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3">
                {data.rewardHint}
              </p>
            )}
            <div className="mt-4 space-y-2">
              {data.rewards.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Пока нет начислений</p>
              ) : (
                data.rewards.map((item) => (
                  <div key={item.id} className="rounded-xl bg-[var(--canvas-band)] px-4 py-3 flex items-center justify-between gap-3 text-sm">
                    <span>{item.email}</span>
                    <span className={`font-semibold ${
                      item.status === 'PENDING' ? 'text-amber-700' : item.status === 'REJECTED' ? 'text-[var(--muted)]' : 'text-teal-800'
                    }`}>
                      {item.status === 'GRANTED' || !item.status ? `+${item.daysGranted} д` : statusLabel(item.status)}
                      {' · '}{formatDate(item.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function DevicesView({
  devices,
  loading,
  subscription,
  deviceLimit,
  onRevoke,
  onRevokeOne,
}: {
  devices: AccountDevice[]
  loading: boolean
  subscription: SubscriptionResponse['subscription']
  deviceLimit: number
  onRevoke: () => Promise<void>
  onRevokeOne: (deviceId: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const overLimit = devices.length > deviceLimit

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">Безопасность</p>
      <h1 className="text-3xl font-bold tracking-normal">Устройства</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-3">Активные сессии расширения SMOLIX.</p>
      <TrialBanner subscription={subscription} />
      <p className={`text-sm font-semibold mb-8 ${overLimit ? 'text-rose-600' : 'text-[var(--muted)]'}`}>
        Используется {devices.length} из {deviceLimit}
        {overLimit ? ' — лимит превышен, отключите лишние устройства' : ''}
      </p>

      <div className="glass-card rounded-2xl overflow-hidden max-w-3xl">
        {loading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center">
            <MonitorSmartphone className="mx-auto text-teal-600 mb-3" size={28} />
            <p className="font-bold">Нет активных устройств</p>
            <p className="text-sm text-[var(--muted)] mt-1">Войдите в расширение — сессия появится здесь.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {devices.map((device) => (
              <div key={device.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{device.deviceName}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {device.deviceId || device.id.slice(0, 8)} · last {formatDate(device.lastUsedAt || device.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 w-fit">
                    до {formatDate(device.expiresAt)}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === device.id}
                    onClick={async () => {
                      setBusyId(device.id)
                      try {
                        await onRevokeOne(device.id)
                      } finally {
                        setBusyId(null)
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {busyId === device.id ? '…' : 'Отключить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {devices.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRevoke()
            } finally {
              setBusy(false)
            }
          }}
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-bold hover:bg-rose-100 transition disabled:opacity-60"
        >
          {busy ? 'Отключаем…' : 'Выйти со всех устройств расширения'}
        </button>
      )}
    </>
  )
}

function HistoryView({ history, loading }: { history: ConnectionHistoryItem[]; loading: boolean }) {
  const durationLabel = (item: ConnectionHistoryItem) => {
    if (!item.endedAt) return item.status === 'CONNECTED' ? 'сейчас' : null
    const ms = new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return null
    const mins = Math.round(ms / 60000)
    if (mins < 1) return '<1 мин'
    if (mins < 60) return `${mins} мин`
    return `${Math.floor(mins / 60)} ч ${mins % 60} мин`
  }

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">Активность</p>
      <h1 className="text-3xl font-bold tracking-normal">История</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8">Последние подключения через расширение.</p>

      <div className="glass-card rounded-2xl overflow-hidden max-w-3xl">
        {loading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center">
            <History className="mx-auto text-teal-600 mb-3" size={28} />
            <p className="font-bold">История пуста</p>
            <p className="text-sm text-[var(--muted)] mt-1">Подключения появятся после использования расширения.</p>
            <Link to="/install" className="mt-4 inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold">
              <Download size={15} /> Открыть инструкцию
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {history.map((item) => {
              const duration = durationLabel(item)
              return (
                <div key={item.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className={`font-semibold text-sm ${
                      item.status === 'CONNECTED' ? 'text-emerald-700' : item.status === 'FAILED' ? 'text-rose-600' : 'text-[var(--muted)]'
                    }`}>
                      {item.status === 'CONNECTED' ? 'Подключено' : item.status === 'FAILED' ? 'Ошибка' : 'Отключено'}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {item.mode === 'youtube' ? 'YouTube' : 'Весь интернет'}
                      {item.serverId ? ` · ${item.serverId.slice(0, 8)}` : ''}
                      {' · '}{formatDate(item.startedAt)}
                      {duration ? ` · ${duration}` : ''}
                    </p>
                    {item.message && (
                      <p className={`text-xs mt-1 ${item.status === 'FAILED' ? 'text-rose-500' : 'text-[var(--muted)]'}`}>
                        {item.message}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function SettingsView({
  user,
  locale,
  onLocaleChange,
  onPasswordChanged,
  onError,
  onToast,
  onUserRefresh,
}: {
  user: User
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  onPasswordChanged: () => void
  onError: (message: string) => void
  onToast: (message: string, type?: 'success' | 'error') => void
  onUserRefresh: () => Promise<void>
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null)
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false)
  const t = CABINET_COPY[locale]
  const en = locale === 'en'

  const supportCode = user.supportCode || '—'

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const res = await getWebSessions()
      setSessions(res.sessions)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions().catch(() => undefined)
  }, [])

  const copyText = async (label: string, value: string) => {
    if (!value || value === '—') return
    try {
      await navigator.clipboard.writeText(value)
      onToast(t.settingsCopied, 'success')
    } catch {
      onError(en ? `Could not copy ${label}` : `Не удалось скопировать ${label}`)
    }
  }

  const supportMailto = useMemo(() => {
    const subject = encodeURIComponent(`SMOLIX ${supportCode}`)
    const body = encodeURIComponent(
      `${en ? 'Email' : 'Email'}: ${user.email}\n${t.settingsUserId}: ${user.id}\n${t.settingsSupportCode}: ${supportCode}\n\n`,
    )
    return `mailto:support@smolix.app?subject=${subject}&body=${body}`
  }, [user.email, user.id, supportCode, t, en])

  const requestVerify = async () => {
    setVerifyBusy(true)
    try {
      const result = await requestEmailVerification()
      onToast(result.message || t.settingsVerifyEmailSent, 'success')
    } catch (err) {
      onError(err instanceof Error ? err.message : en ? 'Could not send email' : 'Не удалось отправить письмо')
    } finally {
      setVerifyBusy(false)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      onPasswordChanged()
    } catch (error) {
      onError(error instanceof Error ? error.message : en ? 'Could not change password' : 'Не удалось сменить пароль')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">{en ? 'Account' : 'Аккаунт'}</p>
      <h1 className="text-3xl font-bold tracking-normal">{en ? 'Settings' : 'Настройки'}</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8">
        {en ? 'Profile, language and password.' : 'Профиль, язык и смена пароля.'}
      </p>

      {!user.emailVerifiedAt && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 mb-5 max-w-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-bold text-amber-900">{t.settingsVerifyEmailTitle}</p>
            <p className="text-sm text-amber-800/80 mt-1">{t.settingsVerifyEmailText}</p>
          </div>
          <button
            type="button"
            disabled={verifyBusy}
            onClick={requestVerify}
            className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit disabled:opacity-60"
          >
            {verifyBusy ? '…' : t.settingsVerifyEmailBtn}
          </button>
        </section>
      )}

      <div className="glass-card rounded-2xl p-6 max-w-2xl mb-5">
        <h3 className="font-bold mb-5">{en ? 'Profile' : 'Профиль'}</h3>
        <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
          <div className="w-14 h-14 rounded-2xl brand-gradient text-white flex items-center justify-center font-bold text-lg">
            {user.email.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold">{user.email}</p>
            <p className="text-sm text-[var(--muted)]">{en ? 'Role' : 'Роль'}: {user.role || 'USER'}</p>
          </div>
        </div>
        <div className="pt-5 grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{en ? 'Email' : 'Электронная почта'}</p>
            <p className="font-semibold text-sm break-all">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{en ? 'Language' : 'Язык кабинета'}</p>
            <div className="mt-1 inline-flex rounded-xl border border-[var(--border)] overflow-hidden">
              {(['ru', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLocaleChange(code)}
                  className={`px-3 py-2 text-xs font-bold ${locale === code ? 'brand-gradient text-white' : 'bg-white text-[var(--muted)]'}`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid sm:grid-cols-2 gap-4 pt-5 border-t border-[var(--border)]">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{t.settingsSupportCode}</p>
            <div className="flex items-center gap-2">
              <p className="font-mono font-bold text-sm">{supportCode}</p>
              <button
                type="button"
                onClick={() => copyText(t.settingsSupportCode, supportCode)}
                className="text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1"
              >
                <Copy size={13} /> {t.settingsCopy}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{t.settingsUserId}</p>
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-mono text-xs break-all">{user.id}</p>
              <button
                type="button"
                onClick={() => copyText(t.settingsUserId, user.id)}
                className="text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <Copy size={13} /> {t.settingsCopy}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={supportMailto}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold"
          >
            <LifeBuoy size={15} /> {t.settingsContactSupport}
          </a>
          <Link to="/install" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
            <Download size={15} /> {en ? 'Install guide' : 'Инструкция'}
          </Link>
          <Link to="/app/vpn" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
            <Smartphone size={15} /> {en ? 'VPN link' : 'VPN-ссылка'}
          </Link>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 max-w-2xl mb-5">
        <h3 className="font-bold mb-1">{t.settingsWebSessions}</h3>
        <p className="text-xs text-[var(--muted)] mb-4">{t.settingsWebSessionsHint}</p>
        {sessionsLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">—</p>
        ) : (
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">
            {sessions.map((session) => (
              <div key={session.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-white">
                <div>
                  <p className="font-semibold">
                    {formatDate(session.createdAt)}
                    {session.current && (
                      <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                        {t.settingsSessionCurrent}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {en ? 'Expires' : 'До'} {formatDate(session.expiresAt)}
                  </p>
                </div>
                {!session.current && (
                  <button
                    type="button"
                    disabled={sessionBusyId === session.id}
                    onClick={async () => {
                      setSessionBusyId(session.id)
                      try {
                        const result = await revokeWebSession(session.id)
                        onToast(result.message, 'success')
                        await loadSessions()
                        await onUserRefresh().catch(() => undefined)
                      } catch (err) {
                        onError(err instanceof Error ? err.message : 'Ошибка')
                      } finally {
                        setSessionBusyId(null)
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {sessionBusyId === session.id ? '…' : t.settingsRevokeSession}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {sessions.some((s) => !s.current) && (
          <button
            type="button"
            disabled={revokeOthersBusy}
            onClick={async () => {
              setRevokeOthersBusy(true)
              try {
                const result = await revokeOtherWebSessions()
                onToast(result.message, 'success')
                await loadSessions()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Ошибка')
              } finally {
                setRevokeOthersBusy(false)
              }
            }}
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2.5 text-sm font-bold hover:bg-rose-100 disabled:opacity-60"
          >
            {revokeOthersBusy ? '…' : t.settingsRevokeOthers}
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 max-w-2xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <LockKeyhole size={18} className="text-teal-700" />
          <h3 className="font-bold">{en ? 'Change password' : 'Сменить пароль'}</h3>
        </div>
        <label className="block text-sm font-semibold">
          {en ? 'Current password' : 'Текущий пароль'}
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] px-4 outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500"
          />
        </label>
        <label className="block text-sm font-semibold">
          {en ? 'New password' : 'Новый пароль'}
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] px-4 outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl brand-gradient text-white font-bold disabled:opacity-60"
        >
          {busy ? (en ? 'Saving…' : 'Сохраняем…') : (en ? 'Update password' : 'Сменить пароль')}
        </button>
        <p className="text-xs text-[var(--muted)]">
          {en
            ? 'Changing password signs you out of the site and extension sessions.'
            : 'После смены пароля все сессии сайта и расширения будут сброшены.'}
        </p>
      </form>
    </>
  )
}
