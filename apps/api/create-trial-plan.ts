import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plan = await prisma.plan.create({
    data: {
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
