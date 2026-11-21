import type { AccountResponse, SubscriptionResponse, VpnAccountInfo } from '../api'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { TrialBanner } from './shared'
import { SubscriptionLinkCard } from './SubscriptionLinkCard'

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
  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">{t.devices}</p>
      <h1 className="text-3xl font-bold tracking-normal">{t.navVpn}</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8 max-w-2xl">
        Персональная подписка Remnawave. Работает на компьютере и телефоне: откройте ссылку —
        там установка клиента и кнопка «Добавить подписку».
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

      <div className="grid md:grid-cols-2 gap-5 mt-5 max-w-3xl">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold mb-3">Компьютер (Windows / macOS / Linux)</h3>
          <ol className="space-y-2 text-sm text-[var(--muted)] list-decimal pl-5">
            <li>Откройте ссылку подписки в браузере</li>
            <li>Выберите ОС и клиент: FlClashX, Koala Clash или Prizrak-Box</li>
            <li>Скачайте установщик и установите приложение</li>
            <li>Нажмите «Добавить подписку» (или вставьте URL вручную в Profiles → + → URL)</li>
            <li>Обновите профиль и подключитесь</li>
          </ol>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold mb-3">Телефон и TV</h3>
          <ol className="space-y-2 text-sm text-[var(--muted)] list-decimal pl-5">
            <li>Отсканируйте QR или откройте ту же ссылку</li>
            <li>Android / iOS / Android TV / Apple TV — клиент со страницы подписки</li>
            <li>Либо Happ / v2rayNG / Streisand / Shadowrocket → импорт по URL</li>
            <li>Обновите список серверов и подключитесь</li>
          </ol>
        </div>
      </div>
    </>
  )
}
