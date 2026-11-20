import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Download, ShieldCheck, Check, Store, Puzzle, Smartphone } from 'lucide-react'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES, SITE_URL } from '../seo'
import { CHROME_STORE_URL, IS_CHROME_STORE_LIVE } from '../config'
import { getAccount, refreshVpnSubscription, type VpnAccountInfo } from '../api'

const BROWSER_STEPS = [
  {
    title: 'Создайте аккаунт SMOLIX',
    text: 'Один email для сайта, расширения и приложений.',
  },
  {
    title: IS_CHROME_STORE_LIVE ? 'Установите из Chrome Web Store' : 'Откройте chrome://extensions',
    text: IS_CHROME_STORE_LIVE
      ? 'Одной кнопкой из магазина, затем войдите тем же аккаунтом.'
      : 'Включите «Режим разработчика» и загрузите unpacked из apps/extension.',
  },
  {
    title: 'Войдите в popup',
    text: 'Тот же email. Режим YouTube работает бесплатно.',
  },
]

const DEVICE_STEPS = [
  {
    title: 'Откройте кабинет → VPN-ссылка',
    text: 'Скопируйте ссылку подписки или отсканируйте QR.',
  },
  {
    title: 'Поставьте клиент',
    text: 'FlClashX / Koala Clash / Prizrak-Box на телефоне, ПК или Android TV.',
  },
  {
    title: 'Добавьте подписку',
    text: 'Вставьте ссылку или откройте со страницы установки — подключитесь.',
  },
]

export default function InstallPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [vpnAccount, setVpnAccount] = useState<VpnAccountInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getAccount()
      .then((data) => {
        setLoggedIn(true)
        setVpnAccount(data.vpnAccount)
      })
      .catch(() => {
        setLoggedIn(false)
        setVpnAccount(null)
      })
  }, [])

  const ensureLink = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await refreshVpnSubscription()
      setVpnAccount(result.vpnAccount)
      setMessage(result.message)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось получить ссылку')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    const url = vpnAccount?.subscriptionUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Ссылка скопирована')
    } catch {
      setMessage('Не удалось скопировать')
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Подключение SMOLIX — браузер и устройства',
    description: SEO_PAGES.install.description,
    totalTime: 'PT5M',
    step: [...BROWSER_STEPS, ...DEVICE_STEPS].map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.text,
      url: `${SITE_URL}/install#step-${index + 1}`,
    })),
  }

  return (
    <div className="min-h-screen app-bg">
      <SeoHead {...SEO_PAGES.install} jsonLd={jsonLd} />

      <header className="section-shell py-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800">
          <ArrowLeft size={16} /> На главную
        </Link>
        <Link
          to={loggedIn ? '/app' : '/auth?mode=register'}
          className="inline-flex items-center gap-2 rounded-full brand-gradient text-white px-4 py-2.5 text-sm font-bold"
        >
          {loggedIn ? 'В кабинет' : 'Создать аккаунт'} <ArrowRight size={16} />
        </Link>
      </header>

      <main className="section-shell pb-20 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center">
            <ShieldCheck className="text-white" size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-teal-700">Подключение</p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px]">Браузер и устройства</h1>
          </div>
        </div>

        <p className="text-[var(--muted)] leading-7 max-w-2xl">
          Один аккаунт SMOLIX: расширение Chrome для вкладок и ссылка подписки для телефона, ПК, iPhone и Smart TV.
        </p>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <section className="glass-card rounded-3xl p-6">
            <p className="text-xs font-extrabold tracking-wide text-teal-700 uppercase flex items-center gap-2">
              <Puzzle size={14} /> В браузере
            </p>
            <h2 className="text-xl font-extrabold mt-3">Расширение Chrome</h2>
            <ol className="mt-5 space-y-3">
              {BROWSER_STEPS.map((step, index) => (
                <li key={step.title} id={`step-${index + 1}`} className="text-sm">
                  <p className="font-bold">{index + 1}. {step.title}</p>
                  <p className="text-[var(--muted)] mt-1 leading-6">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-2">
              {IS_CHROME_STORE_LIVE ? (
                <a
                  href={CHROME_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient text-white px-4 py-3 text-sm font-bold"
                >
                  <Store size={16} /> Chrome Web Store
                </a>
              ) : (
                <a
                  href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient text-white px-4 py-3 text-sm font-bold"
                >
                  <Download size={16} /> Как загрузить unpacked
                </a>
              )}
            </div>
          </section>

          <section className="glass-card rounded-3xl p-6">
            <p className="text-xs font-extrabold tracking-wide text-teal-700 uppercase flex items-center gap-2">
              <Smartphone size={14} /> На устройстве
            </p>
            <h2 className="text-xl font-extrabold mt-3">Телефон · ПК · TV</h2>
            <ol className="mt-5 space-y-3">
              {DEVICE_STEPS.map((step, index) => (
                <li key={step.title} id={`step-${index + 4}`} className="text-sm">
                  <p className="font-bold">{index + 1}. {step.title}</p>
                  <p className="text-[var(--muted)] mt-1 leading-6">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-2">
              {loggedIn ? (
                <>
                  <Link
                    to="/app/vpn"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient text-white px-4 py-3 text-sm font-bold"
                  >
                    Открыть VPN-ссылку <ArrowRight size={16} />
                  </Link>
                  {vpnAccount?.subscriptionUrl ? (
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold"
                    >
                      Копировать ссылку
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={ensureLink}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"
                    >
                      {busy ? 'Создаём…' : 'Получить ссылку'}
                    </button>
                  )}
                </>
              ) : (
                <Link
                  to="/auth?mode=register&next=/app/vpn"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient text-white px-4 py-3 text-sm font-bold"
                >
                  Сначала аккаунт <ArrowRight size={16} />
                </Link>
              )}
            </div>
            {message && <p className="text-xs text-teal-800 mt-3">{message}</p>}
            {vpnAccount?.subscriptionUrl && (
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--canvas-band)]/50 p-4 flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=6&data=${encodeURIComponent(vpnAccount.subscriptionUrl)}`}
                  alt="QR подписки SMOLIX"
                  width={140}
                  height={140}
                  className="rounded-xl bg-white p-2"
                />
                <div className="text-sm text-center sm:text-left">
                  <p className="font-bold">QR для телефона / TV</p>
                  <p className="text-[var(--muted)] mt-1 leading-6">
                    Отсканируйте камерой или в клиенте Clash / Happ / v2rayNG.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 glass-card rounded-2xl p-5">
          <p className="font-bold mb-3">Проверьте после подключения</p>
          <ul className="space-y-2 text-sm text-[var(--muted)]">
            {[
              'В Chrome есть иконка SMOLIX и вход тем же email',
              'YouTube в расширении работает без Premium',
              'На телефоне/TV клиент видит вашу подписку',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check size={16} className="text-teal-700" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
