import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'
import { getSitePage } from '../api'

const SLUG_ALIASES: Record<string, 'oferta' | 'policy'> = {
  oferta: 'oferta',
  terms: 'oferta',
  policy: 'policy',
  privacy: 'policy',
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function LegalPage() {
  const { doc } = useParams()
  const location = useLocation()
  const slug = useMemo(() => {
    const raw = doc || location.pathname.replace(/^\//, '').split('/')[0] || ''
    return SLUG_ALIASES[raw]
  }, [doc, location.pathname])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    setError('')
    getSitePage(slug)
      .then((page) => {
        if (cancelled) return
        setTitle(page.title)
        setBody(page.body)
        setUpdatedAt(page.updatedAt)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить страницу')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!slug) {
    return <Navigate to="/policy" replace />
  }

  const seo = slug === 'policy' ? SEO_PAGES.privacy : SEO_PAGES.terms
  const paragraphs = body.split(/\n+/).map((line) => line.trim()).filter(Boolean)

  return (
    <div className="min-h-screen app-bg">
      <SeoHead {...seo} title={title ? `${title} — SMOLIX` : seo.title} />
      <div className="section-shell py-8 md:py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 mb-8">
          <ArrowLeft size={16} /> На главную
        </Link>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.5px]">{title || (loading ? '…' : 'Документ')}</h1>
        </div>
        <p className="text-sm text-[var(--muted)] mb-6">Обновлено: {formatUpdatedAt(updatedAt)}</p>
        <div className="glass-card rounded-3xl p-6 md:p-8 space-y-4 text-sm text-[var(--muted)] leading-7 whitespace-pre-wrap">
          {loading && <p>Загрузка…</p>}
          {error && <p className="text-rose-600">{error}</p>}
          {!loading && !error && paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
