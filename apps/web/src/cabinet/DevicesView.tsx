import { useState } from 'react'
import { MonitorSmartphone } from 'lucide-react'
import type { AccountDevice, SubscriptionResponse } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { formatDate } from './format'
import { Skeleton } from './Skeleton'
import { TrialBanner } from './shared'

export function DevicesView({
  devices,
  loading,
  subscription,
  deviceLimit,
  onRevoke,
  onRevokeOne,
  locale,
}: {
  devices: AccountDevice[]
  loading: boolean
  locale: Locale
  subscription: SubscriptionResponse['subscription']
  deviceLimit: number
  onRevoke: () => Promise<void>
  onRevokeOne: (deviceId: string) => Promise<void>
}) {
  const t = CABINET_COPY[locale]
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const overLimit = devices.length > deviceLimit

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">Безопасность</p>
      <h1 className="text-3xl font-bold tracking-normal">{t.navDevices}</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-3">Активные сессии расширения jetsale.online.</p>
      <TrialBanner subscription={subscription} />
      <p className={`text-sm font-semibold mb-8 ${overLimit ? 'text-rose-600' : 'text-[var(--muted)]'}`}>
        Используется {devices.length} из {deviceLimit}
        {overLimit ? ' — лимит превышен, отключите лишние устройства' : ''}
      </p>

      <div className="glass-card rounded-2xl overflow-hidden max-w-3xl">
        {loading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center">
            <MonitorSmartphone className="mx-auto text-teal-600 mb-3" size={28} />
            <p className="font-bold">Нет активных устройств</p>
            <p className="text-sm text-[var(--muted)] mt-1">Войдите в расширение — сессия появится здесь.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {devices.map((device) => (
              <div key={device.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{device.deviceName}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {device.deviceId || device.id.slice(0, 8)} · last {formatDate(device.lastUsedAt || device.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 w-fit">
                    до {formatDate(device.expiresAt)}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === device.id}
                    onClick={async () => {
                      setBusyId(device.id)
                      try {
                        await onRevokeOne(device.id)
                      } finally {
                        setBusyId(null)
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {busyId === device.id ? '…' : t.revokeDevice}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {devices.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRevoke()
            } finally {
              setBusy(false)
            }
          }}
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-bold hover:bg-rose-100 transition disabled:opacity-60"
        >
          {busy ? t.revoking : t.revokeAllDevices}
        </button>
      )}
    </>
  )
}
