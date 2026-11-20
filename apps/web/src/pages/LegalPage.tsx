import { Link, Navigate, useParams } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'

const UPDATED_AT = '21 ноября 2026'

const CONTENT = {
  privacy: {
    seo: SEO_PAGES.privacy,
    title: 'Privacy Policy',
    body: [
      'Настоящая Политика описывает, какие данные обрабатывает SMOLIX при использовании сайта и расширения браузера.',
      'Для работы аккаунта мы обрабатываем email, хэш пароля, статус аккаунта и серверные сессии авторизации.',
      'Расширение хранит токен сессии локально в браузере. Credentials прокси сохраняются в session storage только на время активного подключения.',
      'Мы не продаём персональные данные третьим лицам. Технические логи сервера могут использоваться для безопасности, диагностики и предотвращения злоупотреблений.',
      'Вы можете запросить удаление аккаунта или уточнить состав обрабатываемых данных, написав на support@smolix.app.',
      'Используя SMOLIX, вы подтверждаете, что ознакомились с этой Политикой.',
    ],
  },
  terms: {
    seo: SEO_PAGES.terms,
    title: 'Terms of Service',
    body: [
      'Используя сайт и расширение SMOLIX, вы соглашаетесь соблюдать применимое законодательство и не использовать сервис для вредоносной, мошеннической или иной незаконной активности.',
      'Бесплатный режим YouTube и Premium могут изменяться по условиям подписки и доступности инфраструктуры.',
      'Сервис предоставляется «как есть». Доступность узлов, скорость и стабильность зависят от сети, браузера и внешних факторов.',
      'Мы можем ограничить доступ при нарушении условий, компрометации аккаунта или злоупотреблении ресурсами.',
      'По вопросам поддержки и условий использования: support@smolix.app.',
    ],
  },
} as const

export default function LegalPage() {
  const { doc } = useParams()
  if (doc !== 'privacy' && doc !== 'terms') {
    return <Navigate to="/legal/privacy" replace />
  }

  const page = CONTENT[doc]

  return (
    <div className="min-h-screen app-bg">
      <SeoHead {...page.seo} />
      <div className="section-shell py-8 md:py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 mb-8">
          <ArrowLeft size={16} /> На главную
        </Link>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.5px]">{page.title}</h1>
        </div>
        <p className="text-sm text-[var(--muted)] mb-6">Обновлено: {UPDATED_AT}</p>
        <div className="glass-card rounded-3xl p-6 md:p-8 space-y-4 text-sm text-[var(--muted)] leading-7">
          {page.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
