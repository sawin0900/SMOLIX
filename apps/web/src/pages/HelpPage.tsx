import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Puzzle, Smartphone, AlertCircle } from 'lucide-react'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES, SITE_URL } from '../seo'
import { SUPPORT_EMAIL } from '../brand'

const FAQ = [
  {
    q: 'Как установить расширение?',
    a: 'Откройте /install → скачайте ZIP → chrome://extensions → «Режим разработчика» → «Загрузить распакованное». Затем войдите тем же email, что в кабинете.',
  },
  {
    q: 'YouTube бесплатно — а остальной интернет?',
    a: 'Режим YouTube в расширении бесплатный. Полный интернет (режим Premium / trial) — на всех устройствах по ссылке подписки и в расширении.',
  },
  {
    q: 'Как подключить телефон?',
    a: 'Кабинет → VPN-ссылка → Android / iPhone / Windows → скачайте клиент → Profiles → Import from URL → вставьте ссылку или отсканируйте QR.',
  },
  {
    q: 'Не приходит письмо?',
    a: 'Проверьте «Спам» и «Промоакции». Письма идут с info@jetsale.online. Если пусто — напишите нам, проверим доставку.',
  },
]

const EXT_ERRORS = [
  {
    title: 'Нет сети / API недоступен',
    text: 'Проверьте интернет. В popup не нужен localhost — расширение ходит на https://jetsale.online/api. Обновите ZIP с /install, если стоит старая сборка.',
  },
  {
    title: 'Trial / подписка закончились',
    text: 'Режим YouTube остаётся бесплатным. Для «Весь интернет» откройте кабинет → Premium / Продлить.',
  },
  {
    title: 'Сессия истекла',
    text: 'Выйдите и войдите снова тем же email. Если не помогает — завершите другие сессии в Настройках кабинета.',
  },
  {
    title: 'Локация не подключается',
    text: 'Выберите YouTube или Premium и нажмите «Подключить». Для телефона используйте ссылку подписки, не Chrome-прокси.',
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SeoHead {...SEO_PAGES.help} />
      <div className="section-shell py-8 md:py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-800 mb-8">
          <ArrowLeft size={16} /> На главную
        </Link>

        <p className="text-sm font-bold text-teal-700 mb-2">Поддержка</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Помощь</h1>
        <p className="mt-3 text-[var(--muted)] leading-7">
          Короткие ответы по кабинету и расширению. Если не нашли своё — напишите на{' '}
          <a className="font-bold text-teal-800" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>

        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=jetsale.online%20помощь`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-5 py-3 text-sm font-bold"
        >
          <Mail size={16} /> Написать в поддержку
        </a>

        <section className="mt-12">
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Puzzle size={20} className="text-teal-700" /> FAQ
          </h2>
          <div className="mt-5 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="glass-card rounded-2xl px-5 py-4 group">
                <summary className="font-bold cursor-pointer list-none flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-teal-700 group-open:rotate-45 transition text-lg leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-[var(--muted)] leading-6">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-700" /> Частые ошибки расширения
          </h2>
          <div className="mt-5 space-y-3">
            {EXT_ERRORS.map((item) => (
              <div key={item.title} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4">
                <p className="font-bold">{item.title}</p>
                <p className="text-sm text-[var(--muted)] mt-1 leading-6">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 glass-card rounded-2xl p-5">
          <h2 className="font-extrabold flex items-center gap-2">
            <Smartphone size={18} className="text-teal-700" /> Быстрые ссылки
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/install" className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
              Установка
            </Link>
            <Link to="/app" className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
              Кабинет
            </Link>
            <Link to="/app/vpn" className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
              VPN на телефон
            </Link>
            <Link to="/status" className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
              Статус сервиса
            </Link>
            <a href={`${SITE_URL}/downloads/jetsale-chrome.zip`} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
              Скачать ZIP
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
