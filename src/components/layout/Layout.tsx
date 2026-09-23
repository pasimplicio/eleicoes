import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router-dom'
import { currentYear, getCycle } from '../../config/elections'
import { cn } from '../../lib/format'

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
    } catch {
      /* armazenamento indisponível */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* armazenamento indisponível */
    }
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Apuração Brasil — início">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="leading-none">
        <span className="block font-serif text-xl font-bold tracking-tight text-white">Apuração Brasil</span>
        <span className="block text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase">Eleições</span>
      </span>
    </Link>
  )
}

export function Layout() {
  const [dark, toggle] = useTheme()
  const year = currentYear()
  const cycle = getCycle(year)!
  const nav = [
    ...cycle.offices
      .filter((o) => o.system === 'majoritario')
      .map((o) => ({ to: `/${year}/${o.slug}`, label: o.name })),
    { to: '/pesquisas', label: 'Pesquisas' },
    { to: '/sobre', label: 'Fontes e metodologia' },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 bg-brand text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-white/12 text-white' : 'text-white/75 hover:text-white',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Principal (celular)">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap',
                  isActive ? 'bg-white text-brand' : 'bg-white/10 text-white/85',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-ink-2 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-serif text-lg font-bold text-ink">Apuração Brasil</p>
            <p className="mt-2 text-muted">
              Portal independente de acompanhamento eleitoral. Não é um canal oficial da Justiça Eleitoral.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Fontes oficiais</p>
            <ul className="mt-2 space-y-1">
              <li>
                <a className="hover:underline" href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">
                  Resultados — Tribunal Superior Eleitoral
                </a>
              </li>
              <li>
                <a className="hover:underline" href="https://pesqele-divulgacao.tse.jus.br" target="_blank" rel="noreferrer">
                  PesqEle — pesquisas registradas no TSE
                </a>
              </li>
              <li>
                <a className="hover:underline" href="https://www.ibge.gov.br/geociencias" target="_blank" rel="noreferrer">
                  Malhas territoriais — IBGE
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ink">Transparência</p>
            <p className="mt-2 text-muted">
              Os números exibidos vêm dos arquivos públicos de divulgação do TSE, sem edição.{' '}
              <Link to="/sobre" className="font-medium text-ink underline">
                Veja a metodologia
              </Link>
              .
            </p>
          </div>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
