/** Same hostname as the page so session cookies stay same-site (localhost ≠ 127.0.0.1). */
function defaultApiUrl() {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3001`
    }
    // Production behind nginx: same-origin /api proxy
    return '/api'
  }
  return '/api'
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
  || (import.meta.env.DEV ? '/api' : defaultApiUrl())

export type User = {
  id: string
  email: string
  status: string
  role?: 'USER' | 'ADMIN' | 'SUPPORT'
  createdAt?: string
  emailVerifiedAt?: string | null
  supportCode?: string | null
}

export type AuthResponse = {
  message: string
  user: User
}

export type VpnAccountInfo = {
  isProvisioned: boolean
  remnawaveUsername?: string | null
  proxyProvisioned?: boolean
  subscriptionUrl?: string | null
  subscriptionShortUuid?: string | null
}

export type MeResponse = {
  user: User
  vpnAccount: {
    isProvisioned: boolean
  } | null
}

export type AccountResponse = {
  user: User
  vpnAccount: VpnAccountInfo | null
}

export type ServerItem = {
  id: string
  name: string
  country: string
  city: string
  hostname: string
  port: number
}

export type ServersResponse = {
  servers: ServerItem[]
}

export type SubscriptionResponse = {
  subscription: {
    id: string
    status: string
    isTrial?: boolean
    startsAt: string | null
    expiresAt: string | null
    remainingSeconds?: number | null
    plan: {
      id: string
      name: string
      description: string | null
      price: string
      currency: string
      durationDays: number
      deviceLimit?: number
    }
  } | null
}

export type AdminPaymentStats = {
  revenueAll: string
  revenueToday: string
  revenue7d: string
  revenue30d: string
  paidToday: number
  paid7d: number
  paid30d: number
  avgCheck: string
  currency: string
  funnel: {
    created: number
    pending: number
    paid: number
    cancelled: number
    refunded: number
  }
  trialUsers: number
  paidFromTrial: number
  trialToPaidRate: number
  revenueByDay: Array<{ date: string; count: number; amount: string }>
}

export type AdminStats = {
  users: number
  activeSubscriptions: number
  premiumActive?: number
  servers: number
  sessions: number
  waitlistPending?: number
  paidOrders?: number
  trialActive?: number
  openAlerts?: number
  payments?: AdminPaymentStats
  antibot?: {
    window: string
    byKind: Record<string, number>
    registerOk: number
    honeypot: number
    disposable: number
  }
}

export type AdminUserDetail = {
  id: string
  email: string
  role: string
  status: string
  emailVerifiedAt?: string | null
  supportCode?: string | null
  signupIpHash?: string | null
  adminNote?: string | null
  referredByUserId?: string | null
  createdAt: string
  vpnAccount?: (VpnAccountInfo & { remnawaveUserId?: string | null }) | null
  subscriptions: Array<{
    id: string
    status: string
    isTrial: boolean
    startsAt: string | null
    expiresAt: string | null
    createdAt: string
    plan: {
      id: string
      name: string
      slug: string | null
      deviceLimit: number
      price: string
      currency: string
    }
  }>
  orders: Array<{
    id: string
    status: string
    amount: string
    currency: string
    createdAt: string
    plan: { name: string; slug: string | null }
    payment: {
      status: string
      provider: string | null
      providerPaymentId: string | null
      createdAt: string
    } | null
  }>
  extensionSessions: Array<{
    id: string
    deviceName: string
    deviceId: string | null
    createdAt: string
    expiresAt: string
    lastUsedAt: string | null
  }>
  referralRewardsGiven?: Array<{
    id: string
    status: string
    daysGranted: number
    rejectReason?: string | null
    createdAt: string
    referred: { id: string; email: string; signupIpHash?: string | null }
  }>
  referralRewardsReceived?: Array<{
    id: string
    status: string
    daysGranted: number
    rejectReason?: string | null
    createdAt: string
    referrer: { id: string; email: string }
  }>
}

export type AdminAlert = {
  id: string
  type: string
  title: string
  message: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  target?: string | null
  meta?: unknown
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string | null
  resolvedAt?: string | null
}

export type ProbeTarget = {
  id: string
  key: string
  label: string
  host: string
  port: number
  kind: string
  isActive: boolean
  lastStatus?: string | null
  lastIp?: string | null
  lastLatencyMs?: number | null
  lastBlocked?: boolean | null
  lastError?: string | null
  lastCheckedAt?: string | null
}

export type AdminUser = {
  id: string
  email: string
  role: string
  status: string
  emailVerifiedAt?: string | null
  supportCode?: string | null
  signupIpHash?: string | null
  adminNote?: string | null
  createdAt: string
  vpnAccount?: VpnAccountInfo | null
  subscriptions?: Array<{
    id?: string
    status: string
    isTrial: boolean
    expiresAt: string | null
    plan?: { name: string; deviceLimit: number }
  }>
}

export type AdminPageMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type AdminSubscription = {
  id: string
  status: string
  isTrial: boolean
  startsAt: string | null
  expiresAt: string | null
  createdAt: string
  user: { id: string; email: string; status: string }
  plan: {
    id: string
    name: string
    price: string
    currency: string
    durationDays: number
    deviceLimit?: number
  }
}

export type AdminOrder = {
  id: string
  status: string
  amount: string
  currency: string
  createdAt: string
  user: { id: string; email: string }
  plan: { id: string; name: string; slug: string | null }
  payment: {
    id: string
    status: string
    provider: string | null
    providerPaymentId: string | null
    createdAt: string
  } | null
}

export type AdminServer = {
  id: string
  name: string
  country: string
  city: string | null
  hostname: string
  port: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type AdminSession = {
  id: string
  deviceName: string
  deviceId: string | null
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  user: { id: string; email: string; status: string }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const raw = await response.text()
  let data: { error?: string } & Record<string, unknown> = {}
  if (raw) {
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      throw new Error(
        response.ok
          ? 'Сервер вернул неожиданный ответ'
          : `Ошибка сервера (${response.status})`,
      )
    }
  }

  if (!response.ok) {
    throw new Error(
      (typeof data.error === 'string' && data.error)
        || (response.status === 401 ? 'Требуется авторизация' : null)
        || `Произошла ошибка (${response.status}). Попробуйте ещё раз.`,
    )
  }

  return data as T
}

export type RegisterAntibot = {
  turnstileRequired: boolean
  turnstileSiteKey: string | null
  minFormMs: number
}

export function getRegisterAntibot() {
  return request<RegisterAntibot>('/auth/antibot')
}

export function register(
  email: string,
  password: string,
  options?: {
    referralCode?: string
    formStartedAt?: number
    turnstileToken?: string
    website?: string
    company?: string
  },
) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      ...(options?.referralCode ? { referralCode: options.referralCode } : {}),
      formStartedAt: options?.formStartedAt ?? Date.now(),
      ...(options?.turnstileToken ? { turnstileToken: options.turnstileToken } : {}),
      website: options?.website ?? '',
      company: options?.company ?? '',
    }),
  })
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getMe() {
  return request<MeResponse>('/auth/me')
}

export function getAccount() {
  return request<AccountResponse>('/account')
}

export function refreshVpnSubscription() {
  return request<{
    message: string
    vpnAccount: VpnAccountInfo | null
  }>('/account/vpn/refresh', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function getServers() {
  return request<ServersResponse>('/account/servers')
}

export function getSubscription() {
  return request<SubscriptionResponse>('/account/subscription')
}

export type AccountOverview = {
  user: User
  vpnAccount?: VpnAccountInfo | null
  subscription: {
    id: string
    status: string
    isTrial: boolean
    startsAt: string | null
    expiresAt: string | null
    remainingSeconds: number | null
    planName: string
    deviceLimit?: number
  } | null
  devices: { activeCount: number; deviceLimit?: number }
  extension?: {
    linked: boolean
    stale: boolean
    lastUsedAt: string | null
    deviceName: string | null
  }
  impersonation?: { active: boolean; actorId?: string }
  lastConnection: {
    status: string
    mode: string
    serverId: string | null
    startedAt: string
    endedAt: string | null
    message: string | null
  } | null
}

export type AccountOrder = {
  id: string
  status: string
  amount: string
  currency: string
  createdAt: string
  plan: { name: string; slug: string | null }
  payment: { status: string; provider: string | null; createdAt: string } | null
}

export type AccountDevice = {
  id: string
  deviceName: string
  deviceId: string | null
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string
}

export type ConnectionHistoryItem = {
  id: string
  status: string
  mode: string
  serverId: string | null
  message: string | null
  startedAt: string
  endedAt: string | null
  createdAt: string
}

export function getAccountOverview() {
  return request<AccountOverview>('/account/overview')
}

export function getAccountDevices() {
  return request<{ devices: AccountDevice[] }>('/account/devices')
}

export function revokeAllExtensionDevices() {
  return request<{ message: string; revoked: number }>('/account/devices/revoke-all', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function revokeExtensionDevice(deviceId: string) {
  return request<{ message: string; revoked: number }>(`/account/devices/${deviceId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function getAccountHistory() {
  return request<{ history: ConnectionHistoryItem[] }>('/account/history')
}

export function getAccountOrders() {
  return request<{ orders: AccountOrder[] }>('/account/orders')
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return request<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}

export function joinWaitlist(email: string, source = 'landing') {
  return request<{ message: string; alreadyJoined: boolean }>('/marketing/waitlist', {
    method: 'POST',
    body: JSON.stringify({ email, source }),
  })
}

export function getAdminWaitlist(pendingOnly = false) {
  const qs = pendingOnly ? '?pending=1' : ''
  return request<{
    count: number
    pendingCount?: number
    entries: Array<{
      id: string
      email: string
      source: string
      notifiedAt?: string | null
      createdAt: string
    }>
  }>(`/admin/waitlist${qs}`)
}

export function notifyAdminWaitlist() {
  return request<{ message: string; sent: number }>('/admin/waitlist/notify', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function sendAdminMailBroadcast(data: {
  subject: string
  title: string
  lead: string
  ctaLabel?: string
  ctaPath?: string
  audience: 'all' | 'premium' | 'trial' | 'me'
}) {
  return request<{ message: string; sent: number; audience: string }>('/admin/mail/broadcast', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export type AdminRemnawave = {
  status: 'ok' | 'error'
  panelUrl: string | null
  squadUuid: string
  supportedProxyNodeUuid: string
  nodesCount: number
  latencyMs: number
  provisioning?: boolean
  systemHealth?: unknown
  error?: string
  nodes: Array<{
    uuid: string
    name: string
    countryCode: string
    configProfileName: string
    activeInbounds: string[]
    isSupportedProxy: boolean
  }>
  subPublicDomain?: string
  contract: {
    apiPrefix: string
    auth: string
    note: string
  }
}

export function getAdminRemnawave() {
  return request<AdminRemnawave>('/admin/remnawave')
}

export function syncAdminRemnawaveUser(userId: string) {
  return request<{ message: string; result: unknown }>('/admin/remnawave/sync-user', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export type BillingPlan = {
  id: string
  slug: string | null
  name: string
  description: string | null
  price: string
  currency: string
  durationDays: number
  deviceLimit: number
}

export function getBillingPlans() {
  return request<{ provider: 'yookassa' | 'mock'; plans: BillingPlan[] }>('/billing/plans')
}

export function createCheckout(input: { planId?: string; planSlug?: string; couponCode?: string } = {}) {
  return request<{
    orderId: string
    confirmationUrl: string
    mock: boolean
    amount: string
    currency: string
    plan: { id: string; name: string; slug: string | null }
  }>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function confirmMockPayment(orderId: string) {
  return request<{ message: string; alreadyPaid: boolean }>('/billing/mock-confirm', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export function getReferral() {
  return request<{
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
      grantedAt?: string | null
      createdAt: string
      email: string
    }>
  }>('/account/referral')
}

export type PublicStatus = {
  status: 'operational' | 'degraded' | 'major_outage'
  checkedAt: string
  latencyMs: number
  components: Array<{
    id: string
    name: string
    status: 'ok' | 'error'
    meta?: Record<string, unknown>
  }>
  servers: Array<{
    id: string
    name: string
    country: string
    city: string | null
    isActive: boolean
    status: 'ok' | 'error'
  }>
}

export function getPublicStatus() {
  return request<PublicStatus>('/status')
}

export function getAdminStats() {
  return request<AdminStats>('/admin/stats')
}

export function getAdminUser(userId: string) {
  return request<{ user: AdminUserDetail }>(`/admin/users/${userId}`)
}

export function getAdminAlerts(status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL' = 'OPEN') {
  return request<{
    openCount: number
    alerts: AdminAlert[]
    probes: ProbeTarget[]
  }>(`/admin/alerts?status=${status}`)
}

export function runAdminProbe() {
  return request<{
    message: string
    checkedAt: string
    alertsCreated: number
    antifilterSize: number
    probes: Array<{
      key: string
      label: string
      host: string
      port: number
      ok: boolean
      ip: string | null
      latencyMs: number | null
      blocked: boolean | null
      error: string | null
    }>
  }>('/admin/alerts/run-probe', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function ackAdminAlert(alertId: string) {
  return request<{ message: string }>(`/admin/alerts/${alertId}/ack`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function resolveAdminAlert(alertId: string) {
  return request<{ message: string }>(`/admin/alerts/${alertId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function getAdminUsers(params?: { q?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams()
  if (params?.q?.trim()) search.set('q', params.q.trim())
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  return request<{ users: AdminUser[] } & AdminPageMeta>(`/admin/users${qs ? `?${qs}` : ''}`)
}

export function updateAdminUserStatus(userId: string, status: 'ACTIVE' | 'BLOCKED' | 'PENDING') {
  return request<{ message: string; user: AdminUser }>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function extendAdminUser(userId: string, days = 7) {
  return request<{ message: string; subscription: unknown }>(`/admin/users/${userId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  })
}

export function cancelAdminUserSubscription(userId: string) {
  return request<{ message: string; cancelled: number }>(`/admin/users/${userId}/cancel-subscription`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function getAdminSubscriptions() {
  return request<{ subscriptions: AdminSubscription[] }>('/admin/subscriptions')
}

export function getAdminOrders(params?: {
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'ALL'
  q?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}) {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.q) search.set('q', params.q)
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  return request<{ orders: AdminOrder[] } & AdminPageMeta>(`/admin/orders${qs ? `?${qs}` : ''}`)
}

export function getAdminSessions(params?: { page?: number; limit?: number }) {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  return request<{ sessions: AdminSession[] } & AdminPageMeta>(`/admin/sessions${qs ? `?${qs}` : ''}`)
}

export function getAdminSearch(q: string) {
  return request<{
    users: Array<{ id: string; email: string; supportCode?: string | null; status: string }>
    orders: Array<{ id: string; status: string; amount: string; user: { id: string; email: string } }>
    vpnAccounts: Array<{ userId: string; remnawaveUsername?: string | null; subscriptionShortUuid?: string | null; user: { email: string } }>
  }>(`/admin/search?q=${encodeURIComponent(q)}`)
}

export function getAdminReferrals() {
  return request<{
    summary: { pending: number; granted: number; rejected: number }
    topReferrers: Array<{ userId: string; email: string; supportCode: string | null; grantedCount: number; daysGranted: number }>
    recent: Array<{
      id: string
      status: string
      daysGranted: number
      rejectReason?: string | null
      createdAt: string
      referrer: { id: string; email: string }
      referred: { id: string; email: string; signupIpHash?: string | null }
    }>
  }>('/admin/referrals')
}

export function getAdminRetention() {
  return request<{
    registered7: number
    registered30: number
    extensionLogin7: number
    paid7: number
    paid30: number
    trialActive: number
    waitlist: { pending: number; notified: number; convertedApprox: number }
    signupEvents24h: Record<string, number>
    featureFlags: Record<string, unknown>
  }>('/admin/retention')
}

export function getAdminAudit(page = 1) {
  return request<{ items: Array<{ id: string; actorEmail: string; action: string; targetType?: string | null; targetId?: string | null; createdAt: string }> } & AdminPageMeta>(
    `/admin/audit?page=${page}`,
  )
}

export function getAdminPlans() {
  return request<{ plans: Array<{ id: string; name: string; slug: string | null; price: string; durationDays: number; deviceLimit: number; isActive: boolean; description?: string | null }> }>('/admin/plans')
}

export function updateAdminPlan(planId: string, data: Partial<{ name: string; price: number; durationDays: number; deviceLimit: number; isActive: boolean; description: string | null }>) {
  return request<{ message: string }>(`/admin/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getAdminCoupons() {
  return request<{ coupons: Array<{ id: string; code: string; percentOff?: number | null; amountOff?: string | null; bonusDays: number; maxRedemptions?: number | null; redeemedCount: number; isActive: boolean; endsAt?: string | null }> }>('/admin/coupons')
}

export function createAdminCoupon(data: { code: string; percentOff?: number; amountOff?: number; bonusDays?: number; maxRedemptions?: number; endsAt?: string }) {
  return request<{ message: string }>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function toggleAdminCoupon(couponId: string, isActive: boolean) {
  return request<{ message: string }>(`/admin/coupons/${couponId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}

export function markAdminOrderPaid(orderId: string) {
  return request<{ message: string }>(`/admin/orders/${orderId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function impersonateAdminUser(userId: string) {
  return request<{ message: string; url: string; expiresAt: string }>(`/admin/users/${userId}/impersonate`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function consumeImpersonation(token: string) {
  return request<{ message: string; impersonation: boolean; user: User }>('/auth/impersonate/consume', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function refundAdminOrder(orderId: string) {
  return request<{ message: string }>(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function updateAdminUserNote(userId: string, adminNote: string | null) {
  return request<{ message: string }>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ adminNote }),
  })
}

export function getAccountNotices() {
  return request<{ notices: Array<{ id: string; level: 'info' | 'warning' | 'critical'; title: string; text: string; href?: string }> }>('/account/notices')
}

export type SitePage = {
  slug: string
  title: string
  body: string
  updatedAt: string
  updatedBy?: string | null
}

export function getSitePage(slug: 'oferta' | 'policy') {
  return request<SitePage>(`/site/pages/${slug}`)
}

export function getAdminSitePages() {
  return request<{ pages: SitePage[] }>('/admin/site/pages')
}

export function updateAdminSitePage(slug: 'oferta' | 'policy', data: { title: string; body: string }) {
  return request<{ message: string; page: SitePage }>(`/admin/site/pages/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function getWebSessions() {
  return request<{ sessions: Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }> }>('/account/web-sessions')
}

export function revokeWebSession(sessionId: string) {
  return request<{ message: string }>(`/account/web-sessions/${sessionId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function revokeOtherWebSessions() {
  return request<{ message: string }>('/account/web-sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function requestEmailVerification() {
  return request<{ message: string }>('/auth/email-verification/request', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function confirmEmailVerification(token: string) {
  return request<{ message: string }>('/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function getAdminServers() {
  return request<{ servers: AdminServer[] }>('/admin/servers')
}

export function updateAdminServer(serverId: string, isActive: boolean) {
  return request<{ message: string; server: AdminServer }>(`/admin/servers/${serverId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}


export function revokeAdminSession(sessionId: string) {
  return request<{ message: string; revoked: number }>(`/admin/sessions/${sessionId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function logout() {
  return request<{ message: string }>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
