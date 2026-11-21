import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Zap,
  LockKeyhole,
  ArrowRight,
  Download,
  Check,
  EyeOff,
  Link2,
  ChevronDown,
  LayoutDashboard,
  Menu,
  X,
  Monitor,
  Smartphone,
  Tablet,
  Tv,
  Puzzle,
  Store,
  Gift,
} from 'lucide-react'
import { getAccount, getPublicStatus, joinWaitlist, type PublicStatus, type User } from '../api'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES, SITE_URL } from '../seo'
import { CHROME_STORE_URL, IS_CHROME_STORE_LIVE } from '../config'
import { FAQ_BY_LOCALE, LANDING_COPY, type LandingCopy, type Locale } from '../i18n/landing'
import { track } from '../lib/analytics'

const LOCALE_KEY = 'smolix_locale'
const DEMO_AUTO_MS = 3500
const DEMO_PAUSE_MS = 8000

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored === 'ru' || stored === 'en') return stored
  } catch {
    /* ignore */
  }
  return 'ru'
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className.includes('reveal') ? className : `reveal ${className}`.trim()}>
      {children}
    </div>
  )
}

function useRevealRoots() {
  useEffect(() => {
    const nodes = document.querySelectorAll('.landing-page .reveal-on-scroll')
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

function LocaleToggle({
  locale,
  onLocaleChange,
}: {
  locale: Locale
  onLocaleChange: (next: Locale) => void
}) {
  return (
    <div className="landing-lang" role="group" aria-label={locale === 'ru' ? 'Язык' : 'Language'}>
      {(['ru', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={locale === code ? 'is-active' : undefined}
          aria-pressed={locale === code}
          onClick={() => onLocaleChange(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function statusTone(status: PublicStatus['status']) {
  if (status === 'operational') return 'is-ok'
  if (status === 'degraded') return 'is-degraded'
  return 'is-down'
}

function statusLabel(status: PublicStatus['status'], t: LandingCopy) {
  if (status === 'operational') return t.statusOk
  if (status === 'degraded') return t.statusDegraded
  return t.statusDown
}

function StatusPill({
  status,
  t,
  className = '',
}: {
  status: PublicStatus['status'] | null
  t: LandingCopy
  className?: string
}) {
  if (!status) return null

  return (
    <Link
      to="/status"
      className={`status-pill ${statusTone(status)} ${className}`.trim()}
      title={t.statusCheck}
    >
      <span className="status-pill-dot" aria-hidden />
      {statusLabel(status, t)}
    </Link>
  )
}

function ExtensionMockup({
  locale,
  t,
  smolixOn,
  onManualToggle,
}: {
  locale: Locale
  t: LandingCopy
  smolixOn: boolean
  onManualToggle: (next: boolean) => void
}) {
  const onlineLabel = locale === 'ru' ? 'Онлайн' : 'Online'
  const locationName = locale === 'ru' ? 'Россия' : 'Russia'

  return (
    <div className={`hero-stage hero-stage-live ${smolixOn ? 'is-demo-on' : 'is-demo-off'}`}>
      <div className="hero-demo-controls" role="group" aria-label={locale === 'ru' ? 'Демо SMOLIX' : 'SMOLIX demo'}>
        <button
          type="button"
          className={`hero-demo-toggle ${!smolixOn ? 'is-active' : ''}`}
          aria-pressed={!smolixOn}
          onClick={() => onManualToggle(false)}
        >
          {t.demoOff}
        </button>
        <button
          type="button"
          className={`hero-demo-toggle ${smolixOn ? 'is-active' : ''}`}
          aria-pressed={smolixOn}
          onClick={() => onManualToggle(true)}
        >
          {t.demoOn}
        </button>
      </div>

      <div
        className={`hero-demo-card ${smolixOn ? 'hero-demo-card-dim' : 'hero-demo-card-prominent'}`}
        aria-hidden="true"
      >
        <div className="hero-demo-bar">
          <span>youtube.com</span>
          <em>{smolixOn ? t.demoOn : t.demoOff}</em>
        </div>
        <div className={smolixOn ? 'hero-demo-open' : 'hero-demo-blocked'}>
          {smolixOn ? t.demoOpen : t.demoBlocked}
        </div>
      </div>

      <div className={`hero-mockup anim-float ${smolixOn ? '' : 'hero-mockup-hidden'}`} aria-hidden={!smolixOn}>
        <div className="hero-mockup-chrome">
          <span />
          <span />
          <span />
          <div className="hero-mockup-url">smolix.app / extension</div>
        </div>
        <div className="hero-mockup-body">
          <div className="hero-mockup-brand">
            <div className="hero-mockup-mark">
              <ShieldCheck size={14} />
            </div>
            <strong>SMOLIX</strong>
            <em>{onlineLabel}</em>
          </div>

          <div className="hero-mockup-modes">
            <span className="active">YouTube</span>
            <span>{t.demoModeAll}</span>
          </div>

          <div className="hero-mockup-orb">
            <div className="hero-mockup-core">
              <ShieldCheck size={28} strokeWidth={1.6} />
            </div>
          </div>
          <p className="hero-mockup-kicker">{t.demoProtection}</p>
          <p className="hero-mockup-title">{t.demoConnected}</p>
          <div className="hero-mockup-chip">{locale === 'ru' ? 'Сессия 00:12:48 · 42 мс' : 'Session 00:12:48 · 42 ms'}</div>
          <div className="hero-mockup-btn">{t.demoDisconnect}</div>
          <div className="hero-mockup-loc">
            <span>🇷🇺</span>
            <div>
              <small>{t.demoLocation}</small>
              <strong>{locationName}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InstallPreview({ t }: { t: LandingCopy }) {
  return (
    <div className="install-preview" aria-hidden="true">
      <div className="install-preview-chrome">
        <span />
        <span />
        <span />
        <span className="install-preview-url">{t.installPreviewTitle}</span>
      </div>
      <div className="install-preview-card">
        <div className="install-preview-row">
          <div className="install-preview-icon">
            <ShieldCheck size={18} />
          </div>
          <div>
            <strong>{t.installPreviewBadge}</strong>
            <p>{t.installPreviewState}</p>
          </div>
          <span className="install-preview-toggle is-on" />
        </div>
      </div>
    </div>
  )
}

const FREE_FEATURES: Record<Locale, string[]> = {
  ru: ['Только Chrome-расширение', 'YouTube и Shorts', 'Без телефона и TV'],
  en: ['Chrome extension only', 'YouTube and Shorts', 'No phone or TV apps'],
}

const PREMIUM_FEATURES: Record<Locale, string[]> = {
  ru: ['Расширение + приложения', 'Телефон, ПК, iPhone, TV', 'Одна ссылка из кабинета'],
  en: ['Extension + apps', 'Phone, PC, iPhone, TV', 'One dashboard link'],
}

const COMPARE_ROWS: Record<Locale, Array<[string, string, string]>> = {
  ru: [
    ['YouTube и Shorts', 'Да', 'Да'],
    ['Весь интернет', 'Нет', 'Да'],
    ['Расширение Chrome', 'Да', 'Да'],
    ['Телефон / ПК / TV', 'Нет', 'Да'],
    ['Цена', '0 ₽', 'от 299 ₽/мес'],
  ],
  en: [
    ['YouTube and Shorts', 'Yes', 'Yes'],
    ['Full internet', 'No', 'Yes'],
    ['Chrome extension', 'Yes', 'Yes'],
    ['Phone / PC / TV', 'No', 'Yes'],
    ['Price', '0 ₽', 'from 299 ₽/mo'],
  ],
}

const TRUST_ITEMS: Record<Locale, Array<{ title: string; text: string }>> = {
  ru: [
    { title: 'Без лишних логов в интерфейсе', text: 'Показываем только то, что нужно для работы.' },
    { title: 'Один аккаунт', text: 'Сайт, расширение и ссылка подписки — в одной связке.' },
    { title: 'Проверка доступа', text: 'Подписка и сессия сверяются на API.' },
  ],
  en: [
    { title: 'No extra UI logs', text: 'We show only what you need to operate.' },
    { title: 'One account', text: 'Site, extension, and subscription link stay in sync.' },
    { title: 'Access checks', text: 'Subscription and session verified on the API.' },
  ],
}

function PremiumWaitlistForm({
  t,
  waitlistEmail,
  setWaitlistEmail,
  waitlistBusy,
  waitlistDone,
  waitlistError,
  onSubmit,
}: {
  t: LandingCopy
  waitlistEmail: string
  setWaitlistEmail: (v: string) => void
  waitlistBusy: boolean
  waitlistDone: boolean
  waitlistError: string
  onSubmit: (event: FormEvent) => void
}) {
  if (waitlistDone) {
    return (
      <p className="text-sm font-semibold text-white/90">{t.waitlistDone}</p>
    )
  }

  return (
    <form className="flex flex-col gap-2 mt-2" onSubmit={onSubmit}>
      <input
        type="email"
        required
        value={waitlistEmail}
        onChange={(e) => setWaitlistEmail(e.target.value)}
        placeholder={t.waitlistPlaceholder}
        className="h-11 rounded-xl border border-white/20 bg-black/20 px-3 text-white text-sm placeholder:text-white/45 outline-none focus:ring-2 focus:ring-white/30"
      />
      {waitlistError && <p className="text-sm text-rose-200">{waitlistError}</p>}
      <button
        type="submit"
        disabled={waitlistBusy}
        className="inline-flex w-full items-center justify-center rounded-xl bg-white/15 text-white py-2.5 text-sm font-bold hover:bg-white/20 transition disabled:opacity-60"
      >
        {waitlistBusy ? t.waitlistBusy : t.waitlistSubmit}
      </button>
    </form>
  )
}

export default function Landing() {
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale())
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistBusy, setWaitlistBusy] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('top')
  const [cookieOk, setCookieOk] = useState(true)
  const [publicStatus, setPublicStatus] = useState<PublicStatus | null>(null)
  const [demoOn, setDemoOn] = useState(false)

  const demoPauseUntil = useRef(0)
  const statusViewTracked = useRef(false)
  const plansScrollTracked = useRef(false)

  const t = LANDING_COPY[locale]
  const faqItems = FAQ_BY_LOCALE[locale]

  useRevealRoots()

  const proofStoreLabel = IS_CHROME_STORE_LIVE ? t.proofStoreLive : t.proofStore

  const navLinks = [
    { href: '#how', id: 'how', label: t.navHow },
    { href: '#audience', id: 'audience', label: t.navAudience },
    { href: '#plans', id: 'plans', label: t.navPlans },
    { href: '#faq', id: 'faq', label: t.navFaq },
    { href: '/install', id: 'install', label: t.navInstall, to: '/install' as const },
  ]

  const setLocalePersisted = (next: Locale) => {
    setLocale(next)
    try {
      localStorage.setItem(LOCALE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    try {
      const accepted = localStorage.getItem('smolix_cookie_ok') === '1'
      const seen = localStorage.getItem('smolix_seen') === '1'
      setCookieOk(accepted || seen)
      localStorage.setItem('smolix_seen', '1')
    } catch {
      setCookieOk(true)
    }
  }, [])

  useEffect(() => {
    getAccount()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const data = await getPublicStatus()
        if (cancelled) return
        setPublicStatus(data)
        if (!statusViewTracked.current) {
          statusViewTracked.current = true
          track('status_view', { status: data.status })
        }
      } catch {
        if (!cancelled) setPublicStatus(null)
      }
    }

    loadStatus()
    const id = window.setInterval(loadStatus, 45_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() < demoPauseUntil.current) return
      setDemoOn((prev) => !prev)
    }, DEMO_AUTO_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const ids = ['top', 'how', 'audience', 'plans', 'faq', 'install']
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node))

    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0.1, 0.35, 0.6] },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const plans = document.getElementById('plans')
    if (!plans) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !plansScrollTracked.current) {
          plansScrollTracked.current = true
          track('scroll_plans')
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(plans)
    return () => observer.disconnect()
  }, [])

  const primaryTo = user ? (user.role === 'ADMIN' ? '/admin' : '/app') : '/auth?mode=register'
  const primaryLabel = user ? t.heroCtaCabinet : t.heroCtaAccount

  const handleManualDemo = (next: boolean) => {
    demoPauseUntil.current = Date.now() + DEMO_PAUSE_MS
    setDemoOn(next)
  }

  const submitWaitlist = async (event: FormEvent) => {
    event.preventDefault()
    setWaitlistError('')
    setWaitlistBusy(true)
    try {
      await joinWaitlist(waitlistEmail.trim().toLowerCase(), 'landing-premium')
      setWaitlistDone(true)
      setWaitlistEmail('')
      track('waitlist_submit', { source: 'landing-premium' })
    } catch (error) {
      setWaitlistError(
        error instanceof Error
          ? error.message
          : (locale === 'ru' ? 'Не удалось записаться' : 'Could not join waitlist'),
      )
    } finally {
      setWaitlistBusy(false)
    }
  }

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SMOLIX',
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
      email: 'support@smolix.app',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'SMOLIX VPN',
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Chrome',
      url: `${SITE_URL}/install`,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'RUB',
        description: locale === 'ru' ? 'YouTube режим бесплатно' : 'YouTube mode free',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    },
  ]

  const installEyebrow = t.installEyebrow

  const premiumPrimaryTo = user ? '/app/subscription' : '/auth?mode=register'
  const premiumPrimaryLabel = user ? t.premiumPay : t.premiumBuyGuest
  const referralTo = user ? '/app/referral' : '/auth?mode=register'
  const referralLabel = user ? t.referralCta : t.referralCtaGuest

  return (
    <div className="min-h-screen text-[var(--ink)] landing-page">
      <SeoHead {...SEO_PAGES.home} jsonLd={jsonLd} />

      <header className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="section-shell landing-nav-inner">
          <a href="#top" className="flex items-center gap-3" aria-label="SMOLIX">
            <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center shadow-lg shadow-teal-950/30">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <span className="text-lg font-extrabold tracking-[0.5px]">SMOLIX</span>
          </a>

          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold" aria-label={locale === 'ru' ? 'Основная навигация' : 'Main navigation'}>
            {navLinks.map((link) => (
              link.to ? (
                <Link key={link.id} to={link.to} className={`landing-nav-link ${activeSection === 'install' ? 'is-active' : ''}`}>
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.id}
                  href={link.href}
                  className={`landing-nav-link ${activeSection === link.id ? 'is-active' : ''}`}
                >
                  {link.label}
                </a>
              )
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleToggle locale={locale} onLocaleChange={setLocalePersisted} />
            {user ? (
              <Link
                to={primaryTo}
                className="btn-primary btn-primary-hero !rounded-full px-4 py-2.5 text-sm"
              >
                <LayoutDashboard size={15} />
                {t.navCabinet}
              </Link>
            ) : (
              <>
                <Link to="/auth?mode=login" className="hidden lg:inline text-sm font-semibold landing-nav-link px-2">
                  {t.navLogin}
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="btn-primary !rounded-full px-4 py-2.5 text-sm shadow-sm"
                >
                  {t.navStart}
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
            <button
              type="button"
              className="landing-burger"
              aria-label={locale === 'ru' ? 'Открыть меню' : 'Open menu'}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="landing-mobile-menu">
          <div className="landing-mobile-sheet">
            <div className="flex items-center justify-between mb-6">
              <strong>{t.menu}</strong>
              <button type="button" aria-label={locale === 'ru' ? 'Закрыть' : 'Close'} onClick={() => setMobileOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mb-4 text-[var(--ink)]">
              <LocaleToggle locale={locale} onLocaleChange={setLocalePersisted} />
            </div>
            <nav className="grid gap-2" aria-label={locale === 'ru' ? 'Мобильная навигация' : 'Mobile navigation'}>
              {navLinks.map((link) => (
                link.to ? (
                  <Link key={link.id} to={link.to} className="landing-mobile-link" onClick={() => setMobileOpen(false)}>
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.id} href={link.href} className="landing-mobile-link" onClick={() => setMobileOpen(false)}>
                    {link.label}
                  </a>
                )
              ))}
              {!user && (
                <Link to="/auth?mode=login" className="landing-mobile-link lg:hidden" onClick={() => setMobileOpen(false)}>
                  {t.navLogin}
                </Link>
              )}
            </nav>
          </div>
          <button className="landing-mobile-backdrop" aria-label={locale === 'ru' ? 'Закрыть меню' : 'Close menu'} onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main>
        <section id="top" className="landing-hero landing-hero-compact">
          <div className="landing-orb w-[480px] h-[480px] bg-teal-400/25 -top-28 -right-20" />
          <div className="landing-orb w-[300px] h-[300px] bg-amber-400/15 bottom-0 left-[-80px]" />

          <div className="section-shell landing-hero-inner relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center">
            <div>
              <h1 className="anim-fade-up max-w-2xl text-[2.6rem] sm:text-5xl md:text-6xl font-extrabold tracking-[-1.4px] leading-[1.05] text-[#f4fbfb]">
                {t.heroTitle1}<br />
                {t.heroTitle2}
              </h1>
              <p className="anim-fade-up-delay mt-5 max-w-md text-base md:text-lg text-white/70 leading-7">
                {t.heroSub}
              </p>
              <div className="anim-fade-up-delay-2 mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Link
                  to={primaryTo}
                  onClick={() => track('cta_click', { location: 'hero_primary' })}
                  className="btn-primary btn-primary-hero px-6 py-3.5 w-full sm:w-auto"
                >
                  {primaryLabel}
                  <ArrowRight size={18} />
                </Link>
                {IS_CHROME_STORE_LIVE ? (
                  <a
                    href={CHROME_STORE_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track('cta_click', { location: 'hero_store' })}
                    className="btn-secondary btn-secondary-hero px-6 py-3.5 w-full sm:w-auto"
                  >
                    <Store size={18} />
                    {t.installStore}
                  </a>
                ) : (
                  <a
                    href="#install"
                    onClick={() => track('cta_click', { location: 'hero_install' })}
                    className="btn-secondary btn-secondary-hero px-6 py-3.5 w-full sm:w-auto"
                  >
                    <Download size={18} />
                    {t.heroCtaInstall}
                  </a>
                )}
              </div>

              <div className="proof-row anim-fade-up-delay-2">
                <span>{t.proofExt}</span>
                <span>{t.proofDevices}</span>
                <span>{t.proofFree}</span>
                <span>{t.proofAccount}</span>
                <span>{proofStoreLabel}</span>
                <StatusPill status={publicStatus?.status ?? null} t={t} className="status-pill-hero" />
              </div>
            </div>

            <div className="anim-fade-up-delay relative flex justify-center lg:justify-end">
              <ExtensionMockup
                locale={locale}
                t={t}
                smolixOn={demoOn}
                onManualToggle={handleManualDemo}
              />
            </div>
          </div>
        </section>

        <div className="landing-stack section-shell">
          <Reveal className="landing-block reveal">
            <section id="how" className="landing-band">
              <p className="text-teal-700 text-sm font-bold mb-3">{t.howEyebrow}</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px] max-w-2xl">
                {t.howTitle}
              </h2>

              <ol className="steps-rail mt-12">
                {[
                  ['01', t.how1t, t.how1d],
                  ['02', t.how2t, t.how2d],
                  ['03', t.how3t, t.how3d],
                ].map(([num, title, text], index) => (
                  <li key={num} className="steps-item">
                    <div className="steps-num">{num}</div>
                    {index < 2 && <div className="steps-line" aria-hidden="true" />}
                    <h3 className="mt-5 text-xl font-bold">{title}</h3>
                    <p className="mt-2 text-sm text-[var(--muted)] leading-6">{text}</p>
                  </li>
                ))}
              </ol>
            </section>
          </Reveal>

          <Reveal className="landing-block reveal">
            <section id="audience">
              <p className="text-teal-700 text-sm font-bold mb-3">{t.audienceEyebrow}</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px] max-w-2xl">{t.audienceTitle}</h2>
              <p className="mt-4 max-w-2xl text-[var(--muted)] leading-7">{t.audienceLead}</p>

              <ul className="devices-rail mt-8" aria-label={t.audienceEyebrow}>
                {[
                  { Icon: Puzzle, label: t.deviceChrome },
                  { Icon: Monitor, label: t.deviceWindows },
                  { Icon: Monitor, label: t.deviceMac },
                  { Icon: Smartphone, label: t.deviceAndroid },
                  { Icon: Tablet, label: t.deviceIos },
                  { Icon: Tv, label: t.deviceTv },
                ].map(({ Icon, label }) => (
                  <li key={label} className="devices-rail-item">
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>

              <div className="devices-schema mt-8" aria-hidden="true">
                <div className="devices-schema-node">
                  <Puzzle size={18} />
                  <span>{t.schemaExt}</span>
                </div>
                <span className="devices-schema-arrow" />
                <div className="devices-schema-node is-link">
                  <Link2 size={18} />
                  <span>{t.schemaLink}</span>
                </div>
                <span className="devices-schema-arrow" />
                <div className="devices-schema-node">
                  <Smartphone size={18} />
                  <span>{t.schemaQr}</span>
                </div>
              </div>

              <div className="devices-paths mt-10">
                <div className="devices-path">
                  <p className="devices-path-kicker">{t.pathExtTitle}</p>
                  <h3>{t.aud1t}</h3>
                  <p>{t.pathExtText}</p>
                </div>
                <div className="devices-path">
                  <p className="devices-path-kicker">{t.pathAppTitle}</p>
                  <h3>{t.aud2t}</h3>
                  <p>{t.pathAppText}</p>
                  <p className="devices-path-note">{t.aud3d}</p>
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal className="landing-block reveal">
            <section id="plans" className="landing-band">
              <p className="text-teal-700 text-sm font-bold mb-3">{t.plansEyebrow}</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px]">{t.plansTitle}</h2>

              <div className="plans-grid mt-10">
                <div className="plan-card plan-card-free">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Zap size={22} />
                    </div>
                    <span className="text-[11px] font-extrabold tracking-wide px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
                      FREE
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold">YouTube</h3>
                  <p className="mt-1 text-3xl font-extrabold tracking-[-0.5px]">0 ₽</p>
                  <p className="mt-2 text-xs font-bold text-emerald-700 tracking-wide uppercase">{t.freeScope}</p>
                  <p className="mt-3 text-[var(--muted)] text-sm leading-6">
                    {t.freeDesc}
                  </p>
                  <ul className="mt-6 mb-8 space-y-2.5 text-sm">
                    {FREE_FEATURES[locale].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={user ? primaryTo : '/auth?mode=register'}
                    onClick={() => track('cta_click', { location: 'plan_free' })}
                    className="btn-primary plan-cta w-full py-3.5"
                  >
                    {user ? t.freeCtaIn : t.freeCta}
                  </Link>
                </div>

                <div className="plan-card plan-card-pro">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center">
                      <LockKeyhole size={22} />
                    </div>
                    <span className="text-[11px] font-extrabold tracking-wide px-3 py-1.5 rounded-full bg-amber-300/20 text-amber-100">
                      {t.premiumLive}
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold text-white">
                    {locale === 'ru' ? 'Весь интернет' : 'Full internet'}
                  </h3>
                  <p className="mt-1 text-3xl font-extrabold tracking-[-0.5px] text-white">
                    {locale === 'ru' ? 'от 299 ₽/мес' : 'from 299 ₽/mo'}
                  </p>
                  <p className="mt-2 text-xs font-bold text-teal-100 tracking-wide uppercase">{t.premiumScope}</p>
                  <p className="mt-3 text-white/80 text-sm leading-6">
                    {t.premiumDesc}
                  </p>
                  <ul className="mt-6 mb-6 space-y-2.5 text-sm text-white/90">
                    {PREMIUM_FEATURES[locale].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check size={16} className="text-teal-200 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={premiumPrimaryTo}
                    onClick={() => track('cta_click', { location: user ? 'premium_pay' : 'premium_buy_guest' })}
                    className="btn-primary-hero plan-cta inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-bold hover:-translate-y-0.5 transition"
                  >
                    {premiumPrimaryLabel}
                    <ArrowRight size={16} />
                  </Link>

                  <details className="plan-waitlist-details mt-4 group">
                    <summary className="text-sm text-white/70 cursor-pointer hover:text-white/90 list-none font-semibold">
                      {t.premiumWaitlist}
                    </summary>
                    <PremiumWaitlistForm
                      t={t}
                      waitlistEmail={waitlistEmail}
                      setWaitlistEmail={setWaitlistEmail}
                      waitlistBusy={waitlistBusy}
                      waitlistDone={waitlistDone}
                      waitlistError={waitlistError}
                      onSubmit={submitWaitlist}
                    />
                  </details>
                </div>
              </div>

              <div className="compare-table mt-8">
                <div className="compare-head">
                  <span>{t.compareTitle}</span>
                  <strong>{t.compareFree}</strong>
                  <strong>{t.comparePremium}</strong>
                </div>
                {COMPARE_ROWS[locale].map(([feature, free, premium]) => (
                  <div key={feature} className="compare-row">
                    <span>{feature}</span>
                    <span>{free}</span>
                    <span>{premium}</span>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal className="landing-block reveal">
            <section className="referral-panel">
              <div className="referral-panel-inner">
                <Gift className="text-teal-700 shrink-0" size={28} />
                <div className="flex-1">
                  <p className="text-teal-700 text-sm font-bold mb-2">{t.referralEyebrow}</p>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.5px]">{t.referralTitle}</h2>
                  <p className="mt-3 text-[var(--muted)] leading-7 max-w-xl">{t.referralText}</p>
                  <Link
                    to={referralTo}
                    onClick={() => track('referral_cta', { logged_in: Boolean(user) })}
                    className="btn-primary mt-6 px-5 py-3"
                  >
                    {referralLabel}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal className="landing-block reveal">
          <section className="social-proof landing-band">
            <p className="text-teal-700 text-sm font-bold mb-3">{t.socialEyebrowAlt}</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px]">{t.socialTitleAlt}</h2>

            <div className="social-metrics mt-8">
              <span>{t.socialMetricExt}</span>
              <span>{t.socialMetricLink}</span>
              <span>{t.proofDevices}</span>
              <span>{t.proofAccount}</span>
            </div>

            <div className="facts-grid mt-8">
              <div className="fact-tile">
                <strong>{t.socialMetricStatus}</strong>
                <p>
                  <StatusPill status={publicStatus?.status ?? null} t={t} className="status-pill-footer" />
                </p>
              </div>
              <div className="fact-tile">
                <strong>{t.socialMetricLatency}</strong>
                <p>
                  {publicStatus?.latencyMs != null
                    ? `${publicStatus.latencyMs} ms`
                    : '—'}
                </p>
              </div>
              <div className="fact-tile">
                <strong>{t.socialMetricLink}</strong>
                <p>{t.pathAppText}</p>
              </div>
            </div>

            <div className="connect-story mt-10" aria-hidden="true">
              <div className="connect-story-panel">
                <span className="connect-story-label">{t.pathExtTitle}</span>
                <div className="connect-story-frames">
                  <div className="connect-frame is-a">{t.demoOff}</div>
                  <div className="connect-frame is-b">{t.demoOpen}</div>
                </div>
              </div>
              <div className="connect-story-panel">
                <span className="connect-story-label">{t.pathAppTitle}</span>
                <div className="connect-story-frames">
                  <div className="connect-frame is-qr">QR</div>
                  <div className="connect-frame is-phone">{t.deviceAndroid} / TV</div>
                </div>
              </div>
            </div>
          </section>
          </Reveal>

          <Reveal className="landing-block reveal">
            <section>
              <div className="trust-panel">
                <div>
                  <p className="text-teal-700 text-sm font-bold mb-3">{t.trustEyebrow}</p>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px] max-w-xl">
                    {t.trustTitle}
                  </h2>
                  <p className="mt-4 max-w-xl text-[var(--muted)] leading-7">
                    {t.trustText}
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mt-8 md:mt-0">
                  {TRUST_ITEMS[locale].map((item, index) => (
                    <div key={item.title} className="trust-item">
                      {index === 0 && <EyeOff size={20} className="text-teal-700" />}
                      {index === 1 && <Link2 size={20} className="text-teal-700" />}
                      {index === 2 && <ShieldCheck size={20} className="text-teal-700" />}
                      <strong className="block mt-3 text-sm">{item.title}</strong>
                      <p className="mt-1 text-xs text-[var(--muted)] leading-5">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal className="landing-block reveal">
            <section id="faq">
              <p className="text-teal-700 text-sm font-bold mb-3">{t.faqEyebrow}</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px]">{t.faqTitle}</h2>
              <div className="faq-list mt-8">
                {faqItems.map((item, index) => (
                  <details
                    key={item.q}
                    className={`faq-item ${openFaq === index ? 'is-open' : ''}`}
                    open={openFaq === index}
                    onToggle={(event) => {
                      const el = event.currentTarget
                      setOpenFaq(el.open ? index : null)
                    }}
                  >
                    <summary className="faq-trigger">
                      <span>{item.q}</span>
                      <ChevronDown size={18} className={`faq-chevron ${openFaq === index ? 'rotate' : ''}`} />
                    </summary>
                    <p className="faq-answer">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal className="landing-block reveal">
            <section id="install">
              <div className="install-panel">
                <div className="install-panel-layout">
                  <div className="relative z-10 max-w-xl">
                    <p className="text-teal-100 text-xs font-bold tracking-wide mb-3">{installEyebrow}</p>
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-[-0.6px] text-white">
                      {t.installTitle}
                    </h2>
                    <p className="install-copy mt-4 leading-7">
                      {IS_CHROME_STORE_LIVE ? t.installCopyLive : t.installCopySoon}
                    </p>
                    <div className="mt-8 flex flex-col gap-3">
                      {!user && (
                        <Link
                          to="/auth?mode=register"
                          onClick={() => track('cta_click', { location: 'install_account' })}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-teal-950 px-5 py-3 font-bold hover:-translate-y-0.5 transition"
                        >
                          {t.installCtaAccount}
                          <ArrowRight size={16} />
                        </Link>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {IS_CHROME_STORE_LIVE ? (
                          <a
                            href={CHROME_STORE_URL}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => track('cta_click', { location: 'install_browser' })}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/50 bg-teal-950/35 px-5 py-3 font-bold text-white hover:bg-teal-950/50 transition"
                          >
                            <Puzzle size={16} />
                            {t.installCtaBrowser}
                          </a>
                        ) : (
                          <Link
                            to="/install"
                            onClick={() => track('cta_click', { location: 'install_browser' })}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/50 bg-teal-950/35 px-5 py-3 font-bold text-white hover:bg-teal-950/50 transition"
                          >
                            <Puzzle size={16} />
                            {t.installCtaBrowser}
                          </Link>
                        )}
                        <Link
                          to={user ? '/app/vpn' : '/auth?mode=register&next=/app/vpn'}
                          onClick={() => track('cta_click', { location: 'install_devices' })}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/50 bg-teal-950/35 px-5 py-3 font-bold text-white hover:bg-teal-950/50 transition"
                        >
                          <Smartphone size={16} />
                          {t.installCtaDevices}
                        </Link>
                      </div>
                      <p className="text-sm text-teal-100/80">
                        <Link to="/install" className="underline underline-offset-2 font-semibold text-white">
                          {t.installGuide}
                        </Link>
                        {IS_CHROME_STORE_LIVE && (
                          <>
                            {' · '}
                            <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 font-semibold text-white">
                              {t.installStore}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <InstallPreview t={t} />
                </div>
                <ShieldCheck className="anim-float absolute right-6 bottom-4 md:right-14 md:bottom-8 text-white/12 pointer-events-none" size={170} strokeWidth={1} />
              </div>
            </section>
          </Reveal>
        </div>
      </main>

      <footer className="section-shell landing-footer">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center">
                <ShieldCheck className="text-white" size={18} />
              </div>
              <span className="font-extrabold text-[var(--ink)]">SMOLIX</span>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)] max-w-xs">
              {t.footerTagline}
            </p>
            <StatusPill status={publicStatus?.status ?? null} t={t} className="status-pill-footer mt-4" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <p className="font-bold text-[var(--ink)] mb-3">{t.footerProduct}</p>
              <ul className="space-y-2 text-[var(--muted)]">
                <li><a href="#how" className="hover:text-teal-800 transition">{t.navHow}</a></li>
                <li><a href="#plans" className="hover:text-teal-800 transition">{t.navPlans}</a></li>
                <li><a href="#install" className="hover:text-teal-800 transition">{t.navInstall}</a></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[var(--ink)] mb-3">{t.footerAccount}</p>
              <ul className="space-y-2 text-[var(--muted)]">
                <li><Link to="/auth?mode=login" className="hover:text-teal-800 transition">{t.navLogin}</Link></li>
                <li><Link to="/app" className="hover:text-teal-800 transition">{t.navCabinet}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[var(--ink)] mb-3">{t.footerLegal}</p>
              <ul className="space-y-2 text-[var(--muted)]">
                <li><Link to="/policy" className="hover:text-teal-800 transition">{t.footerPrivacy}</Link></li>
                <li><Link to="/oferta" className="hover:text-teal-800 transition">{t.footerTerms}</Link></li>
                <li><Link to="/status" className="hover:text-teal-800 transition">{t.footerStatus}</Link></li>
                <li><a href="mailto:support@smolix.app" className="hover:text-teal-800 transition">support@smolix.app</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--border)] space-y-3 text-xs text-[var(--muted)]">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <span>{t.footerCopy}</span>
            <LocaleToggle locale={locale} onLocaleChange={setLocalePersisted} />
          </div>
          <p className="leading-5 max-w-4xl">{t.footerTrademarks}</p>
        </div>
      </footer>

      {!user && scrolled && (
        <div className={`landing-sticky-cta md:hidden ${!cookieOk ? 'has-cookie' : ''}`}>
          <Link
            to="/auth?mode=register"
            onClick={() => track('sticky_cta')}
            className="landing-sticky-btn"
          >
            {t.stickyCta}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {!cookieOk && (
        <div className="landing-cookie">
          <p>
            {t.cookieText}{' '}
            <Link to="/policy">{t.cookieMore}</Link>
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('smolix_cookie_ok', '1')
              } catch {
                /* ignore */
              }
              setCookieOk(true)
            }}
          >
            {t.cookieOk}
          </button>
        </div>
      )}
    </div>
  )
}