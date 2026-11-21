import { useState } from 'react'
import { ExternalLink, Smartphone } from 'lucide-react'
import type { AccountResponse, SubscriptionResponse, VpnAccountInfo } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { TrialBanner } from './shared'
import { SubscriptionLinkCard } from './SubscriptionLinkCard'

const CLIENTS = {
  android: [
    { name: 'FlClashX', url: 'https://github.com/pluralplay/FlClashX/releases' },
    { name: 'v2rayNG', url: 'https://github.com/2dust/v2rayNG/releases' },
    { name: 'Happ', url: 'https://play.google.com/store/apps/details?id=com.happproxy' },
  ],
  ios: [
    { name: 'Streisand', url: 'https://apps.apple.com/app/streisand/id6450534064' },
    { name: 'Shadowrocket', url: 'https://apps.apple.com/app/shadowrocket/id932747118' },
    { name: 'Happ', url: 'https://apps.apple.com/app/happ-proxy-utility/id6504287215' },
  ],
  windows: [
    { name: 'FlClashX', url: 'https://github.com/pluralplay/FlClashX/releases' },
    { name: 'Koala Clash', url: 'https://github.com/coolcoala/clash-verge-rev-koala/releases' },
    { name: 'Prizrak-Box', url: 'https://github.com/legiz-ru/Prizrak-Box/releases' },
  ],
} as const

type OsKey = keyof typeof CLIENTS

export function VpnLinkView({
  vpnAccount,
  subscription,
  onVpnUpdated,
  onToast,
  locale,
}: {
  vpnAccount: AccountResponse['vpnAccount']
  subscription: SubscriptionResponse['subscription']
  locale: Locale
  onVpnUpdated: (value: VpnAccountInfo | null) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const t = CABINET_COPY[locale]
  const [os, setOs] = useState<OsKey>('android')
  const labels: Record<OsKey, string> = {
    android: t.devicesOsAndroid,
    ios: t.devicesOsIos,
    windows: t.devicesOsWindows,
  }

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">{t.devices}</p>
      <h1 className="text-3xl font-bold tracking-normal">{t.navVpn}</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8 max-w-2xl">
        {locale === 'ru'
          ? 'Ссылка подписки для телефона, ПК и TV. Выберите платформу — скачайте клиент и вставьте ссылку.'
          : 'Subscription link for phone, PC, and TV. Pick a platform — install a client and paste the link.'}
      </p>
      <div className="max-w-3xl">
        <TrialBanner subscription={subscription} />
        <SubscriptionLinkCard
          locale={locale}
          vpnAccount={vpnAccount}
          onVpnUpdated={onVpnUpdated}
          onToast={onToast}
        />
      </div>

      <div className="max-w-3xl mt-6 glass-card rounded-2xl p-5">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CLIENTS) as OsKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setOs(key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition ${
                os === key
                  ? 'brand-gradient text-white border-transparent'
                  : 'bg-white border-[var(--border)] text-[var(--ink)]'
              }`}
            >
              {labels[key]}
            </button>
          ))}
        </div>

        <div className="mt-5 grid sm:grid-cols-3 gap-3">
          {CLIENTS[os].map((client) => (
            <a
              key={client.name}
              href={client.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold flex items-center justify-between gap-2 hover:border-teal-300 transition"
            >
              {client.name}
              <ExternalLink size={14} className="text-teal-700 shrink-0" />
            </a>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-4">
          <p className="font-bold text-sm flex items-center gap-2">
            <Smartphone size={16} className="text-teal-800" /> {t.devicesOsHow}
          </p>
          <ol className="mt-3 space-y-2 text-sm text-[var(--muted)] list-decimal pl-5">
            <li>{locale === 'ru' ? 'Скопируйте ссылку подписки выше (или QR).' : 'Copy the subscription link above (or use QR).'}</li>
            <li>{locale === 'ru' ? 'Установите клиент для вашей ОС.' : 'Install a client for your OS.'}</li>
            <li>
              {locale === 'ru'
                ? 'В клиенте: Profiles / Подписки → «+» / Import from URL → вставьте ссылку → обновите → Connect.'
                : 'In the client: Profiles / Subscriptions → “+” / Import from URL → paste → update → Connect.'}
            </li>
          </ol>
        </div>
      </div>
    </>
  )
}
