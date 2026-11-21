import { prisma } from './prisma.js'
import { reminderEmail, sendMail } from './mailer.js'

function webUrl() {
  return (process.env.WEB_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

async function markSent(userId: string, kind: string) {
  await prisma.reminderLog.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind },
    update: { sentAt: new Date() },
  })
}

async function alreadySent(userId: string, kind: string, cooldownDays = 2) {
  const row = await prisma.reminderLog.findUnique({
    where: { userId_kind: { userId, kind } },
  })
  if (!row) return false
  return Date.now() - row.sentAt.getTime() < cooldownDays * 86400000
}

export async function runSubscriptionReminders() {
  const now = new Date()
  const in3d = new Date(now.getTime() + 3 * 86400000)
  const in1d = new Date(now.getTime() + 1 * 86400000)

  const expiring = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { gt: now, lte: in3d },
    },
    include: {
      user: { select: { id: true, email: true, status: true } },
    },
    take: 200,
  })

  let sent = 0
  for (const sub of expiring) {
    if (sub.user.status !== 'ACTIVE' || !sub.expiresAt) continue
    const days = daysUntil(sub.expiresAt)
    const kind = sub.isTrial
      ? (days <= 1 ? 'trial_expiring_1d' : 'trial_expiring_3d')
      : (days <= 1 ? 'premium_expiring_1d' : 'premium_expiring_3d')

    if (await alreadySent(sub.user.id, kind, 2)) continue

    const site = webUrl()
    const mail = reminderEmail({
      siteUrl: site,
      subject: sub.isTrial
        ? 'jetsale.online: пробный Premium скоро закончится'
        : 'jetsale.online: Premium скоро закончится',
      title: sub.isTrial ? 'Пробный период заканчивается' : 'Premium скоро закончится',
      lead: sub.isTrial
        ? `Ваш пробный Premium заканчивается примерно через ${days} дн. Продлите доступ, чтобы сохранить полный интернет.`
        : `Ваш Premium заканчивается примерно через ${days} дн. Продлите подписку в кабинете.`,
      ctaLabel: 'Продлить подписку',
      ctaPath: '/app/subscription',
      preheader: `Осталось около ${days} дн.`,
    })

    await sendMail({ to: sub.user.email, ...mail })
    await markSent(sub.user.id, kind)
    sent += 1
  }

  // Soft nudge: trial users who never paid and expire within 1 day already covered;
  // also nudge trials with 0 extension sessions after 2+ days of signup
  const staleTrials = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      isTrial: true,
      startsAt: { lte: new Date(now.getTime() - 2 * 86400000) },
      expiresAt: { gt: now },
    },
    include: { user: { select: { id: true, email: true, status: true } } },
    take: 100,
  })

  for (const sub of staleTrials) {
    if (sub.user.status !== 'ACTIVE') continue
    const sessions = await prisma.extensionSession.count({
      where: { userId: sub.user.id },
    })
    if (sessions > 0) continue
    const kind = 'trial_no_extension'
    if (await alreadySent(sub.user.id, kind, 5)) continue
    const site = webUrl()
    const mail = reminderEmail({
      siteUrl: site,
      subject: 'jetsale.online: установите расширение, пока действует trial',
      title: 'Установите расширение',
      lead: 'У вас активен пробный Premium, но расширение ещё не входило в аккаунт. Подключите Chrome за пару минут.',
      ctaLabel: 'Открыть установку',
      ctaPath: '/install',
      preheader: 'Trial активен — поставьте расширение',
    })
    await sendMail({ to: sub.user.email, ...mail })
    await markSent(sub.user.id, kind)
    sent += 1
  }

  return { checked: expiring.length + staleTrials.length, sent }
}

export { runSubscriptionReminders as runReminderSweep }
