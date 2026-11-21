import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, RefreshCw, LogOut, Users, CreditCard, Server, MonitorSmartphone,
  ArrowLeft, Mail, Network, ExternalLink, Receipt, Bell, AlertTriangle,
  Search, Gift, ScrollText, Layers, Download, FileText,
} from 'lucide-react'
import {
  getAccount,
  getAdminStats,
  getAdminRetention,
  getAdminUsers,
  getAdminSubscriptions,
  getAdminServers,
  getAdminSessions,
  getAdminWaitlist,
  getAdminOrders,
  getAdminUser,
  getAdminAlerts,
  getAdminSearch,
  getAdminReferrals,
  getAdminAudit,
  getAdminPlans,
  getAdminCoupons,
  runAdminProbe,
  ackAdminAlert,
  resolveAdminAlert,
  notifyAdminWaitlist,
  sendAdminMailBroadcast,
  getAdminRemnawave,
  syncAdminRemnawaveUser,
  updateAdminUserStatus,
  updateAdminUserNote,
  extendAdminUser,
  cancelAdminUserSubscription,
  updateAdminServer,
  revokeAdminSession,
  markAdminOrderPaid,
  refundAdminOrder,
  impersonateAdminUser,
  getAdminSitePages,
  updateAdminSitePage,
  logout,
  type SitePage,
  type User,
  type AdminStats,
  type AdminUser,
  type AdminUserDetail,
  type AdminSubscription,
  type AdminServer,
  type AdminSession,
  type AdminRemnawave,
  type AdminOrder,
  type AdminAlert,
  type ProbeTarget,
} from '../api'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'
import { AdminToast } from '../admin/AdminToast'
import { exportOrdersCsv } from '../admin/exportOrdersCsv'
import { formatDate } from '../admin/formatDate'
import { formatAdminMoney } from '../admin/money'
import { OverviewTab } from '../admin/OverviewTab'
import { PaginationBar } from '../admin/PaginationBar'

type Tab =
  | 'overview'
  | 'alerts'
  | 'users'
  | 'subscriptions'
  | 'orders'
  | 'servers'
  | 'sessions'
  | 'waitlist'
  | 'remnawave'
  | 'referrals'
  | 'audit'
  | 'plans'
  | 'pages'

type WaitlistEntry = { id: string; email: string; source: string; notifiedAt?: string | null; createdAt: string }

type RetentionStats = Awaited<ReturnType<typeof getAdminRetention>>
type ReferralsData = Awaited<ReturnType<typeof getAdminReferrals>>
type AdminSearchResult = Awaited<ReturnType<typeof getAdminSearch>>
type AdminPlanRow = Awaited<ReturnType<typeof getAdminPlans>>['plans'][number]
type AdminCouponRow = Awaited<ReturnType<typeof getAdminCoupons>>['coupons'][number]
type AuditItem = Awaited<ReturnType<typeof getAdminAudit>>['items'][number]

export default function AdminPanel() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [orderStatus, setOrderStatus] = useState<'ALL' | 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'>('ALL')
  const [orderQuery, setOrderQuery] = useState('')
  const [servers, setServers] = useState<AdminServer[]>([])
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [waitlistCount, setWaitlistCount] = useState(0)
  const [waitlistPending, setWaitlistPending] = useState(0)
  const [waitlistPendingOnly, setWaitlistPendingOnly] = useState(false)
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [mailSubject, setMailSubject] = useState('Новости jetsale.online')
  const [mailTitle, setMailTitle] = useState('Обновление сервиса')
  const [mailLead, setMailLead] = useState('')
  const [mailCtaLabel, setMailCtaLabel] = useState('Открыть кабинет')
  const [mailCtaPath, setMailCtaPath] = useState('/app')
  const [mailAudience, setMailAudience] = useState<'me' | 'trial' | 'premium' | 'all'>('me')
  const [mailBusy, setMailBusy] = useState(false)
  const [remnawave, setRemnawave] = useState<AdminRemnawave | null>(null)
  const [syncUserId, setSyncUserId] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [probes, setProbes] = useState<ProbeTarget[]>([])
  const [openAlerts, setOpenAlerts] = useState(0)
  const [alertFilter, setAlertFilter] = useState<'OPEN' | 'ALL'>('OPEN')
  const [alertSeverity, setAlertSeverity] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL')
  const [probeBusy, setProbeBusy] = useState(false)
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null)
  const [userDetailBusy, setUserDetailBusy] = useState(false)
  const [adminNoteDraft, setAdminNoteDraft] = useState('')
  const [retention, setRetention] = useState<RetentionStats | null>(null)

  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotalPages, setOrdersTotalPages] = useState(1)
  const [orderFrom, setOrderFrom] = useState('')
  const [orderTo, setOrderTo] = useState('')
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])

  const [globalSearch, setGlobalSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchResult, setSearchResult] = useState<AdminSearchResult | null>(null)

  const [referrals, setReferrals] = useState<ReferralsData | null>(null)
  const [planRows, setPlanRows] = useState<AdminPlanRow[]>([])
  const [couponRows, setCouponRows] = useState<AdminCouponRow[]>([])
  const [sitePages, setSitePages] = useState<SitePage[]>([])
  const [pageSlug, setPageSlug] = useState<'oferta' | 'policy'>('oferta')
  const [pageTitle, setPageTitle] = useState('')
  const [pageBody, setPageBody] = useState('')
  const [pageBusy, setPageBusy] = useState(false)

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    setError('')
    try {
      const [statsRes, retentionRes, alertsBadge] = await Promise.all([
        getAdminStats(),
        getAdminRetention(),
        getAdminAlerts('OPEN'),
      ])
      setStats(statsRes)
      setRetention(retentionRes)
      setOpenAlerts(alertsBadge.openCount)
      setWaitlistPending(retentionRes.waitlist.pending ?? statsRes.waitlistPending ?? 0)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить обзор')
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [])

  const refreshOverviewLight = useCallback(async () => {
    try {
      const [statsRes, alertsBadge] = await Promise.all([getAdminStats(), getAdminAlerts('OPEN')])
      setStats(statsRes)
      setOpenAlerts(alertsBadge.openCount)
      setUpdatedAt(new Date())
    } catch {
      /* фоновое обновление — без тоста */
    }
  }, [])

  const loadTab = useCallback(async (target: Tab, silent = false) => {
    if (!silent) setRefreshing(true)
    setError('')
    try {
      switch (target) {
        case 'overview': {
          const [serversRes, remnawaveRes] = await Promise.all([getAdminServers(), getAdminRemnawave()])
          setServers(serversRes.servers)
          setRemnawave(remnawaveRes)
          break
        }
        case 'alerts': {
          const alertsRes = await getAdminAlerts(alertFilter)
          setAlerts(alertsRes.alerts)
          setProbes(alertsRes.probes)
          setOpenAlerts(alertsRes.openCount)
          break
        }
        case 'users': {
          const usersRes = await getAdminUsers({ q: userQuery || undefined, page: usersPage })
          setUsers(usersRes.users)
          setUsersTotalPages(usersRes.totalPages)
          break
        }
        case 'subscriptions': {
          const subsRes = await getAdminSubscriptions()
          setSubscriptions(subsRes.subscriptions)
          break
        }
        case 'orders': {
          const ordersRes = await getAdminOrders({
            status: orderStatus,
            q: orderQuery || undefined,
            from: orderFrom || undefined,
            to: orderTo || undefined,
            page: ordersPage,
          })
          setOrders(ordersRes.orders)
          setOrdersTotalPages(ordersRes.totalPages)
          break
        }
        case 'servers': {
          const [serversRes, remnawaveRes] = await Promise.all([getAdminServers(), getAdminRemnawave()])
          setServers(serversRes.servers)
          setRemnawave(remnawaveRes)
          break
        }
        case 'sessions': {
          const sessionsRes = await getAdminSessions({ page: sessionsPage })
          setSessions(sessionsRes.sessions)
          setSessionsTotalPages(sessionsRes.totalPages)
          break
        }
        case 'waitlist': {
          const waitlistRes = await getAdminWaitlist(waitlistPendingOnly)
          setWaitlist(waitlistRes.entries)
          setWaitlistCount(waitlistRes.count)
          setWaitlistPending(waitlistRes.pendingCount ?? 0)
          break
        }
        case 'remnawave': {
          setRemnawave(await getAdminRemnawave())
          break
        }
        case 'referrals':
          setReferrals(await getAdminReferrals())
          break
        case 'audit': {
          const auditRes = await getAdminAudit(auditPage)
          setAuditItems(auditRes.items)
          setAuditTotalPages(auditRes.totalPages)
          break
        }
        case 'plans': {
          const [plansRes, couponsRes] = await Promise.all([getAdminPlans(), getAdminCoupons()])
          setPlanRows(plansRes.plans)
          setCouponRows(couponsRes.coupons)
          break
        }
        case 'pages': {
          const pagesRes = await getAdminSitePages()
          setSitePages(pagesRes.pages)
          const first = pagesRes.pages[0]
          if (first) {
            setPageSlug((first.slug as 'oferta' | 'policy') || 'oferta')
            setPageTitle(first.title)
            setPageBody(first.body)
          }
          break
        }
        default:
          break
      }
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить вкладку')
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [
    alertFilter,
    userQuery,
    usersPage,
    orderStatus,
    orderQuery,
    orderFrom,
    orderTo,
    ordersPage,
    sessionsPage,
    waitlistPendingOnly,
    auditPage,
  ])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      await loadOverview(true)
      await loadTab(tab, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить')
    } finally {
      setRefreshing(false)
    }
  }, [loadOverview, loadTab, tab])

  const openUserDetail = async (userId: string) => {
    setUserDetailBusy(true)
    setError('')
    try {
      const res = await getAdminUser(userId)
      setUserDetail(res.user)
      setAdminNoteDraft(res.user.adminNote ?? '')
      setSyncUserId(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть карточку')
    } finally {
      setUserDetailBusy(false)
    }
  }

  const money = formatAdminMoney

  useEffect(() => {
    let active = true

    getAccount()
      .then(async (data) => {
        if (!active) return
        if (data.user.role !== 'ADMIN' && data.user.role !== 'SUPPORT') {
          navigate('/app', { replace: true })
          return
        }
        setUser(data.user)
        await loadOverview(true)
      })
      .catch(() => {
        if (active) navigate('/auth?mode=login', { replace: true })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [navigate, loadOverview])

  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPPORT')) return
    void loadTab(tab, true)
  }, [user, tab, loadTab])

  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPPORT')) return
    const id = window.setInterval(() => {
      void refreshOverviewLight()
    }, 30000)
    return () => window.clearInterval(id)
  }, [user, refreshOverviewLight])

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/auth?mode=login', { replace: true })
    }
  }

  const runAction = async (key: string, fn: () => Promise<string>) => {
    setActionBusy(key)
    setError('')
    setNotice('')
    try {
      const message = await fn()
      setNotice(message)
      await loadOverview(true)
      await loadTab(tab, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка действия')
    } finally {
      setActionBusy(null)
    }
  }

  const runGlobalSearch = async () => {
    const q = globalSearch.trim()
    if (q.length < 2) return
    setSearchBusy(true)
    setError('')
    try {
      const res = await getAdminSearch(q)
      setSearchResult(res)
      setSearchOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Поиск не удался')
    } finally {
      setSearchBusy(false)
    }
  }

  const filteredAlerts = useMemo(
    () => (alertSeverity === 'ALL' ? alerts : alerts.filter((item) => item.severity === alertSeverity)),
    [alerts, alertSeverity],
  )

  if (loading) {
    return (
      <div className="admin-shell flex items-center justify-center">
        <p className="text-teal-200 font-semibold">Загрузка админ-панели…</p>
      </div>
    )
  }

  if (!user) return null

  const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: 'overview', label: 'Обзор', icon: ShieldCheck },
    { id: 'alerts', label: openAlerts > 0 ? `Алерты (${openAlerts})` : 'Алерты', icon: Bell },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'subscriptions', label: 'Подписки', icon: CreditCard },
    { id: 'orders', label: 'Платежи', icon: Receipt },
    { id: 'servers', label: 'Серверы', icon: Server },
    { id: 'sessions', label: 'Сессии', icon: MonitorSmartphone },
    { id: 'waitlist', label: 'Лист ожидания', icon: Mail },
    { id: 'remnawave', label: 'Remnawave', icon: Network },
    { id: 'referrals', label: 'Рефералы', icon: Gift },
    { id: 'audit', label: 'Аудит', icon: ScrollText },
    { id: 'plans', label: 'Тарифы', icon: Layers },
    { id: 'pages', label: 'Оферта / Политика', icon: FileText },
  ]

  return (
    <div className="admin-shell">
      <SeoHead {...SEO_PAGES.admin} />
      {notice && <AdminToast message={notice} type="success" onClose={() => setNotice('')} />}
      {error && <AdminToast message={error} type="error" onClose={() => setError('')} />}
      <header
        className="h-16 border-b border-[var(--admin-border-soft)] px-5 md:px-8 flex items-center justify-between sticky top-0 backdrop-blur z-20"
        style={{ background: 'color-mix(in srgb, var(--admin-bg) 95%, transparent)' }}
      >
        <div className="flex items-center gap-4">
          <Link to="/app" className="admin-muted hover:text-[var(--admin-text)] transition" title="В кабинет">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none">jetsale.online Admin</p>
              <p className="admin-mono mt-1 break-all">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="relative hidden md:block">
            <div className="flex items-center gap-1">
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runGlobalSearch()
                }}
                placeholder="Глобальный поиск…"
                className="admin-input h-9 w-48 lg:w-56 text-xs"
              />
              <button
                type="button"
                disabled={searchBusy || globalSearch.trim().length < 2}
                onClick={() => void runGlobalSearch()}
                className="admin-btn h-9 disabled:opacity-50"
                title="Поиск"
              >
                <Search size={14} />
              </button>
            </div>
            {searchOpen && searchResult && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-72 overflow-auto admin-card p-2 z-30 shadow-xl">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-xs font-bold">Результаты</p>
                  <button type="button" className="text-xs admin-muted hover:text-[var(--admin-text)]" onClick={() => setSearchOpen(false)}>Закрыть</button>
                </div>
                {searchResult.users.length === 0 && searchResult.orders.length === 0 && searchResult.vpnAccounts.length === 0 ? (
                  <p className="text-xs admin-muted px-2 py-3">Ничего не найдено</p>
                ) : (
                  <div className="space-y-1">
                    {searchResult.users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 text-xs"
                        onClick={() => {
                          setSearchOpen(false)
                          void openUserDetail(u.id)
                        }}
                      >
                        <span className="font-semibold text-teal-200">{u.email}</span>
                        {u.supportCode ? <span className="admin-muted"> · {u.supportCode}</span> : null}
                      </button>
                    ))}
                    {searchResult.orders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 text-xs"
                        onClick={() => {
                          setSearchOpen(false)
                          void openUserDetail(o.user.id)
                        }}
                      >
                        Заказ {o.id.slice(0, 8)} · {o.user.email} · {o.status}
                      </button>
                    ))}
                    {searchResult.vpnAccounts.map((v) => (
                      <button
                        key={v.userId}
                        type="button"
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 text-xs"
                        onClick={() => {
                          setSearchOpen(false)
                          void openUserDetail(v.userId)
                        }}
                      >
                        VPN {v.user.email}
                        {v.remnawaveUsername ? ` · ${v.remnawaveUsername}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <span className="hidden sm:inline text-xs admin-muted">
            {updatedAt
              ? `Обновлено ${updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : '—'}
          </span>
          <button
            onClick={() => void refreshAll()}
            disabled={refreshing}
            className="admin-btn disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 transition"
          >
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
        <aside className="admin-card p-3 h-fit lg:sticky lg:top-24">
          <nav className="space-y-1">
            {tabs.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                    active ? 'bg-teal-500/15 text-teal-200' : 'admin-muted hover:bg-white/5 hover:text-[var(--admin-text)]'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {tab === 'overview' && (
            <OverviewTab
              stats={stats}
              retention={retention}
              remnawave={remnawave}
              openAlerts={openAlerts}
              waitlistPending={waitlistPending}
              servers={servers}
            />
          )}

          {tab === 'alerts' && (
            <div className="space-y-4">
              <div className="admin-card p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <p className="font-bold text-lg flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-300" />
                    Мониторинг блокировок
                  </p>
                  <p className="text-xs admin-muted mt-2 max-w-2xl">
                    Проверка доступности proxy/panel/sub и совпадения IP со списками antifilter (как cheburcheck).
                    При падении или блокировке создаётся алерт здесь.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = alertFilter === 'OPEN' ? 'ALL' : 'OPEN'
                      setAlertFilter(next)
                    }}
                    className="admin-btn"
                  >
                    {alertFilter === 'OPEN' ? 'Показать все' : 'Только открытые'}
                  </button>
                  <button
                    type="button"
                    disabled={probeBusy}
                    onClick={async () => {
                      setProbeBusy(true)
                      setError('')
                      try {
                        const result = await runAdminProbe()
                        setNotice(result.message)
                        await loadTab('alerts', true)
                        await loadOverview(true)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Не удалось выполнить проверку')
                      } finally {
                        setProbeBusy(false)
                      }
                    }}
                    className="admin-btn-accent disabled:opacity-60"
                  >
                    {probeBusy ? 'Проверяем…' : 'Проверить сейчас'}
                  </button>
                </div>
              </div>

              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Цели проверки ({probes.length})</div>
                {probes.length === 0 ? (
                  <div className="px-5 py-8 text-sm admin-muted">Ещё не запускали probe — нажмите «Проверить сейчас»</div>
                ) : (
                  <>
                  <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                    <span>Цель</span>
                    <span className="lg:text-right">Статус</span>
                  </div>
                  {probes.map((item) => (
                    <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{item.label}</p>
                        <p className="text-xs admin-muted mt-1">
                          {item.host}:{item.port}
                          {item.lastIp ? ` · ${item.lastIp}` : ''}
                          {item.lastLatencyMs != null ? ` · ${item.lastLatencyMs} мс` : ''}
                          {item.lastCheckedAt ? ` · ${formatDate(item.lastCheckedAt)}` : ''}
                        </p>
                        {item.lastError && <p className="text-[11px] text-rose-300 mt-1">{item.lastError}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          item.lastStatus === 'ok'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : item.lastStatus === 'blocked'
                              ? 'bg-amber-500/15 text-amber-200'
                              : 'bg-rose-500/15 text-rose-300'
                        }`}>
                          {item.lastStatus || '—'}
                        </span>
                        {item.lastBlocked && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300">
                            RKN/antifilter
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>

              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold">
                    Уведомления ({filteredAlerts.length}/{alerts.length}) · открыто {openAlerts}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAlertSeverity(level)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                          alertSeverity === level
                            ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                            : 'border-[var(--admin-border)] text-[var(--admin-text-soft)] hover:bg-white/5'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredAlerts.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Алертов нет</div>
                ) : (
                  <>
                  <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                    <span>Алерт</span>
                    <span className="lg:text-right">Статус</span>
                  </div>
                  {filteredAlerts.map((item) => (
                    <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col gap-3">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs admin-muted mt-1">{item.message}</p>
                          <p className="text-[11px] admin-muted mt-1">
                            {item.type} · {item.target || '—'} · {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-500/15 text-rose-300'
                              : item.severity === 'WARNING'
                                ? 'bg-amber-500/15 text-amber-200'
                                : 'bg-white/5 text-[var(--admin-text-soft)]'
                          }`}>
                            {item.severity}
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-200">
                            {item.status}
                          </span>
                        </div>
                      </div>
                      {item.status !== 'RESOLVED' && (
                        <div className="flex flex-wrap gap-2">
                          {item.status === 'OPEN' && (
                            <button
                              type="button"
                              disabled={actionBusy === `ack-${item.id}`}
                              onClick={() => runAction(`ack-${item.id}`, async () => {
                                const res = await ackAdminAlert(item.id)
                                return res.message
                              })}
                              className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                            >
                              Принять
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={actionBusy === `res-${item.id}`}
                            onClick={() => runAction(`res-${item.id}`, async () => {
                              const res = await resolveAdminAlert(item.id)
                              return res.message
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
                          >
                            Закрыть
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="admin-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="font-bold">Пользователи ({users.length})</p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Поиск email / UUID"
                    className="admin-input flex-1 sm:w-auto sm:min-w-[14rem]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUsersPage(1)
                      void loadTab('users')
                    }}
                    className="admin-btn"
                  >
                    Найти
                  </button>
                </div>
              </div>
              <div>
                {users.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Нет данных</div>
                ) : (
                  <>
                  <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                    <span>Пользователь</span>
                    <span className="lg:text-right">Роль / статус</span>
                  </div>
                  {users.map((item) => {
                    const sub = item.subscriptions?.[0]
                    return (
                      <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                          <div>
                            <button
                              type="button"
                              onClick={() => openUserDetail(item.id)}
                              className="admin-mono text-sm font-semibold text-teal-200 hover:text-teal-100 text-left"
                            >
                              {item.email}
                            </button>
                            <p className="text-xs admin-muted mt-1">
                              {formatDate(item.createdAt)} · <span className="admin-mono">{item.id.slice(0, 8)}</span>
                              {sub ? ` · ${sub.isTrial ? 'trial' : 'paid'} ${sub.status}` : ' · нет sub'}
                              {sub?.expiresAt ? ` до ${formatDate(sub.expiresAt)}` : ''}
                            </p>
                            <p className="text-[11px] admin-muted mt-1">
                              VPN: {item.vpnAccount?.isProvisioned ? 'provisioned' : 'нет'}
                              {item.vpnAccount?.remnawaveUsername ? ` · ${item.vpnAccount.remnawaveUsername}` : ''}
                              {item.vpnAccount?.proxyProvisioned ? ' · proxy OK' : ''}
                            </p>
                            {item.vpnAccount?.subscriptionUrl && (
                              <p className="admin-mono text-teal-200/90 mt-1 break-all">
                                {item.vpnAccount.subscriptionUrl}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${item.role === 'ADMIN' ? 'bg-teal-500/20 text-teal-200' : 'bg-white/5 text-[var(--admin-text-soft)]'}`}>
                              {item.role}
                            </span>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${item.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actionBusy === `block-${item.id}`}
                            onClick={() => runAction(`block-${item.id}`, async () => {
                              const next = item.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
                              const res = await updateAdminUserStatus(item.id, next)
                              return res.message
                            })}
                            className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                          >
                            {item.status === 'BLOCKED' ? 'Разблок' : 'Блок'}
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === `ext7-${item.id}`}
                            onClick={() => runAction(`ext7-${item.id}`, async () => {
                              const res = await extendAdminUser(item.id, 7)
                              return res.message
                            })}
                            className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                          >
                            +7 дней
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === `ext30-${item.id}`}
                            onClick={() => runAction(`ext30-${item.id}`, async () => {
                              const res = await extendAdminUser(item.id, 30)
                              return res.message
                            })}
                            className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                          >
                            +30 дней
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === `cancel-${item.id}`}
                            onClick={() => runAction(`cancel-${item.id}`, async () => {
                              const res = await cancelAdminUserSubscription(item.id)
                              return res.message
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Отменить sub
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === `sync-${item.id}`}
                            onClick={() => runAction(`sync-${item.id}`, async () => {
                              const res = await syncAdminRemnawaveUser(item.id)
                              return res.message
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-200 hover:bg-teal-500/10 disabled:opacity-60"
                          >
                            Синх. Remnawave
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === `imp-${item.id}`}
                            onClick={() => runAction(`imp-${item.id}`, async () => {
                              const res = await impersonateAdminUser(item.id)
                              await navigator.clipboard.writeText(res.url)
                              window.open(res.url, '_blank', 'noopener,noreferrer')
                              return `${res.message}. Ссылка скопирована`
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-100 hover:bg-amber-500/10 disabled:opacity-60"
                          >
                            Просмотр кабинета
                          </button>
                          {item.vpnAccount?.subscriptionUrl && (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(item.vpnAccount!.subscriptionUrl!)
                                    setNotice('Subscription URL скопирован')
                                  } catch {
                                    setError('Не удалось скопировать URL')
                                  }
                                }}
                                className="admin-btn text-[11px] py-1.5"
                              >
                                Копировать sub URL
                              </button>
                              <a
                                href={item.vpnAccount.subscriptionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="admin-btn text-[11px] py-1.5"
                              >
                                Открыть sub
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  </>
                )}
              </div>
              <PaginationBar
                page={usersPage}
                totalPages={usersTotalPages}
                onPage={(p) => setUsersPage(p)}
              />
            </div>
          )}

          {tab === 'subscriptions' && (
            <div className="admin-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Подписки ({subscriptions.length})</div>
              <div>
                {subscriptions.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Нет подписок</div>
                ) : (
                  <>
                  <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                    <span>Подписка</span>
                    <span className="lg:text-right">Статус</span>
                  </div>
                  {subscriptions.map((item) => (
                    <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                      <div>
                        <p className="admin-mono text-sm font-semibold text-[var(--admin-text)]">{item.user.email}</p>
                        <p className="text-xs admin-muted mt-1">
                          {item.plan.name} · {item.isTrial ? 'trial' : 'paid'} · до {formatDate(item.expiresAt)}
                          {item.plan.deviceLimit ? ` · ${item.plan.deviceLimit} устр.` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-fit text-[11px] font-bold px-2.5 py-1 rounded-full ${item.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-[var(--admin-text-soft)]'}`}>
                          {item.status}
                        </span>
                        {item.status === 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={actionBusy === `subcancel-${item.id}`}
                            onClick={() => runAction(`subcancel-${item.id}`, async () => {
                              const res = await cancelAdminUserSubscription(item.user.id)
                              return res.message
                            })}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Отменить
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              {stats?.payments && (
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="admin-card p-4"><p className="text-xs admin-muted">Выручка 30д</p><p className="text-xl font-extrabold mt-2">{money(stats.payments.revenue30d)}</p></div>
                  <div className="admin-card p-4"><p className="text-xs admin-muted">Выручка 7д</p><p className="text-xl font-extrabold mt-2">{money(stats.payments.revenue7d)}</p></div>
                  <div className="admin-card p-4"><p className="text-xs admin-muted">Сегодня</p><p className="text-xl font-extrabold mt-2">{money(stats.payments.revenueToday)}</p></div>
                  <div className="admin-card p-4"><p className="text-xs admin-muted">Trial → paid</p><p className="text-xl font-extrabold mt-2">{stats.payments.trialToPaidRate}%</p></div>
                </div>
              )}
              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                  <p className="font-bold">Платежи / заказы ({orders.length})</p>
                  <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                    <select
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value as typeof orderStatus)}
                      className="admin-input sm:w-40"
                    >
                      <option value="ALL">Все статусы</option>
                      <option value="PAID">PAID</option>
                      <option value="PENDING">PENDING</option>
                      <option value="CANCELLED">CANCELLED</option>
                      <option value="REFUNDED">REFUNDED</option>
                    </select>
                    <input
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Email"
                      className="admin-input sm:w-48"
                    />
                    <input
                      type="date"
                      value={orderFrom}
                      onChange={(e) => setOrderFrom(e.target.value)}
                      className="admin-input sm:w-36"
                      title="С даты"
                    />
                    <input
                      type="date"
                      value={orderTo}
                      onChange={(e) => setOrderTo(e.target.value)}
                      className="admin-input sm:w-36"
                      title="По дату"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOrdersPage(1)
                        void loadTab('orders')
                      }}
                      className="admin-btn"
                    >
                      Фильтр
                    </button>
                    <button
                      type="button"
                      disabled={orders.length === 0}
                      onClick={() => exportOrdersCsv(orders)}
                      className="admin-btn disabled:opacity-50"
                    >
                      <Download size={14} />
                      CSV
                    </button>
                  </div>
                </div>
                <div>
                  {orders.length === 0 ? (
                    <div className="px-5 py-10 text-sm admin-muted">Заказов пока нет</div>
                  ) : (
                    <>
                    <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                      <span>Заказ</span>
                      <span className="lg:text-right">Сумма / статус</span>
                    </div>
                    {orders.map((item) => (
                      <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => openUserDetail(item.user.id)}
                            className="admin-mono text-sm font-semibold text-teal-200 hover:text-teal-100"
                          >
                            {item.user.email}
                          </button>
                          <p className="text-xs admin-muted mt-1">
                            {item.plan.name} · {formatDate(item.createdAt)} · <span className="admin-mono">{item.id.slice(0, 8)}</span>
                            {item.payment?.provider ? ` · ${item.payment.provider}` : ''}
                            {item.payment?.providerPaymentId ? ` · ${item.payment.providerPaymentId.slice(0, 10)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{item.amount} {item.currency === 'RUB' ? '₽' : item.currency}</span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            item.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-[var(--admin-text-soft)]'
                          }`}>
                            {item.status}
                          </span>
                          {item.payment && (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-200">
                              pay {item.payment.status}
                            </span>
                          )}
                          {item.status === 'PENDING' && (
                            <button
                              type="button"
                              disabled={actionBusy === `paid-${item.id}`}
                              onClick={() => runAction(`paid-${item.id}`, async () => {
                                const res = await markAdminOrderPaid(item.id)
                                return res.message
                              })}
                              className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                            >
                              Оплачен
                            </button>
                          )}
                          {item.status === 'PAID' && (
                            <button
                              type="button"
                              disabled={actionBusy === `refund-${item.id}`}
                              onClick={() => runAction(`refund-${item.id}`, async () => {
                                const res = await refundAdminOrder(item.id)
                                return res.message
                              })}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-500/10 disabled:opacity-60"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    </>
                  )}
                </div>
                <PaginationBar
                  page={ordersPage}
                  totalPages={ordersTotalPages}
                  onPage={(p) => setOrdersPage(p)}
                />
              </div>
            </div>
          )}

          {userDetail && (
            <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
              <button type="button" className="absolute inset-0 bg-black/60" aria-label="Закрыть" onClick={() => setUserDetail(null)} />
              <div className="relative admin-card w-full max-w-3xl max-h-[85vh] overflow-auto p-5 z-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs admin-muted">Карточка 360°</p>
                    <h3 className="text-xl font-extrabold mt-1">{userDetail.email}</h3>
                    <p className="text-xs admin-muted mt-1 admin-mono">{userDetail.id}</p>
                  </div>
                  <button type="button" className="admin-btn" onClick={() => setUserDetail(null)}>Закрыть</button>
                </div>
                {userDetailBusy ? (
                  <p className="admin-muted mt-6 text-sm">Загрузка…</p>
                ) : (
                  <div className="mt-5 space-y-5 text-sm">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[var(--admin-border)] p-3"><p className="admin-muted text-xs">Роль</p><p className="font-bold mt-1">{userDetail.role}</p></div>
                      <div className="rounded-xl border border-[var(--admin-border)] p-3"><p className="admin-muted text-xs">Статус</p><p className="font-bold mt-1">{userDetail.status}</p></div>
                      <div className="rounded-xl border border-[var(--admin-border)] p-3"><p className="admin-muted text-xs">Создан</p><p className="font-bold mt-1">{formatDate(userDetail.createdAt)}</p></div>
                      <div className="rounded-xl border border-[var(--admin-border)] p-3"><p className="admin-muted text-xs">Support code</p><p className="font-bold mt-1 admin-mono">{userDetail.supportCode || '—'}</p></div>
                      <div className="rounded-xl border border-[var(--admin-border)] p-3 sm:col-span-2"><p className="admin-muted text-xs">Signup IP hash</p><p className="font-bold mt-1 admin-mono text-[11px] break-all">{userDetail.signupIpHash || '—'}</p></div>
                    </div>
                    <div>
                      <label className="text-xs admin-muted font-semibold">Заметка админа</label>
                      <textarea
                        value={adminNoteDraft}
                        onChange={(e) => setAdminNoteDraft(e.target.value)}
                        rows={3}
                        className="admin-input mt-2 w-full text-xs min-h-[4.5rem]"
                        placeholder="Внутренняя заметка…"
                      />
                      <button
                        type="button"
                        disabled={actionBusy === `note-${userDetail.id}`}
                        className="admin-btn text-[11px] py-1.5 mt-2 disabled:opacity-60"
                        onClick={() => runAction(`note-${userDetail.id}`, async () => {
                          const res = await updateAdminUserNote(userDetail.id, adminNoteDraft.trim() || null)
                          await openUserDetail(userDetail.id)
                          return res.message
                        })}
                      >
                        Сохранить заметку
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionBusy === `detail-ext-${userDetail.id}`}
                        className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                        onClick={() => runAction(`detail-ext-${userDetail.id}`, async () => {
                          const res = await extendAdminUser(userDetail.id, 7)
                          await openUserDetail(userDetail.id)
                          return res.message
                        })}
                      >
                        +7 дней
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === `detail-sync-${userDetail.id}`}
                        className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                        onClick={() => runAction(`detail-sync-${userDetail.id}`, async () => {
                          const res = await syncAdminRemnawaveUser(userDetail.id)
                          await openUserDetail(userDetail.id)
                          return res.message
                        })}
                      >
                        Sync Remnawave
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === `detail-status-${userDetail.id}`}
                        className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                        onClick={() => runAction(`detail-status-${userDetail.id}`, async () => {
                          const next = userDetail.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
                          const res = await updateAdminUserStatus(userDetail.id, next)
                          await openUserDetail(userDetail.id)
                          return res.message
                        })}
                      >
                        {userDetail.status === 'BLOCKED' ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === `detail-cancel-${userDetail.id}`}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                        onClick={() => runAction(`detail-cancel-${userDetail.id}`, async () => {
                          const res = await cancelAdminUserSubscription(userDetail.id)
                          await openUserDetail(userDetail.id)
                          return res.message
                        })}
                      >
                        Отменить подписку
                      </button>
                    </div>
                    <div>
                      <p className="font-bold mb-2">VPN / Remnawave</p>
                      <p className="admin-muted text-xs">
                        provisioned: {userDetail.vpnAccount?.isProvisioned ? 'да' : 'нет'}
                        {userDetail.vpnAccount?.remnawaveUsername ? ` · ${userDetail.vpnAccount.remnawaveUsername}` : ''}
                      </p>
                      {userDetail.vpnAccount?.subscriptionUrl && (
                        <p className="admin-mono text-teal-200 mt-2 break-all">{userDetail.vpnAccount.subscriptionUrl}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-bold mb-2">Подписки ({userDetail.subscriptions.length})</p>
                      {userDetail.subscriptions.length === 0 ? <p className="admin-muted text-xs">Нет</p> : userDetail.subscriptions.map((sub) => (
                        <p key={sub.id} className="text-xs admin-muted mb-1">
                          {sub.plan.name} · {sub.isTrial ? 'trial' : 'paid'} · {sub.status} · до {formatDate(sub.expiresAt)}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="font-bold mb-2">Платежи ({userDetail.orders.length})</p>
                      {userDetail.orders.length === 0 ? <p className="admin-muted text-xs">Нет</p> : userDetail.orders.map((order) => (
                        <p key={order.id} className="text-xs admin-muted mb-1">
                          {order.amount} {order.currency} · {order.status} · {order.plan.name} · {formatDate(order.createdAt)}
                          {order.payment?.provider ? ` · ${order.payment.provider}` : ''}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="font-bold mb-2">Сессии расширения ({userDetail.extensionSessions.length})</p>
                      {userDetail.extensionSessions.length === 0 ? <p className="admin-muted text-xs">Нет активных</p> : userDetail.extensionSessions.map((session) => (
                        <p key={session.id} className="text-xs admin-muted mb-1">
                          {session.deviceName} · last {formatDate(session.lastUsedAt)} · exp {formatDate(session.expiresAt)}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="font-bold mb-2">Реф. награды выданные ({userDetail.referralRewardsGiven?.length ?? 0})</p>
                      {!userDetail.referralRewardsGiven?.length ? (
                        <p className="admin-muted text-xs">Нет</p>
                      ) : (
                        userDetail.referralRewardsGiven.map((reward) => (
                          <p key={reward.id} className="text-xs admin-muted mb-1">
                            {reward.referred.email} · {reward.status} · +{reward.daysGranted}д · {formatDate(reward.createdAt)}
                            {reward.referred.signupIpHash ? ` · ip ${reward.referred.signupIpHash.slice(0, 12)}…` : ''}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'servers' && (
            <div className="space-y-4">
              <div className="admin-card p-4 text-xs admin-muted">
                DB-каталог для сайта. Runtime для расширения — ноды Remnawave ({remnawave?.nodesCount ?? 0}).
              </div>
              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Серверы DB ({servers.length})</div>
                <div>
                  {servers.length === 0 ? (
                    <div className="px-5 py-10 text-sm admin-muted">Серверы не найдены</div>
                  ) : (
                    <>
                    <div className="admin-grid-head grid-cols-1 sm:grid-cols-[1fr_auto]">
                      <span>Сервер</span>
                      <span className="sm:text-right">Статус</span>
                    </div>
                    {servers.map((item) => (
                      <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{item.name}</p>
                          <p className="text-xs admin-muted mt-1">
                            {item.country}{item.city ? `, ${item.city}` : ''} · {item.hostname}:{item.port}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-fit text-[11px] font-bold px-2.5 py-1 rounded-full ${item.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                            {item.isActive ? 'ACTIVE' : 'OFF'}
                          </span>
                          <button
                            type="button"
                            disabled={actionBusy === `srv-${item.id}`}
                            onClick={() => runAction(`srv-${item.id}`, async () => {
                              const res = await updateAdminServer(item.id, !item.isActive)
                              return res.message
                            })}
                            className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
                          >
                            {item.isActive ? 'Выкл' : 'Вкл'}
                          </button>
                        </div>
                      </div>
                    ))}
                    </>
                  )}
                </div>
              </div>
              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">
                  Ноды Remnawave ({remnawave?.nodes.length ?? 0})
                </div>
                <div>
                  {!remnawave || remnawave.nodes.length === 0 ? (
                    <div className="px-5 py-10 text-sm admin-muted">Ноды не получены</div>
                  ) : (
                    <>
                    <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                      <span>Нода</span>
                      <span className="lg:text-right">Тип</span>
                    </div>
                    {remnawave.nodes.map((node) => (
                      <div key={node.uuid} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{node.name}</p>
                          <p className="text-xs admin-muted mt-1">{node.countryCode} · <span className="admin-mono">{node.uuid.slice(0, 8)}</span></p>
                        </div>
                        <span className={`w-fit text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          node.isSupportedProxy ? 'bg-teal-500/15 text-teal-200' : 'bg-white/5 text-[var(--admin-text-soft)]'
                        }`}>
                          {node.isSupportedProxy ? 'jetsale.online PROXY' : 'SQUAD'}
                        </span>
                      </div>
                    ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'sessions' && (
            <div className="admin-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Активные сессии ({sessions.length})</div>
              <div>
                {sessions.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Нет активных сессий расширений</div>
                ) : (
                  <>
                  <div className="admin-grid-head grid-cols-1 sm:grid-cols-[1fr_auto]">
                    <span>Сессия</span>
                    <span className="sm:text-right">Срок / действия</span>
                  </div>
                  {sessions.map((item) => (
                    <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="admin-mono text-sm font-semibold text-[var(--admin-text)]">{item.user.email}</p>
                        <p className="text-xs admin-muted mt-1">
                          {item.deviceName}
                          {item.deviceId ? ` · ${item.deviceId}` : ''} · last {formatDate(item.lastUsedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-fit text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-200">
                          до {formatDate(item.expiresAt)}
                        </span>
                        <button
                          type="button"
                          disabled={actionBusy === `sess-${item.id}`}
                          onClick={() => runAction(`sess-${item.id}`, async () => {
                            const res = await revokeAdminSession(item.id)
                            return res.message
                          })}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                        >
                          Отключить
                        </button>
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
              <PaginationBar
                page={sessionsPage}
                totalPages={sessionsTotalPages}
                onPage={(p) => setSessionsPage(p)}
              />
            </div>
          )}

          {tab === 'waitlist' && (
            <div className="space-y-4">
            <div className="admin-card p-5 space-y-3">
              <div>
                <p className="font-bold">Рассылка (брендированные письма)</p>
                <p className="text-xs admin-muted mt-1">
                  Сначала отправьте себе (audience = me), затем trial / premium / all. До 500 получателей за раз.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-xs admin-muted">
                  Тема
                  <input className="admin-input mt-1 w-full" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
                </label>
                <label className="block text-xs admin-muted">
                  Заголовок
                  <input className="admin-input mt-1 w-full" value={mailTitle} onChange={(e) => setMailTitle(e.target.value)} />
                </label>
              </div>
              <label className="block text-xs admin-muted">
                Текст
                <textarea
                  className="admin-input mt-1 w-full min-h-[120px]"
                  value={mailLead}
                  onChange={(e) => setMailLead(e.target.value)}
                  placeholder="Короткое сообщение пользователям…"
                />
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block text-xs admin-muted">
                  Кнопка
                  <input className="admin-input mt-1 w-full" value={mailCtaLabel} onChange={(e) => setMailCtaLabel(e.target.value)} />
                </label>
                <label className="block text-xs admin-muted">
                  Ссылка (path)
                  <input className="admin-input mt-1 w-full" value={mailCtaPath} onChange={(e) => setMailCtaPath(e.target.value)} />
                </label>
                <label className="block text-xs admin-muted">
                  Кому
                  <select
                    className="admin-input mt-1 w-full"
                    value={mailAudience}
                    onChange={(e) => setMailAudience(e.target.value as typeof mailAudience)}
                  >
                    <option value="me">Только себе (тест)</option>
                    <option value="trial">Trial</option>
                    <option value="premium">Premium</option>
                    <option value="all">Все активные</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={mailBusy || mailLead.trim().length < 10}
                className="admin-btn disabled:opacity-60"
                onClick={() => runAction('mail-broadcast', async () => {
                  setMailBusy(true)
                  try {
                    const res = await sendAdminMailBroadcast({
                      subject: mailSubject.trim(),
                      title: mailTitle.trim(),
                      lead: mailLead.trim(),
                      ctaLabel: mailCtaLabel.trim() || undefined,
                      ctaPath: mailCtaPath.trim() || undefined,
                      audience: mailAudience,
                    })
                    return res.message
                  } finally {
                    setMailBusy(false)
                  }
                })}
              >
                {mailBusy ? 'Отправка…' : 'Отправить рассылку'}
              </button>
            </div>
            <div className="admin-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">Лист ожидания Premium ({waitlistCount}) · ожидают {waitlistPending}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWaitlistPendingOnly((prev) => !prev)
                    }}
                    className="admin-btn"
                  >
                    {waitlistPendingOnly ? 'Показать все' : 'Только ожидающие'}
                  </button>
                  <button
                    type="button"
                    disabled={notifyBusy}
                    onClick={async () => {
                      setNotifyBusy(true)
                      setError('')
                      try {
                        const result = await notifyAdminWaitlist()
                        setNotice(result.message)
                        await loadTab('waitlist', true)
                        await loadOverview(true)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Не удалось отправить письма')
                      } finally {
                        setNotifyBusy(false)
                      }
                    }}
                    className="admin-btn disabled:opacity-60"
                  >
                    {notifyBusy ? 'Отправка…' : 'Уведомить ожидающих'}
                  </button>
                </div>
              </div>
              <div>
                {waitlist.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Пока никто не записался</div>
                ) : (
                  <>
                  <div className="admin-grid-head grid-cols-1 sm:grid-cols-[1fr_auto]">
                    <span>Email</span>
                    <span className="sm:text-right">Уведомление</span>
                  </div>
                  {waitlist.map((item) => (
                    <div key={item.id} className="admin-table-row px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="admin-mono text-sm font-semibold text-[var(--admin-text)]">{item.email}</p>
                        <p className="text-xs admin-muted mt-1">{formatDate(item.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-fit text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-200">
                          {item.source}
                        </span>
                        <span className={`w-fit text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          item.notifiedAt ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-[var(--admin-text-soft)]'
                        }`}>
                          {item.notifiedAt ? 'уведомлён' : 'ожидает'}
                        </span>
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            </div>
            </div>
          )}

          {tab === 'remnawave' && (
            <div className="space-y-4">
              <div className="admin-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs admin-muted">Панель управления</p>
                  <p className="font-bold text-lg mt-1">Remnawave</p>
                  <p className="text-xs admin-muted mt-2 max-w-xl">
                    {remnawave?.contract.note || 'Связь jetsale.online → Remnawave API'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    remnawave?.status === 'ok'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}>
                    {remnawave?.status === 'ok' ? 'Подключено' : 'Ошибка'}
                  </span>
                  {remnawave?.panelUrl && (
                    <a
                      href={remnawave.panelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-btn"
                    >
                      Открыть панель <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {remnawave?.error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {remnawave.error}
                </div>
              )}

              <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="admin-card p-4">
                  <p className="text-xs admin-muted">Ноды в squad</p>
                  <p className="text-2xl font-extrabold mt-2">{remnawave?.nodesCount ?? '—'}</p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-xs admin-muted">Задержка</p>
                  <p className="text-2xl font-extrabold mt-2">
                    {remnawave ? `${remnawave.latencyMs} мс` : '—'}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-xs admin-muted">Провижининг</p>
                  <p className="text-2xl font-extrabold mt-2">
                    {remnawave?.provisioning ? 'ON' : 'OFF'}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-xs admin-muted">Squad UUID</p>
                  <p className="admin-mono mt-2 break-all text-[var(--admin-text-soft)]">
                    {remnawave?.squadUuid || '—'}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-xs admin-muted">Proxy node UUID</p>
                  <p className="admin-mono mt-2 break-all text-[var(--admin-text-soft)]">
                    {remnawave?.supportedProxyNodeUuid || '—'}
                  </p>
                </div>
                <div className="admin-card p-4 sm:col-span-2 xl:col-span-5">
                  <p className="text-xs admin-muted">Страница подписки</p>
                  <p className="admin-mono text-sm mt-2 text-teal-200 break-all">
                    https://{remnawave?.subPublicDomain || 'node.jetsale.online'}/&lt;shortUuid&gt;
                  </p>
                </div>
              </div>

              <div className="admin-card p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="text-xs admin-muted font-semibold">Синхронизация пользователя → Remnawave</label>
                  <input
                    value={syncUserId}
                    onChange={(e) => setSyncUserId(e.target.value.trim())}
                    placeholder="jetsale.online user UUID"
                    className="admin-input mt-2 h-11"
                  />
                </div>
                <button
                  type="button"
                  disabled={syncBusy || !syncUserId}
                  onClick={async () => {
                    setSyncBusy(true)
                    setError('')
                    try {
                      const result = await syncAdminRemnawaveUser(syncUserId)
                      setNotice(result.message)
                      await loadTab('remnawave', true)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Синхронизация не удалась')
                    } finally {
                      setSyncBusy(false)
                    }
                  }}
                  className="admin-btn disabled:opacity-60"
                >
                  {syncBusy ? 'Синхронизация…' : 'Синхронизировать'}
                </button>
              </div>

              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">
                  Доступные ноды ({remnawave?.nodes.length ?? 0})
                </div>
                <div>
                  {!remnawave || remnawave.nodes.length === 0 ? (
                    <div className="px-5 py-10 text-sm admin-muted">Ноды не получены</div>
                  ) : (
                    <>
                    <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                      <span>Нода</span>
                      <span className="lg:text-right">Тип</span>
                    </div>
                    {remnawave.nodes.map((node) => (
                      <div
                        key={node.uuid}
                        className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold text-sm">{node.name}</p>
                          <p className="text-xs admin-muted mt-1">
                            {node.countryCode} · {node.configProfileName} · <span className="admin-mono">{node.uuid.slice(0, 8)}</span>
                          </p>
                          <p className="text-[11px] admin-muted mt-1">
                            inbounds: {node.activeInbounds?.length ? node.activeInbounds.join(', ') : '—'}
                          </p>
                        </div>
                        <span className={`w-fit text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          node.isSupportedProxy
                            ? 'bg-teal-500/15 text-teal-200'
                            : 'bg-white/5 text-[var(--admin-text-soft)]'
                        }`}>
                          {node.isSupportedProxy ? 'jetsale.online PROXY' : 'SQUAD'}
                        </span>
                      </div>
                    ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'referrals' && (
            <div className="space-y-4">
              {referrals ? (
                <>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="admin-card p-4"><p className="text-xs admin-muted">Pending</p><p className="text-2xl font-extrabold mt-2">{referrals.summary.pending}</p></div>
                    <div className="admin-card p-4"><p className="text-xs admin-muted">Granted</p><p className="text-2xl font-extrabold mt-2 text-emerald-300">{referrals.summary.granted}</p></div>
                    <div className="admin-card p-4"><p className="text-xs admin-muted">Rejected</p><p className="text-2xl font-extrabold mt-2">{referrals.summary.rejected}</p></div>
                  </div>
                  <div className="admin-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Топ рефереров</div>
                    {referrals.topReferrers.length === 0 ? (
                      <div className="px-5 py-8 text-sm admin-muted">Пока нет</div>
                    ) : (
                      <>
                        <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                          <span>Пользователь</span>
                          <span className="lg:text-right">Награды</span>
                        </div>
                        {referrals.topReferrers.map((row) => (
                          <div key={row.userId} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                            <div>
                              <button type="button" onClick={() => void openUserDetail(row.userId)} className="text-sm font-semibold text-teal-200 hover:text-teal-100">
                                {row.email}
                              </button>
                              {row.supportCode ? <p className="text-xs admin-muted mt-1 admin-mono">{row.supportCode}</p> : null}
                            </div>
                            <p className="text-sm font-bold">{row.grantedCount} × +{row.daysGranted}д</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="admin-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Недавние ({referrals.recent.length})</div>
                    {referrals.recent.length === 0 ? (
                      <div className="px-5 py-8 text-sm admin-muted">Нет событий</div>
                    ) : (
                      referrals.recent.map((item) => (
                        <div key={item.id} className="admin-table-row px-5 py-4 text-sm">
                          <p>
                            <button type="button" onClick={() => void openUserDetail(item.referrer.id)} className="text-teal-200 hover:text-teal-100">{item.referrer.email}</button>
                            {' → '}
                            <button type="button" onClick={() => void openUserDetail(item.referred.id)} className="text-teal-200 hover:text-teal-100">{item.referred.email}</button>
                          </p>
                          <p className="text-xs admin-muted mt-1">
                            {item.status} · +{item.daysGranted}д · {formatDate(item.createdAt)}
                            {item.rejectReason ? ` · ${item.rejectReason}` : ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="admin-card p-8 text-sm admin-muted">Загрузка рефералов…</div>
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div className="admin-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Журнал аудита</div>
              {auditItems.length === 0 ? (
                <div className="px-5 py-10 text-sm admin-muted">Записей нет</div>
              ) : (
                <>
                  <div className="admin-grid-head grid-cols-1 lg:grid-cols-[auto_1fr_auto]">
                    <span>Время</span>
                    <span>Действие</span>
                    <span className="lg:text-right">Актор</span>
                  </div>
                  {auditItems.map((item) => (
                    <div key={item.id} className="admin-table-row px-5 py-3 grid lg:grid-cols-[auto_1fr_auto] gap-2 text-sm">
                      <span className="text-xs admin-muted whitespace-nowrap">{formatDate(item.createdAt)}</span>
                      <span>
                        <span className="font-semibold">{item.action}</span>
                        {item.targetType ? (
                          <span className="admin-muted text-xs"> · {item.targetType}{item.targetId ? ` ${item.targetId.slice(0, 8)}` : ''}</span>
                        ) : null}
                      </span>
                      <span className="text-xs admin-mono lg:text-right">{item.actorEmail}</span>
                    </div>
                  ))}
                </>
              )}
              <PaginationBar page={auditPage} totalPages={auditTotalPages} onPage={(p) => setAuditPage(p)} />
            </div>
          )}

          {tab === 'plans' && (
            <div className="space-y-4">
              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Тарифы ({planRows.length})</div>
                {planRows.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Нет тарифов</div>
                ) : (
                  <>
                    <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                      <span>План</span>
                      <span className="lg:text-right">Цена / срок</span>
                    </div>
                    {planRows.map((plan) => (
                      <div key={plan.id} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{plan.name}</p>
                          <p className="text-xs admin-muted mt-1">
                            {plan.slug || '—'} · {plan.deviceLimit} устр.
                            {plan.description ? ` · ${plan.description}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{money(plan.price)}</span>
                          <span className="text-xs admin-muted">{plan.durationDays}д</span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${plan.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5'}`}>
                            {plan.isActive ? 'ACTIVE' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="admin-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--admin-border-soft)] font-bold">Купоны ({couponRows.length})</div>
                {couponRows.length === 0 ? (
                  <div className="px-5 py-10 text-sm admin-muted">Нет купонов</div>
                ) : (
                  <>
                    <div className="admin-grid-head grid-cols-1 lg:grid-cols-[1fr_auto]">
                      <span>Код</span>
                      <span className="lg:text-right">Скидка</span>
                    </div>
                    {couponRows.map((coupon) => (
                      <div key={coupon.id} className="admin-table-row px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <div>
                          <p className="admin-mono font-semibold text-sm">{coupon.code}</p>
                          <p className="text-xs admin-muted mt-1">
                            +{coupon.bonusDays}д бонус · {coupon.redeemedCount}
                            {coupon.maxRedemptions != null ? ` / ${coupon.maxRedemptions}` : ''} исп.
                            {coupon.endsAt ? ` · до ${formatDate(coupon.endsAt)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">
                            {coupon.percentOff != null ? `${coupon.percentOff}%` : coupon.amountOff ? money(coupon.amountOff) : '—'}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${coupon.isActive ? 'bg-teal-500/15 text-teal-200' : 'bg-white/5'}`}>
                            {coupon.isActive ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'pages' && (
            <div className="space-y-4">
              <div className="admin-card p-5">
                <p className="font-bold">Юридические страницы сайта</p>
                <p className="text-xs admin-muted mt-1">
                  Редактируются тексты <a className="text-teal-300 hover:underline" href="/oferta" target="_blank" rel="noreferrer">/oferta</a>
                  {' '}и{' '}
                  <a className="text-teal-300 hover:underline" href="/policy" target="_blank" rel="noreferrer">/policy</a>.
                  Плейсхолдеры вроде [ИНН], [EMAIL] замените на свои данные.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['oferta', 'policy'] as const).map((slug) => {
                    const page = sitePages.find((item) => item.slug === slug)
                    const active = pageSlug === slug
                    return (
                      <button
                        key={slug}
                        type="button"
                        className={`text-xs font-bold px-3 py-2 rounded-lg border transition ${
                          active
                            ? 'border-teal-400/50 bg-teal-500/15 text-teal-100'
                            : 'border-[var(--admin-border-soft)] text-[var(--admin-text-soft)] hover:bg-white/5'
                        }`}
                        onClick={() => {
                          setPageSlug(slug)
                          if (page) {
                            setPageTitle(page.title)
                            setPageBody(page.body)
                          }
                        }}
                      >
                        {slug === 'oferta' ? 'Оферта' : 'Политика'}
                        {page?.updatedAt ? ` · ${formatDate(page.updatedAt)}` : ''}
                      </button>
                    )
                  })}
                </div>
                <label className="block mt-4 text-xs admin-muted">Заголовок</label>
                <input
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  className="admin-input mt-1 w-full"
                />
                <label className="block mt-4 text-xs admin-muted">Текст (абзацы через пустую строку)</label>
                <textarea
                  value={pageBody}
                  onChange={(e) => setPageBody(e.target.value)}
                  rows={18}
                  className="admin-input mt-1 w-full font-mono text-xs leading-5 min-h-[320px]"
                />
                <button
                  type="button"
                  disabled={pageBusy || !pageTitle.trim() || pageBody.trim().length < 20}
                  onClick={() => runAction(`page-${pageSlug}`, async () => {
                    setPageBusy(true)
                    try {
                      const res = await updateAdminSitePage(pageSlug, {
                        title: pageTitle.trim(),
                        body: pageBody.trim(),
                      })
                      setSitePages((prev) => {
                        const next = prev.filter((item) => item.slug !== pageSlug)
                        return [...next, res.page]
                      })
                      return res.message
                    } finally {
                      setPageBusy(false)
                    }
                  })}
                  className="admin-btn mt-4 disabled:opacity-60"
                >
                  {pageBusy ? 'Сохранение…' : 'Сохранить страницу'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
