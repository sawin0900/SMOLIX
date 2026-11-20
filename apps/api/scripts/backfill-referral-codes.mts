import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function uniqueCode() {
  for (;;) {
    const code = randomBytes(4).toString('hex')
    const existing = await prisma.user.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }
}

async function main() {
  const users = await prisma.user.findMany({ where: { referralCode: null } })
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: await uniqueCode() },
    })
  }
  console.log(`backfilled ${users.length} users`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
