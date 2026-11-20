import { useState } from 'react'
import {
  ShieldCheck, Zap, Globe2, ChevronDown, ArrowUpRight,
  Activity, Clock3, Settings, LayoutDashboard, CreditCard,
  LifeBuoy, LogOut, Menu, X, Check, LockKeyhole, Mail,
  Eye, EyeOff, ArrowRight, Sparkles
} from 'lucide-react'

type Page = 'dashboard' | 'subscription' | 'settings' | 'auth'
type AuthMode = 'login' | 'register'

const servers = [
  { id: 'nl', flag: '🇳🇱', name: 'Нидерланды', city: 'Амстердам', ping: '24 мс' },
  { id: 'de', flag: '🇩🇪', name: 'Германия', city: 'Франкфурт', ping: '31 мс' },
  { id: 'fi', flag: '🇫🇮', name: 'Финляндия', city: 'Хельсинки', ping: '38 мс' },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 rounded-2xl purple-gradient flex items-center justify-center shadow-lg shadow-violet-200">
        <ShieldCheck size={23} className="text-white" />
      </div>
      <span className="text-[22px] font-black tracking-[-0.4px] text-[#201b3c]">
        SMOL<span className="text-violet-600">IX</span>
      </span>
    </div>
  )
}

function AuthScreen({ onSuccess, initialMode }: { onSuccess: () => void; initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-5">
      <div className="w-full max-w-[1000px] grid md:grid-cols-2 overflow-hidden rounded-[30px] bg-white shadow-2xl shadow-violet-100 border border-white">
        <div className="purple-gradient soft-grid p-9 md:p-12 text-white flex flex-col justify-between min-h-[430px]">
          <Brand />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold mb-6">
              <Sparkles size={14} /> Интернет без границ
            </div>
            <h1 className="text-4xl md:text-[44px] font-bold leading-[1.12] tracking-normal">
              Твой интернет.<br />Твои правила.
            </h1>
            <p className="text-white/75 mt-5 leading-7 max-w-sm">
              Подключайся к любимым сайтам через защищённое соединение прямо в браузере.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <ShieldCheck size={17} /> Приватность начинается здесь
          </div>
          <div className="absolute" />
        </div>

        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <p className="text-sm font-semibold text-violet-600 mb-2">
              {mode === 'register' ? 'НАЧНИ СЕГОДНЯ' : 'С РАДОСТЬЮ ВИДИМ СНОВА'}
            </p>
            <h2 className="text-3xl font-bold tracking-normal text-[#201b3c]">
              {mode === 'register' ? 'Создать аккаунт' : 'С возвращением'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {mode === 'register' ? 'Зарегистрируйся в SMOLIX за минуту.' : 'Войди в свой аккаунт SMOLIX.'}
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSuccess() }} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Электронная почта</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 transition" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Пароль</label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input required minLength={8} type={visible ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Не менее 8 символов"
                  className="w-full h-12 pl-11 pr-12 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 transition" />
                <button type="button" onClick={() => setVisible(!visible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button className="w-full h-12 rounded-xl purple-gradient text-white font-bold shadow-lg shadow-violet-200 hover:shadow-violet-300 hover:-translate-y-0.5 transition flex items-center justify-center gap-2">
              {mode === 'register' ? 'Создать аккаунт' : 'Войти'} <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-7">
            {mode === 'register' ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'}{' '}
            <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              className="font-bold text-violet-600 hover:text-violet-800">
              {mode === 'register' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </p>
          <p className="text-[11px] text-slate-400 text-center mt-8 leading-5">
            Демо-режим интерфейса. Настоящая регистрация будет подключена к серверу на следующем этапе.
          </p>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [connected, setConnected] = useState(false)
  const [selectedServer, setSelectedServer] = useState('nl')
  
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(true)

  

  const enterAuth = (mode: AuthMode = 'register') => {
    setAuthMode(mode)
    setPage('auth')
    setMobileOpen(false)
  }

  const finishAuth = () => {
    setSignedIn(true)
    setPage('dashboard')
  }

  if (page === 'auth' || !signedIn) {
    return <AuthScreen onSuccess={finishAuth} initialMode={authMode} />
  }

  const navItems = [
    { id: 'dashboard' as Page, label: 'Обзор', icon: LayoutDashboard },
    { id: 'subscription' as Page, label: 'Подписка', icon: CreditCard },
    { id: 'settings' as Page, label: 'Настройки', icon: Settings },
  ]

  return (
    <div className="min-h-screen app-bg text-[#211d3a]">
      <header className="h-[76px] bg-white/85 backdrop-blur-xl border-b border-[#eeecf5] flex items-center justify-between px-5 md:px-9 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl hover:bg-slate-100">
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Brand />
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Добро пожаловать в SMOLIX
        </div>
        <button onClick={() => enterAuth('login')} className="flex items-center gap-2 rounded-full bg-violet-50 pl-2 pr-4 py-1.5 hover:bg-violet-100 transition">
          <div className="w-8 h-8 rounded-full purple-gradient text-white flex items-center justify-center text-xs font-bold">SM</div>
          <span className="text-sm font-semibold hidden sm:block">Мой аккаунт</span>
          <ChevronDown size={15} className="text-slate-400" />
        </button>
      </header>

      <div className="max-w-[1440px] mx-auto flex">
        <aside className={`${mobileOpen ? 'flex' : 'hidden'} md:flex fixed md:sticky top-[76px] left-0 z-20 w-[260px] h-[calc(100vh-76px)] bg-white border-r border-[#eeecf5] p-5 flex-col`}>
          <div className="text-[10px] tracking-[1.8px] font-bold text-slate-400 px-3 mb-3 mt-3">МЕНЮ</div>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button key={item.id} onClick={() => { setPage(item.id); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition ${active ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                  <Icon size={19} /> {item.label}
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-600" />}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-[#f1edff] to-[#e9f2ff] border border-white">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-violet-600 mb-3 shadow-sm">
                <LifeBuoy size={19} />
              </div>
              <p className="font-bold text-sm">Нужна помощь?</p>
              <p className="text-xs text-slate-500 mt-1 leading-5">Мы поможем разобраться с подключением.</p>
              <button className="mt-3 text-xs font-bold text-violet-700 flex items-center gap-1">
                Поддержка <ArrowUpRight size={13} />
              </button>
            </div>
            <button onClick={() => { setSignedIn(false); setConnected(false) }}
              className="mt-4 flex items-center gap-3 px-3 py-3 w-full rounded-xl text-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition">
              <LogOut size={18} /> Выйти из аккаунта
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-5 md:p-9 lg:p-10">
          {page === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <p className="text-sm text-violet-600 font-semibold mb-2">ТВОЁ ПРОСТРАНСТВО</p>
                  <h1 className="text-3xl md:text-[34px] font-bold tracking-normal">Привет, добро пожаловать! 👋</h1>
                  <p className="text-slate-500 mt-2 text-sm">Управляй своим подключением в одном месте.</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-slate-100 rounded-full px-3 py-2 w-fit">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Демо-режим
                </div>
              </div>

              <section className="purple-gradient soft-grid rounded-[28px] p-6 md:p-9 text-[#211d3a] relative overflow-hidden shadow-xl shadow-violet-200/60">
                <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full border border-white/10" />
                <div className="absolute right-10 -bottom-40 w-80 h-80 rounded-full border border-white/10" />
                <div className="relative z-10 grid lg:grid-cols-[1fr_280px] gap-8 items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-white/80 border border-white rounded-full px-3 py-1.5 text-xs font-bold text-[#4935a8]">
                      <Sparkles size={14} /> SMOLIX PROTECTION
                    </div>
                    <h2 className="text-3xl md:text-[40px] font-bold tracking-normal mt-5 leading-tight">
                      Твой браузер.<br />Твоя свобода.
                    </h2>
                    <p className="text-[#292344] text-sm mt-3 max-w-md leading-6">
                      Защити браузерное соединение и выбирай удобную локацию для подключения.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-7">
                      <button onClick={() => setConnected(!connected)}
                        className={`rounded-xl px-5 py-3.5 font-bold text-sm flex items-center gap-2 transition hover:-translate-y-0.5 ${connected ? 'bg-emerald-400 text-emerald-950' : 'bg-[#211d3a] text-white hover:bg-[#39305e]'}`}>
                        {connected ? <Check size={18} /> : <Zap size={18} />}
                        {connected ? 'Демо включено' : 'Попробовать интерфейс'}
                      </button>
                      <button onClick={() => setPage('subscription')}
                        className="rounded-xl px-5 py-3.5 font-semibold text-sm bg-white text-[#211d3a] border border-white hover:bg-violet-100 transition">
                        Моя подписка
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-[210px] h-[210px] rounded-full border border-white/20 bg-white/10 flex items-center justify-center relative">
                      <div className="absolute inset-4 rounded-full border border-white/20" />
                      <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition ${connected ? 'bg-emerald-300 text-emerald-950 shadow-emerald-300/30' : 'bg-white text-violet-600 shadow-violet-950/20'}`}>
                        <ShieldCheck size={62} strokeWidth={1.5} />
                      </div>
                      <span className="absolute -bottom-1 bg-white text-violet-700 text-[11px] font-bold px-4 py-2 rounded-full shadow-lg">
                        {connected ? 'АКТИВЕН · ДЕМО' : 'ОЖИДАНИЕ'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Статус аккаунта</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck size={19} /></div>
                  </div>
                  <p className="text-xl font-bold mt-4">Демо-аккаунт</p>
                  <p className="text-xs text-slate-400 mt-1">Регистрация ещё не подключена</p>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Время подключения</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Clock3 size={19} /></div>
                  </div>
                  <p className="text-xl font-bold mt-4">{connected ? '00:01:24' : '—'}</p>
                  <p className="text-xs text-slate-400 mt-1">Демонстрационный показатель</p>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Передано данных</span>
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Activity size={19} /></div>
                  </div>
                  <p className="text-xl font-bold mt-4">{connected ? '12.8 MB' : '0 MB'}</p>
                  <p className="text-xs text-slate-400 mt-1">Демонстрационный показатель</p>
                </div>
              </div>

              <section className="glass-card rounded-2xl p-5 md:p-6 mt-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-lg">Выбери локацию</h3>
                    <p className="text-xs text-slate-400 mt-1">Выбери сервер для будущего подключения</p>
                  </div>
                  <Globe2 className="text-violet-500" size={22} />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  {servers.map(server => (
                    <button key={server.id} onClick={() => setSelectedServer(server.id)}
                      className={`text-left rounded-xl p-4 border transition ${selectedServer === server.id ? 'border-violet-400 bg-violet-50/70 ring-2 ring-violet-100' : 'border-slate-100 hover:border-violet-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{server.flag}</span>
                        {selectedServer === server.id && <Check size={17} className="text-violet-600" />}
                      </div>
                      <p className="font-bold mt-3 text-sm">{server.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-400">{server.city}</span>
                        <span className="text-xs font-semibold text-emerald-600">{server.ping}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-6 text-xs text-slate-400">
                <span>SMOLIX · Твой интернет, твои правила.</span>
                <span>Версия интерфейса 0.1.0</span>
              </div>
            </>
          )}

          {page === 'subscription' && (
            <>
              <p className="text-sm text-violet-600 font-semibold mb-2">ТВОЙ ДОСТУП</p>
              <h1 className="text-3xl font-bold tracking-normal">Подписка</h1>
              <p className="text-slate-500 text-sm mt-2 mb-8">Управление тарифом и доступом SMOLIX.</p>
              <div className="glass-card rounded-3xl p-7 max-w-2xl">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center"><CreditCard size={24} /></div>
                  <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full">Не оформлена</span>
                </div>
                <h2 className="text-2xl font-bold mt-5">SMOLIX Free</h2>
                <p className="text-sm text-slate-500 mt-2">Тарифы и оплата появятся после запуска платёжной системы.</p>
                <div className="border-t border-slate-100 mt-6 pt-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Личный кабинет</div>
                  <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Управление настройками</div>
                  <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Выбор локации в интерфейсе</div>
                </div>
                <button disabled className="mt-7 w-full rounded-xl bg-slate-100 text-slate-400 py-3 font-semibold cursor-not-allowed">Оплата скоро появится</button>
              </div>
            </>
          )}

          {page === 'settings' && (
            <>
              <p className="text-sm text-violet-600 font-semibold mb-2">ПЕРСОНАЛИЗАЦИЯ</p>
              <h1 className="text-3xl font-bold tracking-normal">Настройки</h1>
              <p className="text-slate-500 text-sm mt-2 mb-8">Управляй параметрами своего аккаунта.</p>
              <div className="glass-card rounded-2xl p-6 max-w-2xl">
                <h3 className="font-bold mb-5">Профиль</h3>
                <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                  <div className="w-14 h-14 rounded-2xl purple-gradient text-white flex items-center justify-center font-bold text-lg">SM</div>
                  <div><p className="font-bold">Демо-пользователь</p><p className="text-sm text-slate-400">Аккаунт для предварительного просмотра</p></div>
                </div>
                <div className="py-5 border-b border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Электронная почта</p>
                  <p className="font-semibold text-sm">user@smolix.local</p>
                </div>
                <div className="pt-5 flex items-center justify-between">
                  <div><p className="font-semibold text-sm">Безопасность</p><p className="text-xs text-slate-400 mt-1">Настройки пароля и входа</p></div>
                  <LockKeyhole className="text-violet-500" />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App



