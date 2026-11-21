import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Settings, LayoutDashboard,
  CreditCard, LifeBuoy, LogOut, Menu, X, ArrowUpRight,
  MonitorSmartphone, History, Gift, Smartphone,
} from 'lucide-react'
import {
  getAccount,
  getAccountOverview,
  getAccountDevices,
  getAccountHistory,
  getSubscription,
  getServers,
  revokeAllExtensionDevices,
  revokeExtensionDevice,
  logout,
  type User,
  type ServerItem,
  type SubscriptionResponse,
  type AccountOverview,
  type AccountDevice,
  type ConnectionHistoryItem,
  type AccountResponse,
} from '../api'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'
import { CABINET_COPY, readCabinetLocale, writeCabinetLocale } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { Brand } from '../cabinet/Brand'
import { Toast } from '../cabinet/Toast'
import { DashboardView } from '../cabinet/DashboardView'
import { VpnLinkView } from '../cabinet/VpnLinkView'
import { SubscriptionView } from '../cabinet/SubscriptionView'
import { ReferralView } from '../cabinet/ReferralView'
import { DevicesView } from '../cabinet/DevicesView'
import { HistoryView } from '../cabinet/HistoryView'
import { SettingsView } from '../cabinet/SettingsView'

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
      showToast(t.logoutOk, 'success')
    } catch {
      showToast(t.logoutFail, 'error')
    } finally {
      navigate('/auth?mode=login', { replace: true })
    }
  }

  const lastConnection = overview?.lastConnection
  const isLikelyConnected = lastConnection?.status === 'CONNECTED' && !lastConnection.endedAt
  const greetingName = user?.email?.split('@')[0] || t.friendFallback

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
                  locale={locale}
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
                  locale={locale}
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
              element={<ReferralView locale={locale} onToast={showToast} />}
            />
            <Route
              path="devices"
              element={
                <DevicesView
                  locale={locale}
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
                      showToast(error instanceof Error ? error.message : t.genericError, 'error')
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
                      showToast(error instanceof Error ? error.message : t.genericError, 'error')
                    }
                  }}
                />
              }
            />
            <Route
              path="history"
              element={<HistoryView locale={locale} history={history} loading={loadingExtra} />}
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
                    showToast(next === 'en' ? t.langSwitchedEn : t.langSwitchedRu, 'success')
                  }}
                  onPasswordChanged={() => {
                    showToast(locale === 'en' ? t.passwordChangedEn : t.passwordChangedRu, 'success')
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