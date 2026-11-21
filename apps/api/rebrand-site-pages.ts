/**
 * Force-refresh /oferta and /policy bodies to current DEFAULT_SITE_PAGES (jetsale.online).
 * Run once after rebrand: npx tsx rebrand-site-pages.ts
 */
import { PrismaClient } from '@prisma/client'
import { DEFAULT_SITE_PAGES, SITE_PAGE_SLUGS } from './src/lib/site-pages'

const prisma = new PrismaClient()

async function main() {
  for (const slug of SITE_PAGE_SLUGS) {
    const defaults = DEFAULT_SITE_PAGES[slug]
    const page = await prisma.sitePage.upsert({
      where: { slug },
      create: {
        slug,
        title: defaults.title,
        body: defaults.body,
      },
      update: {
        title: defaults.title,
        body: defaults.body,
      },
    })
    console.log(`updated ${page.slug}: ${page.title}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
