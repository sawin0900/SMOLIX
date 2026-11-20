import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = await prisma.plan.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      durationDays: true,
      isActive: true,
    },
  })

  console.log('ТАРИФЫ:')
  console.log(JSON.stringify(plans, null, 2))

  const subscriptions = await prisma.subscription.count()
  console.log('ВСЕГО ПОДПИСОК:', subscriptions)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
