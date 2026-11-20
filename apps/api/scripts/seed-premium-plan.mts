import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const premium = await prisma.plan.upsert({
    where: { slug: 'premium-month' },
    update: {
      name: 'Premium',
      description: 'Полный доступ ко всему интернету через SMOLIX на 30 дней',
      price: 299,
      currency: 'RUB',
      durationDays: 30,
      deviceLimit: 3,
      isActive: true,
    },
    create: {
      slug: 'premium-month',
      name: 'Premium',
      description: 'Полный доступ ко всему интернету через SMOLIX на 30 дней',
      price: 299,
      currency: 'RUB',
      durationDays: 30,
      deviceLimit: 3,
      isActive: true,
    },
  })

  console.log('Premium plan ready:', premium.id, premium.slug, premium.price.toString())
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
