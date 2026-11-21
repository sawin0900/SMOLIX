import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Download, Globe2, Smartphone, Zap } from 'lucide-react'
import {
  getAccountOrders,
  getBillingPlans,
  getSubscription,
  createCheckout,
  confirmMockPayment,
  joinWaitlist,
  type SubscriptionResponse,
  type AccountOrder,
  type BillingPlan,
  type AccountResponse,
  type VpnAccountInfo,
} from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { formatDate, formatRemaining } from './format'
import { TrialBanner } from './shared'
import { SubscriptionLinkCard } from './SubscriptionLinkCard'

export function SubscriptionView({
  subscription,
  subscriptionProgress,
  userEmail,
  vpnAccount,
  deviceLimit,
  deviceCount,
  onRefresh,
  onVpnUpdated,
  onToast,
  locale,
}: {
  subscription: SubscriptionResponse['subscription']
  subscriptionProgress: number | null
  userEmail: string
  vpnAccount: AccountResponse['vpnAccount']
  deviceLimit: number
  deviceCount: number
  locale: Locale
  onRefresh: () => Promise<void>
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const t = CABINET_COPY[locale]
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
          onToast(err instanceof Error ? err.message : t.payConfirmFailed, 'error')
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
          onToast(t.payPendingHint, 'success')
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
      onToast(err instanceof Error ? err.message : t.checkoutFailed, 'error')
      setBusy(false)
    }
  }

  const handleWaitlist = async () => {
    setBusy(true)
    try {
      await joinWaitlist(userEmail, 'cabinet-premium')
      onToast(t.waitlistOk, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t.waitlistFailed, 'error')
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
          locale={locale}
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
            Полный доступ через прокси jetsale.online
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
