import nodemailer from 'nodemailer'

type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

const fromAddress = process.env.MAIL_FROM || 'jetsale.online <info@jetsale.online>'

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

export async function sendMail(input: SendMailInput) {
  const transport = createTransport()

  if (!transport) {
    console.info('[mailer:dev]', {
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
    })
    return { delivered: false, mode: 'log' as const }
  }

  await transport.sendMail({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html || `<pre>${input.text}</pre>`,
  })

  return { delivered: true, mode: 'smtp' as const }
}

export function premiumLaunchEmail(siteUrl: string) {
  const subject = 'jetsale.online Premium уже доступен'
  const text = [
    'Привет!',
    '',
    'Вы были в waitlist jetsale.online Premium — оплата и полный доступ уже подключены.',
    '',
    `Открыть кабинет: ${siteUrl}/app/subscription`,
    '',
    'Команда jetsale.online',
  ].join('\n')

  return { subject, text }
}

export function welcomeEmail(siteUrl: string) {
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

  return { subject, text }
}

export function passwordResetEmail(resetUrl: string) {
  const subject = 'Сброс пароля jetsale.online'
  const text = [
    'Вы запросили сброс пароля jetsale.online.',
    '',
    `Перейдите по ссылке (действует ограниченное время):`,
    resetUrl,
    '',
    'Если это были не вы — просто игнорируйте письмо.',
  ].join('\n')

  return { subject, text }
}

export function emailVerificationEmail(verifyUrl: string) {
  const subject = 'Подтвердите email jetsale.online'
  const text = [
    'Подтвердите адрес электронной почты для jetsale.online.',
    '',
    verifyUrl,
    '',
    'Если вы не регистрировались — игнорируйте письмо.',
  ].join('\n')

  return { subject, text }
}
