import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Cycle, Office } from '../../config/elections'
import { cn } from '../../lib/format'

/**
 * Abas com os cargos do ciclo, para trocar de cargo sem voltar ao menu.
 * Com `uf`, ficam só os cargos majoritários e os links mantêm o estado.
 */
export function OfficeTabs({ cycle, current, uf }: { cycle: Cycle; current: Office; uf?: string }) {
  const offices = uf ? cycle.offices.filter((o) => o.system === 'majoritario' && o.scope !== 'mu') : cycle.offices
  const scroller = useRef<HTMLElement>(null)
  const active = useRef<HTMLAnchorElement>(null)

  // No celular as abas rolam de lado: centraliza a aba ativa para ela não ficar cortada.
  useEffect(() => {
    const s = scroller.current
    const a = active.current
    if (s && a) s.scrollLeft = a.offsetLeft - (s.clientWidth - a.offsetWidth) / 2
  }, [current.slug])

  return (
    <nav ref={scroller} aria-label="Cargos" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="relative flex min-w-max gap-1 border-b border-line">
        {offices.map((o) => {
          const isActive = o.slug === current.slug
          return (
            <li key={o.slug}>
              <Link
                ref={isActive ? active : undefined}
                to={`/${cycle.year}/${o.slug}${uf ? `/${uf.toLowerCase()}` : ''}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-accent'
                    : 'text-muted hover:text-ink',
                )}
              >
                {o.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
