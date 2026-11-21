import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { getReferral } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { formatDate } from './format'
import { Skeleton } from './Skeleton'

export function ReferralView({
  onToast,
  locale,
}: {
  onToast: (message: string, type: 'success' | 'error') => void
  locale: Locale
}) {
  const t = CABINET_COPY[locale]
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
      .catch((err) => onToast(err instanceof Error ? err.message : t.referralLoadFailed, 'error'))
      .finally(() => setLoading(false))
  }, [onToast])

  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.inviteUrl)
      onToast(t.linkCopied, 'success')
    } catch {
      onToast(t.copyFailed, 'error')
    }
  }

  const statusLabel = (status?: string) => {
    if (status === 'PENDING') return t.referralPending
    if (status === 'REJECTED') return t.referralRejected
    return t.referralGranted
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
