import { prisma } from './prisma.js'

/** Ensure the 14-day free trial plan exists (registration depends on it). */
export async function ensureTrialPlan() {
  const existing = await prisma.plan.findFirst({
    where: {
      isActive: true,
      price: 0,
      durationDays: 14,
      OR: [{ slug: 'trial' }, { name: 'Пробный период' }],
    },
  })
  if (existing) {
    if (!existing.slug) {
      return prisma.plan.update({
        where: { id: existing.id },
        data: { slug: 'trial' },
      })
    }
    return existing
  }

  return prisma.plan.create({
    data: {
      slug: 'trial',
      name: 'Пробный период',
      description: 'Бесплатный доступ к jetsale.online на 14 дней',
      price: 0,
      currency: 'RUB',
      durationDays: 14,
      deviceLimit: 1,
      isActive: true,
    },
  })
}
