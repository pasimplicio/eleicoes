import { Moon, Sun } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router-dom'
import { cn, fmtDateLong } from '../../lib/format'
import { resultsStart, useFeaturedCycle } from '../../lib/phase'
import { CountdownInline } from '../Countdown'
import { Container, LiveBadge } from '../ui'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
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

function Wordmark() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Apuração Brasil, página inicial">
      <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-md dark:ring-1 dark:ring-white/20" />
      <span className="font-serif text-[1.4rem] leading-none font-semibold tracking-tight">Apuração Brasil</span>
    </Link>
  )
}

/** Faixa de status da eleição corrente: contagem regressiva ou "ao vivo". */
function ElectionBar() {
  const f = useFeaturedCycle()
  return (
    <div className="bg-brand text-on-brand">
      <Container className="flex min-h-9 items-center gap-x-4 py-1.5 text-[13px] whitespace-nowrap">
        <span className="font-semibold">
          Eleições <span className="hidden sm:inline">{f.cycle.kind === 'geral' ? 'Gerais ' : 'Municipais '}</span>
          {f.cycle.year}
        </span>
        {f.live ? (
          <LiveBadge />
        ) : f.started ? (
          <span className="text-on-brand/70">Resultados finais</span>
        ) : (
          <>
            <span className="hidden text-on-brand/70 sm:inline">1º turno em {fmtDateLong(f.cycle.dates[1])}</span>
            <span className="ml-auto text-on-brand/70">
              <span className="hidden sm:inline">Divulgação começa em </span>
              <span className="sm:hidden">Resultados em </span>
              <strong className="font-semibold text-accent">
                <CountdownInline to={resultsStart(f.cycle.dates[1])} />
              </strong>
            </span>
          </>
        )}
      </Container>
    </div>
  )
}

export function Layout() {
  const [dark, toggle] = useTheme()
  const f = useFeaturedCycle()
  const nav = [
    { to: '/', label: 'Início', end: true },
    ...f.cycle.offices
      .filter((o) => o.system === 'majoritario')
      .map((o) => ({ to: `/${f.cycle.year}/${o.slug}`, label: o.name, end: false })),
    { to: '/pesquisas', label: 'Pesquisas', end: false },
    { to: '/sobre', label: 'Metodologia', end: false },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <ElectionBar />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/92 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-surface">
        <Container className="flex h-16 items-center gap-6">
          <Wordmark />
          <nav className="ml-auto hidden items-center lg:flex" aria-label="Principal">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-16 items-center px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-ink'
                      : 'text-muted hover:text-ink',
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
            className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-ink-2 transition hover:bg-surface-2 hover:text-ink lg:ml-0"
            aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </Container>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-line px-3 [scrollbar-width:none] lg:hidden"
          aria-label="Principal (celular)"
        >
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-11 shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap',
                  isActive
                    ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-ink'
                    : 'text-muted',
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

      <footer className="mt-24 border-t border-line bg-surface">
        <Container className="grid gap-10 py-12 text-sm md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-sm leading-relaxed text-muted">
              Portal independente de acompanhamento eleitoral. Não é um canal oficial da Justiça Eleitoral.
            </p>
          </div>
          <div>
            <p className="font-semibold">Fontes oficiais</p>
            <ul className="mt-3 space-y-2 text-ink-2">
              <li>
                <a className="hover:text-ink hover:underline" href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">
                  Resultados do TSE
                </a>
              </li>
              <li>
                <a className="hover:text-ink hover:underline" href="https://pesqele-divulgacao.tse.jus.br" target="_blank" rel="noreferrer">
                  PesqEle, pesquisas registradas
                </a>
              </li>
              <li>
                <a className="hover:text-ink hover:underline" href="https://www.ibge.gov.br/geociencias" target="_blank" rel="noreferrer">
                  Malhas territoriais do IBGE
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Transparência</p>
            <p className="mt-3 leading-relaxed text-muted">
              Os números vêm dos arquivos públicos de divulgação do TSE, sem edição.{' '}
              <Link to="/sobre" className="font-medium text-ink underline underline-offset-2">
                Metodologia
              </Link>
            </p>
          </div>
        </Container>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
