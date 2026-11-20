import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const waitlistSchema = z.object({
  email: z.string().trim().email().max(254),
  source: z.string().trim().min(1).max(64).optional(),
})

const marketingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/waitlist', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parsed = waitlistSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Укажите корректный email',
      })
    }

    const email = parsed.data.email.toLowerCase()
    const source = parsed.data.source || 'landing'

    const existing = await prisma.waitlistEntry.findUnique({
      where: { email },
    })

    if (existing) {
      return {
        message: 'Вы уже в waitlist Premium',
        alreadyJoined: true,
      }
    }

    await prisma.waitlistEntry.create({
      data: { email, source },
    })

    return {
      message: 'Вы в waitlist — сообщим о запуске Premium',
      alreadyJoined: false,
    }
  })
}

export default marketingRoutes
