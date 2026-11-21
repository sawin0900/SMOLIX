import { Bell, CreditCard, Mail, MonitorSmartphone, Network, Receipt, Users } from 'lucide-react'
import type { AdminRemnawave, AdminServer, AdminStats } from '../api'
import type { getAdminRetention } from '../api'
import { formatAdminMoney } from './money'

type RetentionStats = Awaited<ReturnType<typeof getAdminRetention>>

export function OverviewTab({
  stats,
  retention,
  remnawave,
  openAlerts,
  waitlistPending,
  servers,
}: {
  stats: AdminStats | null
  retention: RetentionStats | null
  remnawave: AdminRemnawave | null
  openAlerts: number
  waitlistPending: number
  servers: AdminServer[]
}) {
  const money = formatAdminMoney
  const remnawaveNodesCount = remnawave?.nodes?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(
          [
            { label: 'Пользователи', value: stats?.users, Icon: Users },
            { label: 'Premium сейчас', value: stats?.premiumActive ?? '—', Icon: CreditCard },
            { label: 'Trial сейчас', value: stats?.trialActive, Icon: CreditCard },
            { label: 'Оплаченных заказов', value: stats?.paidOrders, Icon: Receipt },
            { label: 'Выручка всё время', value: money(stats?.payments?.revenueAll), Icon: Receipt },
            { label: 'Выручка 30 дней', value: money(stats?.payments?.revenue30d), Icon: Receipt },
            { label: 'Выручка сегодня', value: money(stats?.payments?.revenueToday), Icon: Receipt },
            { label: 'Средний чек', value: money(stats?.payments?.avgCheck), Icon: CreditCard },
            { label: 'Сессии', value: stats?.sessions, Icon: MonitorSmartphone },
            { label: 'Лист ожидания', value: stats?.waitlistPending ?? waitlistPending, Icon: Mail },
            { label: 'Открытые алерты', value: stats?.openAlerts ?? openAlerts, Icon: Bell },
            { label: 'Remnawave ноды', value: remnawave?.nodesCount, Icon: Network },
          ] as const
        ).map(({ label, value, Icon }) => (
          <div key={label} className="admin-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs admin-muted">{label}</p>
              <Icon size={16} className="text-teal-300" />
            </div>
            <p className="text-2xl font-extrabold mt-3">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {retention && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {(
            [
              { label: 'Регистрации 7д', value: retention.registered7 },
              { label: 'Регистрации 30д', value: retention.registered30 },
              { label: 'Вход в расширение 7д', value: retention.extensionLogin7 },
              { label: 'Оплаты 7д', value: retention.paid7 },
              { label: 'Оплаты 30д', value: retention.paid30 },
              { label: 'Trial активны', value: retention.trialActive },
              { label: 'Waitlist ожидают', value: retention.waitlist.pending },
              { label: 'Waitlist уведомлены', value: retention.waitlist.notified },
            ] as const
          ).map(({ label, value }) => (
            <div key={label} className="admin-card p-4">
              <p className="text-xs admin-muted">{label}</p>
              <p className="text-xl font-extrabold mt-2">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {stats?.antibot && (
        <div className="admin-card p-5">
          <p className="font-bold">Антибот ({stats.antibot.window})</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="admin-muted text-xs">Register OK</p>
              <p className="font-extrabold text-xl mt-1 text-emerald-300">{stats.antibot.registerOk}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Honeypot</p>
              <p className="font-extrabold text-xl mt-1 text-amber-200">{stats.antibot.honeypot}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Disposable</p>
              <p className="font-extrabold text-xl mt-1 text-rose-200">{stats.antibot.disposable}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Видов событий</p>
              <p className="font-extrabold text-xl mt-1">{Object.keys(stats.antibot.byKind || {}).length}</p>
            </div>
          </div>
          {Object.keys(stats.antibot.byKind || {}).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(stats.antibot.byKind).map(([kind, count]) => (
                <span
                  key={kind}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/5 text-[var(--admin-text-soft)]"
                >
                  {kind}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {stats?.payments && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="admin-card p-5">
            <p className="font-bold">Воронка заказов</p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="admin-muted text-xs">Создано</p>
                <p className="font-extrabold text-xl mt-1">{stats.payments.funnel.created}</p>
              </div>
              <div>
                <p className="admin-muted text-xs">Pending</p>
                <p className="font-extrabold text-xl mt-1">{stats.payments.funnel.pending}</p>
              </div>
              <div>
                <p className="admin-muted text-xs">Paid</p>
                <p className="font-extrabold text-xl mt-1 text-emerald-300">{stats.payments.funnel.paid}</p>
              </div>
              <div>
                <p className="admin-muted text-xs">Cancelled</p>
                <p className="font-extrabold text-xl mt-1">{stats.payments.funnel.cancelled}</p>
              </div>
              <div>
                <p className="admin-muted text-xs">Refunded</p>
                <p className="font-extrabold text-xl mt-1">{stats.payments.funnel.refunded}</p>
              </div>
              <div>
                <p className="admin-muted text-xs">Paid за 7д</p>
                <p className="font-extrabold text-xl mt-1">{stats.payments.paid7d}</p>
              </div>
            </div>
            <p className="text-xs admin-muted mt-4">
              Trial → paid: {stats.payments.paidFromTrial} из {stats.payments.trialUsers} ({stats.payments.trialToPaidRate}%)
            </p>
          </div>
          <div className="admin-card p-5 overflow-hidden">
            <p className="font-bold">Выручка по дням (30д)</p>
            <div className="mt-3 max-h-56 overflow-auto">
              <div className="admin-grid-head grid-cols-[1fr_auto_auto]">
                <span>День</span>
                <span>Оплат</span>
                <span>Сумма</span>
              </div>
              {[...stats.payments.revenueByDay].reverse().map((day) => (
                <div key={day.date} className="admin-table-row px-0 py-2 grid grid-cols-[1fr_auto_auto] gap-3 text-sm">
                  <span className="admin-mono">{day.date}</span>
                  <span className="text-right">{day.count}</span>
                  <span className="text-right font-semibold">{money(day.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="admin-card p-5 text-sm admin-muted">
        Runtime локации: Remnawave ({remnawaveNodesCount}). Каталог кабинета: таблица Server ({servers.length}).
      </div>
    </div>
  )
}