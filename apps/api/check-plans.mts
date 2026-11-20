import { prisma } from './src/lib/prisma.js'

async function main() {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      price: 0,
      durationDays: 14,
    },
    select: {
      id: true,
      name: true,
      price: true,
      durationDays: true,
      isActive: true,
    },
  })

  console.log(plans)
}

main().finally(() => prisma.$disconnect())
