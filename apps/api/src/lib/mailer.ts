import nodemailer from 'nodemailer'

type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

type MailContent = {
  subject: string
  text: string
  html: string
}

const fromAddress = process.env.MAIL_FROM || 'jetsale.online <info@jetsale.online>'
const BRAND = {
  name: 'jetsale.online',
  teal: '#0f766e',
  tealDark: '#0d5c56',
  tealSoft: '#ccfbf1',
  ink: '#0f172a',
  muted: '#64748b',
  canvas: '#eef3f5',
  white: '#ffffff',
  support: 'info@jetsale.online',
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function createTransport() {
  if (!hasSmtpConfig()) return null

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function button(href: string, label: string) {
  return `
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.teal} 0%,${BRAND.tealDark} 100%);color:${BRAND.white};text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:14px 22px;border-radius:14px;box-shadow:0 10px 24px rgba(15,118,110,0.28);">
      ${escapeHtml(label)}
    </a>`
}

function emailShell(options: {
  preheader: string
  title: string
  bodyHtml: string
  siteUrl: string
}) {
  const site = options.siteUrl.replace(/\/+$/, '')
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.canvas};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${BRAND.white};border-radius:24px;overflow:hidden;border:1px solid #dbe4ea;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.teal} 0%,${BRAND.tealDark} 100%);padding:28px 28px 24px;">
              <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.78);font-weight:700;">Защищённый доступ</div>
              <div style="margin-top:10px;font-size:26px;line-height:1.15;font-weight:800;color:${BRAND.white};letter-spacing:-0.03em;">${BRAND.name}</div>
              <div style="margin-top:8px;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.9);">YouTube бесплатно · полный интернет с Premium</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <div style="height:1px;background:#e2e8f0;margin:8px 0 18px;"></div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};">
                Вопросы: <a href="mailto:${BRAND.support}" style="color:${BRAND.teal};text-decoration:none;font-weight:600;">${BRAND.support}</a><br/>
                <a href="${site}" style="color:${BRAND.teal};text-decoration:none;">${BRAND.name}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const mailStats = {
  sentOk: 0,
  failed: 0,
  loggedDev: 0,
  lastError: null as string | null,
  lastOkAt: null as string | null,
  lastFailAt: null as string | null,
  lastTo: null as string | null,
}

export function getMailStats() {
  return {
    smtpConfigured: hasSmtpConfig(),
    from: fromAddress,
    ...mailStats,
  }
}

export async function sendMail(input: SendMailInput) {
  const transport = createTransport()

  if (!transport) {
    console.info('[mailer:dev]', {
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
    })
    mailStats.loggedDev += 1
    mailStats.lastTo = input.to
    mailStats.lastOkAt = new Date().toISOString()
    return { delivered: false, mode: 'log' as const }
  }

  try {
    await transport.sendMail({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html || `<pre style="font-family:inherit;white-space:pre-wrap;">${escapeHtml(input.text)}</pre>`,
    })
    mailStats.sentOk += 1
    mailStats.lastError = null
    mailStats.lastTo = input.to
    mailStats.lastOkAt = new Date().toISOString()
    return { delivered: true, mode: 'smtp' as const }
  } catch (err) {
    mailStats.failed += 1
    mailStats.lastFailAt = new Date().toISOString()
    mailStats.lastTo = input.to
    mailStats.lastError = err instanceof Error ? err.message : String(err)
    throw err
  }
}

export function premiumLaunchEmail(siteUrl: string): MailContent {
  const site = siteUrl.replace(/\/+$/, '')
  const subject = 'jetsale.online Premium уже доступен'
  const text = [
    'Привет!',
    '',
    'Вы были в waitlist jetsale.online Premium — оплата и полный доступ уже подключены.',
    '',
    `Открыть кабинет: ${site}/app/subscription`,
    '',
    'Команда jetsale.online',
  ].join('\n')

  const html = emailShell({
    siteUrl: site,
    preheader: 'Premium уже доступен — откройте кабинет',
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.03em;color:${BRAND.ink};">Premium уже доступен</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${BRAND.muted};">
        Вы были в waitlist — оплата и полный доступ уже подключены.
      </p>
      <div style="margin:22px 0 8px;">${button(`${site}/app/subscription`, 'Открыть подписку')}</div>
    `,
  })

  return { subject, text, html }
}

export function welcomeEmail(siteUrl: string): MailContent {
  const site = siteUrl.replace(/\/+$/, '')
  const subject = 'Добро пожаловать в jetsale.online'
  const text = [
    'Здравствуйте!',
    '',
    'Аккаунт jetsale.online создан. Вам доступен пробный период Premium.',
    '',
    `Кабинет: ${site}/app`,
    `Установка расширения: ${site}/install`,
    `Подписка: ${site}/app/subscription`,
    '',
    'Если возникнут вопросы — напишите на info@jetsale.online',
    '',
    'Команда jetsale.online',
  ].join('\n')

  const html = emailShell({
    siteUrl: site,
    preheader: 'Аккаунт создан — пробный Premium уже активен',
    title: subject,
    bodyHtml: `
      <div style="display:inline-block;background:${BRAND.tealSoft};color:${BRAND.tealDark};font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:6px 10px;border-radius:999px;margin-bottom:14px;">
        Пробный Premium
      </div>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;letter-spacing:-0.04em;color:${BRAND.ink};">Добро пожаловать</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.muted};">
        Аккаунт <strong style="color:${BRAND.ink};">${BRAND.name}</strong> создан.
        Вам уже доступен пробный период Premium — один вход для сайта, расширения Chrome и устройств.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;background:${BRAND.canvas};border-radius:16px;">
        <tr>
          <td style="padding:16px 18px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.ink};">Что дальше</p>
            <ol style="margin:0;padding-left:18px;color:${BRAND.muted};font-size:14px;line-height:1.7;">
              <li>Откройте кабинет и проверьте статус</li>
              <li>Установите расширение Chrome</li>
              <li>При необходимости подключите телефон / TV по ссылке</li>
            </ol>
          </td>
        </tr>
      </table>
      <div style="margin:8px 0 12px;">${button(`${site}/app`, 'Открыть кабинет')}</div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:${BRAND.muted};">
        <a href="${site}/install" style="color:${BRAND.teal};font-weight:700;text-decoration:none;">Установка расширения</a>
        &nbsp;·&nbsp;
        <a href="${site}/app/subscription" style="color:${BRAND.teal};font-weight:700;text-decoration:none;">Подписка</a>
      </p>
    `,
  })

  return { subject, text, html }
}

export function passwordResetEmail(resetUrl: string): MailContent {
  const subject = 'Сброс пароля jetsale.online'
  const text = [
    'Вы запросили сброс пароля jetsale.online.',
    '',
    `Перейдите по ссылке (действует ограниченное время):`,
    resetUrl,
    '',
    'Если это были не вы — просто игнорируйте письмо.',
  ].join('\n')

  const site = (process.env.WEB_APP_URL || 'https://jetsale.online').replace(/\/+$/, '')
  const html = emailShell({
    siteUrl: site,
    preheader: 'Ссылка для сброса пароля',
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.03em;color:${BRAND.ink};">Сброс пароля</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${BRAND.muted};">
        Вы запросили сброс пароля. Ссылка действует ограниченное время.
      </p>
      <div style="margin:22px 0 12px;">${button(resetUrl, 'Задать новый пароль')}</div>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};">Если это были не вы — просто проигнорируйте письмо.</p>
    `,
  })

  return { subject, text, html }
}

export function emailVerificationEmail(verifyUrl: string): MailContent {
  const subject = 'Подтвердите email jetsale.online'
  const text = [
    'Подтвердите адрес электронной почты для jetsale.online.',
    '',
    verifyUrl,
    '',
    'Если вы не регистрировались — игнорируйте письмо.',
  ].join('\n')

  const site = (process.env.WEB_APP_URL || 'https://jetsale.online').replace(/\/+$/, '')
  const html = emailShell({
    siteUrl: site,
    preheader: 'Подтвердите адрес электронной почты',
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.03em;color:${BRAND.ink};">Подтвердите email</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${BRAND.muted};">
        Один клик — и адрес будет подтверждён для аккаунта jetsale.online.
      </p>
      <div style="margin:22px 0 12px;">${button(verifyUrl, 'Подтвердить email')}</div>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};">Если вы не регистрировались — игнорируйте письмо.</p>
    `,
  })

  return { subject, text, html }
}

export function premiumActivatedEmail(options: {
  siteUrl: string
  days: number
  planName?: string | null
}): MailContent {
  const site = options.siteUrl.replace(/\/+$/, '')
  const plan = options.planName?.trim() || 'Premium'
  const subject = 'jetsale.online Premium активирован'
  const text = [
    'Оплата прошла успешно!',
    '',
    `Тариф «${plan}» активирован примерно на ${options.days} дн.`,
    '',
    `Кабинет: ${site}/app`,
    `Подписка: ${site}/app/subscription`,
    `Установка расширения: ${site}/install`,
    '',
    'Команда jetsale.online',
  ].join('\n')

  const html = emailShell({
    siteUrl: site,
    preheader: `${plan} активен — полный доступ открыт`,
    title: subject,
    bodyHtml: `
      <div style="display:inline-block;background:${BRAND.tealSoft};color:${BRAND.tealDark};font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:6px 10px;border-radius:999px;margin-bottom:14px;">
        Оплата успешна
      </div>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;letter-spacing:-0.04em;color:${BRAND.ink};">Premium активирован</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.muted};">
        Тариф <strong style="color:${BRAND.ink};">${escapeHtml(plan)}</strong> подключен примерно на
        <strong style="color:${BRAND.ink};">${options.days} дн.</strong>
        Полный интернет доступен в расширении и по ссылке подписки на устройствах.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;background:${BRAND.canvas};border-radius:16px;">
        <tr>
          <td style="padding:16px 18px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.ink};">Быстрый старт</p>
            <ul style="margin:0;padding-left:18px;color:${BRAND.muted};font-size:14px;line-height:1.7;">
              <li>Откройте кабинет и проверьте статус Premium</li>
              <li>В расширении Chrome выберите режим Premium</li>
              <li>На телефоне / TV импортируйте ссылку подписки</li>
            </ul>
          </td>
        </tr>
      </table>
      <div style="margin:8px 0 12px;">${button(`${site}/app/subscription`, 'Открыть подписку')}</div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:${BRAND.muted};">
        <a href="${site}/app" style="color:${BRAND.teal};font-weight:700;text-decoration:none;">Кабинет</a>
        &nbsp;·&nbsp;
        <a href="${site}/install" style="color:${BRAND.teal};font-weight:700;text-decoration:none;">Установка расширения</a>
      </p>
    `,
  })

  return { subject, text, html }
}

export function brandedNoticeEmail(options: {
  siteUrl: string
  subject: string
  title: string
  lead: string
  ctaLabel?: string
  ctaPath?: string
  preheader?: string
}): MailContent {
  const site = options.siteUrl.replace(/\/+$/, '')
  const hasCta = Boolean(options.ctaLabel && options.ctaPath)
  const href = hasCta
    ? `${site}${options.ctaPath!.startsWith('/') ? options.ctaPath : `/${options.ctaPath}`}`
    : site
  const text = [
    options.title,
    '',
    options.lead,
    '',
    hasCta ? `${options.ctaLabel}: ${href}` : `Сайт: ${site}`,
    '',
    'Команда jetsale.online',
  ].join('\n')

  const html = emailShell({
    siteUrl: site,
    preheader: options.preheader || options.lead,
    title: options.subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.03em;color:${BRAND.ink};">${escapeHtml(options.title)}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${BRAND.muted};white-space:pre-wrap;">${escapeHtml(options.lead)}</p>
      ${hasCta ? `<div style="margin:22px 0 8px;">${button(href, options.ctaLabel!)}</div>` : ''}
    `,
  })

  return { subject: options.subject, text, html }
}

export function reminderEmail(options: {
  siteUrl: string
  subject: string
  title: string
  lead: string
  ctaLabel: string
  ctaPath: string
  preheader?: string
}): MailContent {
  const site = options.siteUrl.replace(/\/+$/, '')
  const href = `${site}${options.ctaPath.startsWith('/') ? options.ctaPath : `/${options.ctaPath}`}`
  const text = [
    options.title,
    '',
    options.lead,
    '',
    `${options.ctaLabel}: ${href}`,
    '',
    'Команда jetsale.online',
  ].join('\n')

  const html = emailShell({
    siteUrl: site,
    preheader: options.preheader || options.lead,
    title: options.subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.03em;color:${BRAND.ink};">${escapeHtml(options.title)}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${BRAND.muted};">${escapeHtml(options.lead)}</p>
      <div style="margin:22px 0 8px;">${button(href, options.ctaLabel)}</div>
    `,
  })

  return { subject: options.subject, text, html }
}
