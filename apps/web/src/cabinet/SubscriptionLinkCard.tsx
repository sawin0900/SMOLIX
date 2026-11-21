import { useState } from 'react'
import { Copy, ExternalLink, QrCode, RefreshCw, Smartphone } from 'lucide-react'
import { refreshVpnSubscription, type VpnAccountInfo } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { qrUrl } from './format'

export function SubscriptionLinkCard({
  vpnAccount,
  onVpnUpdated,
  onToast,
  compact = false,
  locale,
}: {
  vpnAccount: VpnAccountInfo | null
  locale: Locale
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
  compact?: boolean
}) {
  const t = CABINET_COPY[locale]
  const [busy, setBusy] = useState(false)
  const url = vpnAccount?.subscriptionUrl || null

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      onToast(t.linkCopied, 'success')
    } catch {
      onToast(t.copyFailed, 'error')
    }
  }

  const refresh = async () => {
    setBusy(true)
    try {
      const result = await refreshVpnSubscription()
      onVpnUpdated(result.vpnAccount)
      onToast(result.message, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t.refreshLinkFailed, 'error')
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
