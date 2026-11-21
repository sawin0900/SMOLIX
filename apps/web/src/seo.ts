export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '')
  || 'https://jetsale.online'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export type SeoConfig = {
  title: string
  description: string
  path?: string
  image?: string
  noindex?: boolean
  type?: 'website' | 'article'
}

export function absoluteUrl(path = '/') {
  if (!path.startsWith('/')) return `${SITE_URL}/${path}`
  return `${SITE_URL}${path}`
}

export const SEO_PAGES = {
  home: {
    title: 'jetsale.online — YouTube бесплатно, весь интернет с Premium',
    description:
      'jetsale.online: расширение Chrome плюс приложения на Android, iPhone, ПК и Smart TV. YouTube бесплатно, полный интернет с Premium. Один аккаунт везде.',
    path: '/',
  },
  install: {
    title: 'Подключение jetsale.online — браузер, телефон и TV',
    description:
      'Как подключить jetsale.online: расширение Chrome в браузере и ссылка подписки на Android, iPhone, Windows, macOS и Android TV.',
    path: '/install',
  },
  privacy: {
    title: 'Политика конфиденциальности — jetsale.online',
    description: 'Политика конфиденциальности jetsale.online: какие данные обрабатываются для сайта и расширения.',
    path: '/policy',
  },
  terms: {
    title: 'Публичная оферта — jetsale.online',
    description: 'Публичная оферта jetsale.online: условия использования сайта, расширения и подписки Premium.',
    path: '/oferta',
  },
  auth: {
    title: 'Вход в jetsale.online',
    description: 'Войдите или создайте аккаунт jetsale.online для сайта, расширения Chrome и устройств.',
    path: '/auth',
    noindex: true,
  },
  app: {
    title: 'Кабинет jetsale.online',
    description: 'Кабинет jetsale.online: расширение, ссылка подписки, устройства и Premium.',
    path: '/app',
    noindex: true,
  },
  admin: {
    title: 'Админ-панель jetsale.online',
    description: 'Администрирование jetsale.online.',
    path: '/admin',
    noindex: true,
  },
  status: {
    title: 'Статус jetsale.online',
    description: 'Текущее состояние API, базы данных, VPN-панели и серверов jetsale.online.',
    path: '/status',
  },
} as const satisfies Record<string, SeoConfig>
