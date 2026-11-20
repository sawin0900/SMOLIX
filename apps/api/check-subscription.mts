import { prisma } from './src/lib/prisma.js'

async function main() {
  const rows = await prisma.subscription.findMany({
    where: {
      user: {
        email: 'sawin0900@gmail.com',
      },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })

  console.log(
    rows.map((s) => ({
      status: s.status,
      isTrial: s.isTrial,
      startsAt: s.startsAt,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      plan: s.plan.name,
    })),
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

