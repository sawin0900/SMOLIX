import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAdminOnly, requireStaff } from '../lib/admin-auth.js'
import { writeAdminAudit } from '../lib/audit.js'
import {
  DEFAULT_SITE_PAGES,
  SITE_PAGE_SLUGS,
  isSitePageSlug,
  type SitePageSlug,
} from '../lib/site-pages.js'

async function ensurePage(slug: SitePageSlug) {
  const existing = await prisma.sitePage.findUnique({ where: { slug } })
  if (existing) return existing
  const defaults = DEFAULT_SITE_PAGES[slug]
  return prisma.sitePage.create({
    data: {
      slug,
      title: defaults.title,
      body: defaults.body,
    },
  })
}

const siteRoutes: FastifyPluginAsync = async (app) => {
  app.get('/pages', async () => {
    const pages = await Promise.all(SITE_PAGE_SLUGS.map((slug) => ensurePage(slug)))
    return {
      pages: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        updatedAt: page.updatedAt,
      })),
    }
  })

  app.get('/pages/:slug', async (request, reply) => {
    const params = z.object({ slug: z.string().min(2).max(64) }).safeParse(request.params)
    if (!params.success || !isSitePageSlug(params.data.slug)) {
      return reply.code(404).send({ error: 'Страница не найдена' })
    }

    const page = await ensurePage(params.data.slug)
    return {
      slug: page.slug,
      title: page.title,
      body: page.body,
      updatedAt: page.updatedAt,
    }
  })
}

export const siteAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/pages', async (request, reply) => {
    const actor = await requireStaff(request, reply)
    if (reply.sent || !actor) return

    const pages = await Promise.all(SITE_PAGE_SLUGS.map((slug) => ensurePage(slug)))
    return {
      pages: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        body: page.body,
        updatedAt: page.updatedAt,
        updatedBy: page.updatedBy,
      })),
    }
  })

  app.put('/pages/:slug', async (request, reply) => {
    const actor = await requireAdminOnly(request, reply)
    if (reply.sent || !actor) return

    const params = z.object({ slug: z.string().min(2).max(64) }).safeParse(request.params)
    if (!params.success || !isSitePageSlug(params.data.slug)) {
      return reply.code(404).send({ error: 'Страница не найдена' })
    }

    const body = z
      .object({
        title: z.string().trim().min(2).max(200),
        body: z.string().trim().min(20).max(200_000),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({ error: 'Укажите title и текст страницы' })
    }

    const page = await prisma.sitePage.upsert({
      where: { slug: params.data.slug },
      create: {
        slug: params.data.slug,
        title: body.data.title,
        body: body.data.body,
        updatedBy: actor.id,
      },
      update: {
        title: body.data.title,
        body: body.data.body,
        updatedBy: actor.id,
      },
    })

    await writeAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'site_page.update',
      targetType: 'site_page',
      targetId: page.slug,
    })

    return {
      message: 'Страница сохранена',
      page: {
        slug: page.slug,
        title: page.title,
        body: page.body,
        updatedAt: page.updatedAt,
      },
    }
  })
}

export default siteRoutes
