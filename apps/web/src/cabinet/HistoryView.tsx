import { Link } from 'react-router-dom'
import { Download, History } from 'lucide-react'
import type { ConnectionHistoryItem } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { formatDate } from './format'
import { Skeleton } from './Skeleton'

export function HistoryView({
  history,
  loading,
  locale,
}: {
  history: ConnectionHistoryItem[]
  loading: boolean
  locale: Locale
}) {
  const t = CABINET_COPY[locale]
  const durationLabel = (item: ConnectionHistoryItem) => {
    if (!item.endedAt) return item.status === 'CONNECTED' ? t.historyNow : null
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
      <h1 className="text-3xl font-bold tracking-normal">{t.navHistory}</h1>
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
                      {item.status === 'CONNECTED' ? t.histConnected : item.status === 'FAILED' ? t.histFailed : t.histDisconnected}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {item.mode === 'youtube' ? t.modeYoutube : t.modeFull}
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
