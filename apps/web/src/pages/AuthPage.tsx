import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import {
  login,
  register,
  getAccount,
  getRegisterAntibot,
  requestPasswordReset,
  confirmPasswordReset,
  confirmEmailVerification,
  consumeImpersonation,
} from '../api'
import SeoHead from '../components/SeoHead'
import { SEO_PAGES } from '../seo'
import { TURNSTILE_SITE_KEY } from '../config'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void },
      ) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify-email'

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/app'
  return raw
}

export default function AuthPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const resetToken = params.get('token') || ''
  const nextPath = safeNextPath(params.get('next'))

  const verifyEmailToken = params.get('mode') === 'verify-email' ? (params.get('token') || '') : ''

  const initialMode = useMemo<AuthMode>(() => {
    const mode = params.get('mode')
    if (mode === 'verify-email') return 'verify-email'
    if (mode === 'reset' || (mode !== 'verify-email' && resetToken)) return 'reset'
    if (mode === 'forgot') return 'forgot'
    if (mode === 'login') return 'login'
    if (mode === 'register') return 'register'
    return 'login'
  }, [params, resetToken])

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState(() => (params.get('ref') || '').toLowerCase())
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [formStartedAt] = useState(() => Date.now())
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(TURNSTILE_SITE_KEY)
  const [turnstileRequired, setTurnstileRequired] = useState(Boolean(TURNSTILE_SITE_KEY))
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (mode !== 'verify-email' || !verifyEmailToken) return
    let cancelled = false
    setLoading(true)
    setError('')
    setInfo('')
    confirmEmailVerification(verifyEmailToken)
      .then((result) => {
        if (!cancelled) setInfo(result.message || 'Email подтверждён')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось подтвердить email')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, verifyEmailToken])

  useEffect(() => {
    if (params.get('mode') !== 'impersonate') return
    const token = params.get('token') || ''
    if (!token) {
      setError('Ссылка просмотра неполная')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setInfo('Открываем кабинет пользователя…')
    consumeImpersonation(token)
      .then(() => {
        if (!cancelled) navigate('/app', { replace: true })
      })
      .catch((err) => {
        if (!cancelled) {
          setInfo('')
          setError(err instanceof Error ? err.message : 'Не удалось открыть кабинет')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params, navigate])

  useEffect(() => {
    getRegisterAntibot()
      .then((cfg) => {
        if (cfg.turnstileSiteKey) setTurnstileSiteKey(cfg.turnstileSiteKey)
        setTurnstileRequired(cfg.turnstileRequired || Boolean(cfg.turnstileSiteKey))
      })
      .catch(() => {
        /* optional */
      })
  }, [])

  useEffect(() => {
    if (mode !== 'register' || !turnstileSiteKey || !turnstileRef.current) return

    let cancelled = false

    const mount = () => {
      if (cancelled || !turnstileRef.current || !window.turnstile) return
      if (turnstileWidgetId.current) {
        try { window.turnstile.remove(turnstileWidgetId.current) } catch { /* ignore */ }
        turnstileWidgetId.current = null
      }
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
      })
    }

    if (window.turnstile) {
      mount()
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-smolix-turnstile]')
      if (existing) {
        existing.addEventListener('load', mount)
      } else {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.dataset.smolixTurnstile = '1'
        script.addEventListener('load', mount)
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
      if (turnstileWidgetId.current && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetId.current) } catch { /* ignore */ }
        turnstileWidgetId.current = null
      }
    }
  }, [mode, turnstileSiteKey])

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError('')
    setInfo('')
    const nextParams = new URLSearchParams(params)
    if (next === 'reset') {
      nextParams.set('mode', 'reset')
    } else {
      nextParams.set('mode', next)
      nextParams.delete('token')
    }
    setParams(nextParams, { replace: true })
  }

  const title =
    mode === 'register' ? 'Создать аккаунт'
      : mode === 'forgot' ? 'Сброс пароля'
        : mode === 'reset' ? 'Новый пароль'
          : mode === 'verify-email' ? 'Подтверждение email'
            : 'Войти в SMOLIX'

  const subtitle =
    mode === 'register' ? 'Один аккаунт для сайта, расширения и устройств.'
      : mode === 'forgot' ? 'Пришлём ссылку на email, если аккаунт существует.'
        : mode === 'reset' ? 'Задайте новый пароль и войдите заново.'
          : mode === 'verify-email' ? 'Проверяем ссылку из письма…'
            : 'Войдите, чтобы открыть кабинет.'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(email)
        setInfo(result.message)
        return
      }

      if (mode === 'reset') {
        if (!resetToken) {
          setError('Ссылка сброса недействительна. Запросите новую.')
          return
        }
        if (password.length < 8) {
          setError('Пароль должен быть не короче 8 символов.')
          return
        }
        const result = await confirmPasswordReset(resetToken, password)
        setInfo(result.message)
        setPassword('')
        switchMode('login')
        return
      }

      const isRegister = mode === 'register'
      if (isRegister) {
        if (turnstileRequired && turnstileSiteKey && !turnstileToken) {
          setError('Пройдите проверку «я не робот»')
          return
        }
        await register(email, password, {
          referralCode: referralCode || undefined,
          formStartedAt,
          turnstileToken: turnstileToken || undefined,
          website: honeypot,
        })
      } else {
        await login(email, password)
      }

      const account = await getAccount()
      if (account.user.role === 'ADMIN') {
        navigate('/admin', { replace: true })
        return
      }

      const destination = isRegister
        ? (nextPath === '/app' ? '/app?welcome=1' : `${nextPath}${nextPath.includes('?') ? '&' : '?'}welcome=1`)
        : nextPath

      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить запрос')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-5">
      <SeoHead {...SEO_PAGES.auth} />
      <div className="w-full max-w-[1000px] grid md:grid-cols-2 overflow-hidden rounded-[30px] bg-white shadow-2xl shadow-teal-900/10 border border-white">
        <div className="brand-gradient soft-grid p-9 md:p-12 text-white flex flex-col justify-between min-h-[430px] relative">
          <Link to="/" className="flex items-center gap-2.5 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <span className="text-[22px] font-extrabold tracking-[-0.3px]">SMOLIX</span>
          </Link>
          <div className="relative z-10">
            <p className="text-xs font-bold tracking-wide text-white/70 mb-4 uppercase">Chrome · Phone · TV</p>
            <h1 className="text-4xl md:text-[44px] font-bold leading-[1.12]">
              Один аккаунт.<br />Все устройства.
            </h1>
            <p className="text-white/75 mt-5 leading-7 max-w-sm">
              Расширение в браузере и ссылка подписки на телефоне, ПК и Smart TV.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70 relative z-10">
            <ShieldCheck size={17} /> Приватность начинается здесь
          </div>
        </div>

        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <p className="text-sm font-semibold text-teal-700 mb-2">
              {mode === 'register' ? 'Начните сегодня' : mode === 'login' ? 'С возвращением' : 'Безопасность'}
            </p>
            <h2 className="text-3xl font-bold tracking-normal text-[var(--ink)]">{title}</h2>
            <p className="text-sm text-[var(--muted)] mt-2">{subtitle}</p>
          </div>

          {mode === 'reset' && !resetToken && (
            <div className="mb-5 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
              В ссылке нет токена сброса.{' '}
              <button type="button" className="font-bold text-teal-800" onClick={() => switchMode('forgot')}>
                Запросить новую
              </button>
            </div>
          )}

          {mode === 'verify-email' && !verifyEmailToken && (
            <div className="mb-5 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
              В ссылке нет токена подтверждения. Запросите новое письмо в{' '}
              <Link to="/app/settings" className="font-bold text-teal-800">
                настройках кабинета
              </Link>
              .
            </div>
          )}

          {mode === 'verify-email' ? (
            <div className="space-y-5">
              {loading && (
                <p className="text-sm text-[var(--muted)]">Подождите…</p>
              )}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                  {info}
                </div>
              )}
              <Link
                to="/app"
                className="w-full h-12 rounded-xl brand-gradient text-white font-bold shadow-lg shadow-teal-200 hover:shadow-teal-300 hover:-translate-y-0.5 transition flex items-center justify-center gap-2"
              >
                В кабинет <ArrowRight size={18} />
              </Link>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-sm font-bold text-teal-700 hover:text-teal-900"
              >
                Войти
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5 relative" autoComplete="on">
            {mode === 'register' && (
              <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </label>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div>
                <label className="text-sm font-semibold text-[var(--ink)] block mb-2">Электронная почта</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-[var(--border)] bg-[var(--canvas-band)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div>
                <label className="text-sm font-semibold text-[var(--ink)] block mb-2">
                  {mode === 'reset' ? 'Новый пароль' : 'Пароль'}
                </label>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type={visible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Не менее 8 символов"
                    autoComplete={mode === 'reset' ? 'new-password' : mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full h-12 pl-11 pr-12 rounded-xl border border-[var(--border)] bg-[var(--canvas-band)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="text-sm font-semibold text-[var(--ink)] block mb-2">Реферальный код</label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.trim().toLowerCase())}
                  placeholder="необязательно"
                  maxLength={16}
                  className="w-full h-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--canvas-band)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition"
                />
                <p className="text-xs text-[var(--muted)] mt-2">
                  Бонус пригласившему начислится после входа в расширение или оплаты Premium.
                </p>
              </div>
            )}

            {mode === 'register' && turnstileSiteKey && (
              <div ref={turnstileRef} className="min-h-[65px]" />
            )}

            {mode === 'login' && (
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900"
                >
                  Забыли пароль?
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                {info}
              </div>
            )}

            <button
              disabled={loading || (mode === 'reset' && !resetToken)}
              className="w-full h-12 rounded-xl brand-gradient text-white font-bold shadow-lg shadow-teal-200 hover:shadow-teal-300 hover:-translate-y-0.5 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading
                ? 'Подождите...'
                : mode === 'register' ? 'Создать аккаунт'
                  : mode === 'forgot' ? 'Отправить ссылку'
                    : mode === 'reset' ? 'Сохранить пароль'
                      : 'Войти'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          )}

          {mode !== 'verify-email' && (
          <p className="text-center text-sm text-[var(--muted)] mt-7">
            {mode === 'register' ? (
              <>
                Уже есть аккаунт?{' '}
                <button type="button" onClick={() => switchMode('login')} className="font-bold text-teal-700 hover:text-teal-900">
                  Войти
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                Ещё нет аккаунта?{' '}
                <button type="button" onClick={() => switchMode('register')} className="font-bold text-teal-700 hover:text-teal-900">
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Вспомнили пароль?{' '}
                <button type="button" onClick={() => switchMode('login')} className="font-bold text-teal-700 hover:text-teal-900">
                  Войти
                </button>
              </>
            )}
          </p>
          )}
        </div>
      </div>
    </div>
  )
}
