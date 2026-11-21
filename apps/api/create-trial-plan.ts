import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.plan.findFirst({
    where: {
      OR: [{ slug: 'trial' }, { name: 'Пробный период' }],
    },
  })

  if (existing) {
    const plan = await prisma.plan.update({
      where: { id: existing.id },
      data: {
        slug: existing.slug || 'trial',
        name: 'Пробный период',
        description: existing.description || 'Бесплатный доступ к SMOLIX на 14 дней',
        price: 0,
        currency: 'RUB',
        durationDays: 14,
        deviceLimit: existing.deviceLimit || 1,
        isActive: true,
      },
    })
    console.log('Пробный тариф уже был — обновлён:')
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  const plan = await prisma.plan.create({
    data: {
      slug: 'trial',
      name: 'Пробный период',
      description: 'Бесплатный доступ к SMOLIX на 14 дней',
      price: 0,
      currency: 'RUB',
      durationDays: 14,
      deviceLimit: 1,
      isActive: true,
    },
  })

  console.log('Пробный тариф создан:')
  console.log(JSON.stringify(plan, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
