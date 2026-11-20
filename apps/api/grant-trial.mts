import { prisma } from './src/lib/prisma.js'

async function main() {
  const email = 'sawin0900@gmail.com'

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  })

  if (!user) throw new Error('Пользователь не найден')
  if (user.status !== 'ACTIVE') throw new Error('Аккаунт не активен')

  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
  })

  if (existing) throw new Error('У пользователя уже есть активная подписка')

  const plan = await prisma.plan.findUnique({
    where: { id: 'df8dc3e8-f5d8-4e8d-b0c0-553c852eb1ba' },
  })

  if (!plan || !plan.isActive) throw new Error('Тариф не найден или неактивен')

  const startsAt = new Date()
  const expiresAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000)

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: 'ACTIVE',
      isTrial: true,
      startsAt,
      expiresAt,
    },
  })

  console.log({
    result: 'Подписка создана',
    status: subscription.status,
    isTrial: subscription.isTrial,
    startsAt: subscription.startsAt,
    expiresAt: subscription.expiresAt,
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
