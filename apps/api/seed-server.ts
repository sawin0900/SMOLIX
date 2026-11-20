import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const server = await prisma.server.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {
      name: 'Россия',
      country: 'Россия',
      city: null,
      hostname: 'rassiya.jetsale.online',
      port: 443,
      isActive: true,
    },
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Россия',
      country: 'Россия',
      city: null,
      hostname: 'rassiya.jetsale.online',
      port: 443,
      isActive: true,
    },
  })

  console.log('Сервер добавлен:', server.name, server.hostname, server.port)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
