import { Bell, CreditCard, Mail, MonitorSmartphone, Network, Receipt, Users } from 'lucide-react'
import type { AdminOpsHealth, AdminRemnawave, AdminServer, AdminStats } from '../api'
import type { getAdminRetention } from '../api'
import { formatAdminMoney } from './money'
import { formatDate } from './formatDate'

type RetentionStats = Awaited<ReturnType<typeof getAdminRetention>>

function Flag({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border-soft)] bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        <p className="text-xs font-bold">{label}</p>
      </div>
      {detail && <p className="text-[11px] admin-muted mt-1 break-all">{detail}</p>}
    </div>
  )
}

export function OverviewTab({
  stats,
  retention,
  remnawave,
  openAlerts,
  waitlistPending,
  servers,
  opsHealth,
  statusMessage,
  onStatusMessageChange,
  onSaveStatus,
  onMailTest,
  onBackupRun,
  actionBusy,
}: {
  stats: AdminStats | null
  retention: RetentionStats | null
  remnawave: AdminRemnawave | null
  openAlerts: number
  waitlistPending: number
  servers: AdminServer[]
  opsHealth: AdminOpsHealth | null
  statusMessage: string
  onStatusMessageChange: (value: string) => void
  onSaveStatus: (mode: AdminOpsHealth['statusOverride']['mode']) => void
  onMailTest: () => void
  onBackupRun: () => void
  actionBusy: string | null
}) {
  const money = formatAdminMoney
  const remnawaveNodesCount = remnawave?.nodes?.length ?? 0
  const flags = opsHealth?.flags
  const backup = opsHealth?.backup
  const mail = opsHealth?.mail
  const chrome = opsHealth?.chromeStore
  const statusMode = opsHealth?.statusOverride?.mode || 'auto'

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

      <div className="admin-card p-5 space-y-4">
        <div>
          <p className="font-bold">Инфраструктура</p>
          <p className="text-xs admin-muted mt-1">
            Proxy Manager, ключ шифрования, SMTP, оплата, Store. Локации расширения с hostname — во вкладке «Серверы».
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <Flag
            ok={Boolean(flags?.proxyManager) && flags?.proxyManagerReachable === 'ok'}
            label="Proxy Manager"
            detail={
              !flags?.proxyManager
                ? 'env не задан'
                : flags.proxyManagerReachable === 'ok'
                  ? 'reachable'
                  : flags.proxyManagerReachable === 'missing'
                    ? 'missing'
                    : 'не отвечает (туннель?)'
            }
          />
          <Flag ok={Boolean(flags?.proxyCredentialsKey)} label="PROXY_CREDENTIALS_KEY" detail={flags?.proxyCredentialsKey ? 'ok' : 'пустой'} />
          <Flag ok={Boolean(flags?.smtp)} label="SMTP" detail={mail?.from || '—'} />
          <Flag ok={Boolean(flags?.turnstile)} label="Turnstile" />
          <Flag ok={flags?.billingProvider === 'yookassa'} label="Оплата" detail={flags?.billingProvider || '—'} />
          <Flag
            ok={Boolean(flags?.chromeStoreLive)}
            label="Chrome Web Store"
            detail={chrome?.url || (chrome?.allowedExtensionIds?.length ? `IDs: ${chrome.allowedExtensionIds.join(', ')}` : 'не опубликован')}
          />
        </div>
        {opsHealth?.proxy && (
          <p className="text-xs admin-muted">
            HTTPS proxy: <span className="admin-mono">{opsHealth.proxy.publicHost}:{opsHealth.proxy.publicPort}</span>
            {' · '}
            в popup ON: {opsHealth.proxy.enabledExtensionServers}
            {opsHealth.proxy.servers.length > 0 && (
              <> ({opsHealth.proxy.servers.map((s) => s.name).join(', ')})</>
            )}
          </p>
        )}
      </div>

      <div className="admin-card p-5 space-y-3">
        <div>
          <p className="font-bold">Баннер статуса сайта</p>
          <p className="text-xs admin-muted mt-1">
            Ручной режим перекрывает авто-статус на лендинге /status и в кабинете. Сейчас: <span className="admin-mono">{statusMode}</span>
          </p>
        </div>
        <label className="block text-xs admin-muted">
          Сообщение (опционально)
          <input
            className="admin-input mt-1 w-full"
            value={statusMessage}
            onChange={(e) => onStatusMessageChange(e.target.value)}
            placeholder="Кратко: что происходит для пользователей"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['auto', 'Авто'],
              ['operational', 'Всё ок'],
              ['degraded', 'Деградация'],
              ['major_outage', 'Авария'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={actionBusy === `status-${mode}`}
              onClick={() => onSaveStatus(mode)}
              className={`admin-btn text-[11px] py-1.5 disabled:opacity-60 ${statusMode === mode ? 'admin-btn-accent' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="admin-card p-5 space-y-3">
          <p className="font-bold">Почта</p>
          <p className="text-xs admin-muted">
            OK: {mail?.sentOk ?? 0} · fail: {mail?.failed ?? 0} · log-only: {mail?.loggedDev ?? 0}
          </p>
          {mail?.lastOkAt && (
            <p className="text-[11px] admin-muted">Последняя OK: {formatDate(mail.lastOkAt)}{mail.lastTo ? ` → ${mail.lastTo}` : ''}</p>
          )}
          {mail?.lastError && (
            <p className="text-[11px] text-rose-300">Ошибка: {mail.lastError}{mail.lastFailAt ? ` · ${formatDate(mail.lastFailAt)}` : ''}</p>
          )}
          <button
            type="button"
            disabled={actionBusy === 'mail-test'}
            onClick={onMailTest}
            className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
          >
            Отправить тест себе
          </button>
        </div>

        <div className="admin-card p-5 space-y-3">
          <p className="font-bold">Бэкапы</p>
          <p className="text-xs admin-muted">
            {backup?.lastOkAt
              ? `Последний OK: ${formatDate(backup.lastOkAt)}`
              : 'Ещё нет stamp LAST_OK.json'}
          </p>
          {backup?.lastFile && (
            <p className="text-[11px] admin-mono break-all">{backup.lastFile}</p>
          )}
          {backup?.lastSizeBytes != null && (
            <p className="text-[11px] admin-muted">{(backup.lastSizeBytes / (1024 * 1024)).toFixed(1)} MB</p>
          )}
          {!backup?.scriptExists && (
            <p className="text-[11px] text-amber-200">Скрипт не найден: {backup?.scriptPath}</p>
          )}
          <button
            type="button"
            disabled={actionBusy === 'backup-run' || !backup?.scriptExists}
            onClick={onBackupRun}
            className="admin-btn text-[11px] py-1.5 disabled:opacity-60"
          >
            Запустить бэкап
          </button>
        </div>
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
        Remnawave нод: {remnawaveNodesCount}. В расширении можно включить несколько локаций с HTTPS hostname (не только RU) — вкладка «Серверы».
        Каталог Server DB: {servers.length}.
      </div>
    </div>
  )
}
