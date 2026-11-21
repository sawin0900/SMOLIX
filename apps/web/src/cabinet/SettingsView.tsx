import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Download, LifeBuoy, LockKeyhole, Smartphone } from 'lucide-react'
import {
  changePassword,
  getWebSessions,
  revokeWebSession,
  revokeOtherWebSessions,
  requestEmailVerification,
  type User,
} from '../api'
import { SUPPORT_EMAIL } from '../brand'
import { CABINET_COPY } from '../i18n/cabinet'
import type { Locale } from '../i18n/landing'
import { formatDate } from './format'
import { Skeleton } from './Skeleton'

export function SettingsView({
  user,
  locale,
  onLocaleChange,
  onPasswordChanged,
  onError,
  onToast,
  onUserRefresh,
}: {
  user: User
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  onPasswordChanged: () => void
  onError: (message: string) => void
  onToast: (message: string, type?: 'success' | 'error') => void
  onUserRefresh: () => Promise<void>
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null)
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false)
  const t = CABINET_COPY[locale]
  const en = locale === 'en'

  const supportCode = user.supportCode || '—'

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const res = await getWebSessions()
      setSessions(res.sessions)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions().catch(() => undefined)
  }, [])

  const copyText = async (label: string, value: string) => {
    if (!value || value === '—') return
    try {
      await navigator.clipboard.writeText(value)
      onToast(t.settingsCopied, 'success')
    } catch {
      onError(en ? `Could not copy ${label}` : `Не удалось скопировать ${label}`)
    }
  }

  const supportMailto = useMemo(() => {
    const subject = encodeURIComponent(`jetsale.online ${supportCode}`)
    const body = encodeURIComponent(
      `${en ? 'Email' : 'Email'}: ${user.email}\n${t.settingsUserId}: ${user.id}\n${t.settingsSupportCode}: ${supportCode}\n\n`,
    )
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }, [user.email, user.id, supportCode, t, en])

  const requestVerify = async () => {
    setVerifyBusy(true)
    try {
      const result = await requestEmailVerification()
      onToast(result.message || t.settingsVerifyEmailSent, 'success')
    } catch (err) {
      onError(err instanceof Error ? err.message : en ? 'Could not send email' : 'Не удалось отправить письмо')
    } finally {
      setVerifyBusy(false)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      onPasswordChanged()
    } catch (error) {
      onError(error instanceof Error ? error.message : en ? 'Could not change password' : 'Не удалось сменить пароль')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="text-sm text-teal-700 font-semibold mb-2">{en ? 'Account' : 'Аккаунт'}</p>
      <h1 className="text-3xl font-bold tracking-normal">{en ? 'Settings' : 'Настройки'}</h1>
      <p className="text-[var(--muted)] text-sm mt-2 mb-8">
        {en ? 'Profile, language and password.' : 'Профиль, язык и смена пароля.'}
      </p>

      {!user.emailVerifiedAt && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 mb-5 max-w-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-bold text-amber-900">{t.settingsVerifyEmailTitle}</p>
            <p className="text-sm text-amber-800/80 mt-1">{t.settingsVerifyEmailText}</p>
          </div>
          <button
            type="button"
            disabled={verifyBusy}
            onClick={requestVerify}
            className="rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold w-fit disabled:opacity-60"
          >
            {verifyBusy ? '…' : t.settingsVerifyEmailBtn}
          </button>
        </section>
      )}

      <div className="glass-card rounded-2xl p-6 max-w-2xl mb-5">
        <h3 className="font-bold mb-5">{en ? 'Profile' : 'Профиль'}</h3>
        <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
          <div className="w-14 h-14 rounded-2xl brand-gradient text-white flex items-center justify-center font-bold text-lg">
            {user.email.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold">{user.email}</p>
            <p className="text-sm text-[var(--muted)]">{en ? 'Role' : 'Роль'}: {user.role || 'USER'}</p>
          </div>
        </div>
        <div className="pt-5 grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{en ? 'Email' : 'Электронная почта'}</p>
            <p className="font-semibold text-sm break-all">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{en ? 'Language' : 'Язык кабинета'}</p>
            <div className="mt-1 inline-flex rounded-xl border border-[var(--border)] overflow-hidden">
              {(['ru', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLocaleChange(code)}
                  className={`px-3 py-2 text-xs font-bold ${locale === code ? 'brand-gradient text-white' : 'bg-white text-[var(--muted)]'}`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid sm:grid-cols-2 gap-4 pt-5 border-t border-[var(--border)]">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{t.settingsSupportCode}</p>
            <div className="flex items-center gap-2">
              <p className="font-mono font-bold text-sm">{supportCode}</p>
              <button
                type="button"
                onClick={() => copyText(t.settingsSupportCode, supportCode)}
                className="text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1"
              >
                <Copy size={13} /> {t.settingsCopy}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">{t.settingsUserId}</p>
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-mono text-xs break-all">{user.id}</p>
              <button
                type="button"
                onClick={() => copyText(t.settingsUserId, user.id)}
                className="text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <Copy size={13} /> {t.settingsCopy}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={supportMailto}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient text-white px-4 py-2.5 text-sm font-bold"
          >
            <LifeBuoy size={15} /> {t.settingsContactSupport}
          </a>
          <Link to="/install" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
            <Download size={15} /> {en ? 'Install guide' : 'Инструкция'}
          </Link>
          <Link to="/app/vpn" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold">
            <Smartphone size={15} /> {en ? 'VPN link' : 'VPN-ссылка'}
          </Link>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 max-w-2xl mb-5">
        <h3 className="font-bold mb-1">{t.settingsWebSessions}</h3>
        <p className="text-xs text-[var(--muted)] mb-4">{t.settingsWebSessionsHint}</p>
        {sessionsLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">—</p>
        ) : (
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">
            {sessions.map((session) => (
              <div key={session.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-white">
                <div>
                  <p className="font-semibold">
                    {formatDate(session.createdAt)}
                    {session.current && (
                      <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                        {t.settingsSessionCurrent}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {en ? 'Expires' : 'До'} {formatDate(session.expiresAt)}
                  </p>
                </div>
                {!session.current && (
                  <button
                    type="button"
                    disabled={sessionBusyId === session.id}
                    onClick={async () => {
                      setSessionBusyId(session.id)
                      try {
                        const result = await revokeWebSession(session.id)
                        onToast(result.message, 'success')
                        await loadSessions()
                        await onUserRefresh().catch(() => undefined)
                      } catch (err) {
                        onError(err instanceof Error ? err.message : 'Ошибка')
                      } finally {
                        setSessionBusyId(null)
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {sessionBusyId === session.id ? '…' : t.settingsRevokeSession}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {sessions.some((s) => !s.current) && (
          <button
            type="button"
            disabled={revokeOthersBusy}
            onClick={async () => {
              setRevokeOthersBusy(true)
              try {
                const result = await revokeOtherWebSessions()
                onToast(result.message, 'success')
                await loadSessions()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Ошибка')
              } finally {
                setRevokeOthersBusy(false)
              }
            }}
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2.5 text-sm font-bold hover:bg-rose-100 disabled:opacity-60"
          >
            {revokeOthersBusy ? '…' : t.settingsRevokeOthers}
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 max-w-2xl space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <LockKeyhole size={18} className="text-teal-700" />
          <h3 className="font-bold">{en ? 'Change password' : 'Сменить пароль'}</h3>
        </div>
        <label className="block text-sm font-semibold">
          {en ? 'Current password' : 'Текущий пароль'}
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] px-4 outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500"
          />
        </label>
        <label className="block text-sm font-semibold">
          {en ? 'New password' : 'Новый пароль'}
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] px-4 outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl brand-gradient text-white font-bold disabled:opacity-60"
        >
          {busy ? (en ? 'Saving…' : 'Сохраняем…') : (en ? 'Update password' : 'Сменить пароль')}
        </button>
        <p className="text-xs text-[var(--muted)]">
          {en
            ? 'Changing password signs you out of the site and extension sessions.'
            : 'После смены пароля все сессии сайта и расширения будут сброшены.'}
        </p>
      </form>
    </>
  )
}
