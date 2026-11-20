export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '')
  || 'https://smolix.app'

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
    title: 'SMOLIX — YouTube бесплатно, весь интернет с Premium',
    description:
      'SMOLIX: расширение Chrome плюс приложения на Android, iPhone, ПК и Smart TV. YouTube бесплатно, полный интернет с Premium. Один аккаунт везде.',
    path: '/',
  },
  install: {
    title: 'Подключение SMOLIX — браузер, телефон и TV',
    description:
      'Как подключить SMOLIX: расширение Chrome в браузере и ссылка подписки на Android, iPhone, Windows, macOS и Android TV.',
    path: '/install',
  },
  privacy: {
    title: 'Privacy Policy — SMOLIX',
    description: 'Политика конфиденциальности SMOLIX: какие данные обрабатываются для сайта и расширения.',
    path: '/legal/privacy',
  },
  terms: {
    title: 'Terms of Service — SMOLIX',
    description: 'Условия использования сервиса SMOLIX: сайт, расширение и подписка Premium.',
    path: '/legal/terms',
  },
  auth: {
    title: 'Вход в SMOLIX',
    description: 'Войдите или создайте аккаунт SMOLIX для сайта, расширения Chrome и устройств.',
    path: '/auth',
    noindex: true,
  },
  app: {
    title: 'Кабинет SMOLIX',
    description: 'Кабинет SMOLIX: расширение, ссылка подписки, устройства и Premium.',
    path: '/app',
    noindex: true,
  },
  admin: {
    title: 'Админ-панель SMOLIX',
    description: 'Администрирование SMOLIX.',
    path: '/admin',
    noindex: true,
  },
  status: {
    title: 'Статус SMOLIX',
    description: 'Текущее состояние API, базы данных, VPN-панели и серверов SMOLIX.',
    path: '/status',
  },
} as const satisfies Record<string, SeoConfig>
