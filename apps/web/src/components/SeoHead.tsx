import { Helmet } from 'react-helmet-async'
import { DEFAULT_OG_IMAGE, SITE_URL, absoluteUrl, type SeoConfig } from '../seo'

type Props = SeoConfig & {
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

export default function SeoHead({
  title,
  description,
  path = '/',
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  type = 'website',
  jsonLd,
}: Props) {
  const url = absoluteUrl(path)
  const robots = noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'
  const payloads = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <Helmet>
      <html lang="ru" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="SMOLIX" />
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content="SMOLIX — защищённый доступ в браузере" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content="SMOLIX" />

      <meta name="theme-color" content="#0f766e" />
      <link rel="manifest" href="/site.webmanifest" />
      <link rel="apple-touch-icon" href="/favicon.svg" />

      {payloads.map((item, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}

      <link rel="alternate" href={url} hrefLang="ru" />
      <meta name="application-name" content="SMOLIX" />
      <meta name="author" content="SMOLIX" />
      <link rel="home" href={SITE_URL} />
    </Helmet>
  )
}
