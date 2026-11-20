import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowLeft, RefreshCw, Server, ShieldCheck } from 'lucide-react'
import { getPublicStatus, type PublicStatus } from '../api'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'

function statusLabel(status: PublicStatus['status']) {
  if (status === 'operational') return 'Все системы работают'
  if (status === 'degraded') return 'Частичные сбои'
  return 'Критический сбой'
}

function tone(status: string) {
  if (status === 'ok' || status === 'operational') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (status === 'degraded') return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-rose-50 text-rose-700 border-rose-100'
}

export default function StatusPage() {
  const [data, setData] = useState<PublicStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getPublicStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить статус')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = window.setInterval(load, 30000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen app-bg">
      <SeoHead {...SEO_PAGES.status} />
      <header className="section-shell py-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800">
          <ArrowLeft size={16} /> На главную
        </Link>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      <main className="section-shell pb-20 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center">
            <Activity className="text-white" size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-teal-700">Статус</p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px]">SMOLIX Status</h1>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className={`rounded-3xl border px-5 py-6 ${tone(data.status)}`}>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">Текущее состояние</p>
              <p className="text-2xl font-extrabold mt-2">{statusLabel(data.status)}</p>
              <p className="text-sm mt-2 opacity-80">
                Проверено {new Date(data.checkedAt).toLocaleString('ru-RU')} · {data.latencyMs} мс
              </p>
              {data.status === 'major_outage' && (
                <p className="text-sm mt-3 font-semibold">
                  Если проблема не уходит — напишите в поддержку с вашего email аккаунта.
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-3">
              {data.components.map((item) => (
                <div key={item.id} className="glass-card rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-teal-700" />
                    <div>
                      <p className="font-bold text-sm">{item.name}</p>
                      {item.meta?.provider != null && (
                        <p className="text-xs text-[var(--muted)] mt-1">provider: {String(item.meta.provider)}</p>
                      )}
                      {item.meta?.nodesCount != null && (
                        <p className="text-xs text-[var(--muted)] mt-1">nodes: {String(item.meta.nodesCount)}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${tone(item.status)}`}>
                    {item.status === 'ok' ? 'OK' : 'ERROR'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-extrabold mb-3 flex items-center gap-2">
                <Server size={18} /> Серверы
              </h2>
              <div className="glass-card rounded-2xl overflow-hidden">
                {data.servers.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-[var(--muted)]">Серверы пока не опубликованы</p>
                ) : (
                  data.servers.map((server) => (
                    <div key={server.id} className="px-5 py-4 border-b border-[var(--border)] last:border-0 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{server.name}</p>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          {server.country}{server.city ? `, ${server.city}` : ''}
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${tone(server.status)}`}>
                        {server.status === 'ok' ? 'ONLINE' : 'OFF'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
