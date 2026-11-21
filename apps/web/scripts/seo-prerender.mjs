import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const siteUrl = (process.env.VITE_SITE_URL || 'https://smolix.app').replace(/\/+$/, '')

const routes = [
  {
    file: 'index.html',
    path: '/',
    title: 'SMOLIX — YouTube бесплатно, весь интернет с Premium',
    description:
      'SMOLIX — защищённый доступ в браузере. YouTube бесплатно, полный интернет с Premium. Один аккаунт для сайта и расширения Chrome.',
    noscript: `
      <h1>SMOLIX — YouTube бесплатно, весь интернет с Premium</h1>
      <p>Защищённый доступ прямо в браузере. Создайте аккаунт, установите расширение и выберите режим.</p>
      <ul>
        <li><a href="/install">Установка расширения</a></li>
        <li><a href="/auth">Войти</a></li>
        <li><a href="/legal/privacy">Privacy</a></li>
        <li><a href="/legal/terms">Terms</a></li>
      </ul>
    `,
  },
  {
    file: path.join('install', 'index.html'),
    path: '/install',
    title: 'Установка SMOLIX VPN для Chrome',
    description:
      'Как установить расширение SMOLIX VPN в Chrome: создать аккаунт, загрузить unpacked extension и подключиться за минуту.',
    noscript: `
      <h1>Установка SMOLIX VPN для Chrome</h1>
      <ol>
        <li>Создайте аккаунт SMOLIX</li>
        <li>Откройте chrome://extensions</li>
        <li>Загрузите папку apps/extension</li>
        <li>Войдите и подключитесь</li>
      </ol>
      <p><a href="/">На главную</a></p>
    `,
  },
  {
    file: path.join('policy', 'index.html'),
    path: '/policy',
    title: 'Политика конфиденциальности — SMOLIX',
    description: 'Политика конфиденциальности SMOLIX: какие данные обрабатываются для сайта и расширения.',
    noscript: `<h1>Политика конфиденциальности — SMOLIX</h1><p>Политика конфиденциальности сервиса SMOLIX.</p><p><a href="/">На главную</a></p>`,
  },
  {
    file: path.join('oferta', 'index.html'),
    path: '/oferta',
    title: 'Публичная оферта — SMOLIX',
    description: 'Публичная оферта SMOLIX: условия использования сайта, расширения и подписки Premium.',
    noscript: `<h1>Публичная оферта — SMOLIX</h1><p>Условия использования сервиса SMOLIX.</p><p><a href="/">На главную</a></p>`,
  },
]

function applyMeta(html, route) {
  const url = `${siteUrl}${route.path === '/' ? '/' : route.path}`
  const image = `${siteUrl}/og-image.png`

  let next = html
  next = next.replace(/<title>[\s\S]*?<\/title>/, `<title>${route.title}</title>`)
  next = next.replace(
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${route.description}" />`,
  )
  next = next.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
  )
  next = next.replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${route.title}"`)
  next = next.replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${route.description}"`)
  next = next.replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${url}"`)
  next = next.replace(/property="og:image" content="[^"]*"/, `property="og:image" content="${image}"`)
  next = next.replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${route.title}"`)
  next = next.replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${route.description}"`)
  next = next.replace(/name="twitter:image" content="[^"]*"/, `name="twitter:image" content="${image}"`)

  if (!next.includes('<noscript id="seo-fallback">')) {
    next = next.replace(
      '<div id="root"></div>',
      `<div id="root"></div>\n    <noscript id="seo-fallback">${route.noscript}</noscript>`,
    )
  } else {
    next = next.replace(
      /<noscript id="seo-fallback">[\s\S]*?<\/noscript>/,
      `<noscript id="seo-fallback">${route.noscript}</noscript>`,
    )
  }

  return next
}

const template = await readFile(path.join(distDir, 'index.html'), 'utf8')

for (const route of routes) {
  const target = path.join(distDir, route.file)
  await mkdir(path.dirname(target), { recursive: true })
  const html = applyMeta(template, route)
  await writeFile(target, html, 'utf8')
  console.log(`seo-prerender: ${route.path} -> ${route.file}`)
}
