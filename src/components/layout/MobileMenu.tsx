// Menu lateral retrátil para celular e tablet (abaixo de lg). Usa <dialog> modal:
// prende o foco, fecha com Esc, ao tocar no fundo, pelo botão ou ao escolher uma página.
import { CaretDown, List, MapPin, X } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { NavEntry, NavItem } from '../../config/nav'
import { UFS } from '../../config/ufs'
import { cn } from '../../lib/format'

function Item({ item, onPick }: { item: NavItem; onPick: () => void }) {
  const Icon = item.icon
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onPick}
        className={({ isActive }) =>
          cn(
            'flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
            isActive
              ? 'bg-surface-2 font-semibold text-ink shadow-[inset_3px_0_0_var(--color-accent)]'
              : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          )
        }
      >
        <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        {item.label}
      </NavLink>
    </li>
  )
}

export function MobileMenu({ entries, ufYear }: { entries: NavEntry[]; ufYear?: number }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()

  // Troca de página fecha o menu.
  useEffect(() => {
    ref.current?.close()
  }, [pathname])

  const abrir = () => ref.current?.showModal()
  const fechar = () => ref.current?.close()

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-ink transition hover:bg-surface-2 lg:hidden"
        aria-label="Abrir menu"
        aria-haspopup="dialog"
      >
        <List className="h-6 w-6" />
      </button>

      <dialog
        ref={ref}
        aria-label="Menu principal"
        className="mobile-menu m-0 ml-auto h-dvh max-h-dvh w-[min(86vw,20rem)] max-w-none border-l border-line bg-surface p-0 text-ink backdrop:bg-black/45"
        onClick={(e) => e.target === ref.current && fechar()}
      >
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="font-serif text-xl font-semibold tracking-tight">Menu</span>
            <button
              type="button"
              onClick={fechar}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ufYear && (
              <details className="group mx-3 mt-3 rounded-lg border border-line bg-surface-2">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                  <MapPin className="h-5 w-5" aria-hidden />
                  Meu estado
                  <span className="ml-auto flex items-center gap-1 text-sm font-normal text-muted">
                    Escolher
                    <CaretDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                  </span>
                </summary>
                <ul className="grid grid-cols-4 gap-1 px-2 pb-2">
                  {[...UFS].sort((a, b) => a.sigla.localeCompare(b.sigla)).map((u) => (
                    <li key={u.sigla}>
                      <Link
                        to={`/${ufYear}/governador/${u.sigla.toLowerCase()}`}
                        onClick={fechar}
                        aria-label={u.nome}
                        className="flex min-h-10 items-center justify-center rounded-md bg-surface text-sm font-semibold hover:bg-page"
                      >
                        {u.sigla}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <nav aria-label="Principal" className="p-3 pt-2">
              {entries.map((e) =>
                e.kind === 'link' ? (
                  <ul key={e.item.to} className="py-0.5">
                    <Item item={e.item} onPick={fechar} />
                  </ul>
                ) : (
                  <div key={e.label} className="pt-3">
                    <p className="px-3 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{e.label}</p>
                    <ul className="space-y-0.5">
                      {e.sections.flatMap((s) => s.items).map((it) => (
                        <Item key={it.to} item={it} onPick={fechar} />
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </nav>
          </div>
          <p className="shrink-0 border-t border-line px-6 py-4 text-xs text-muted">
            Dados oficiais do TSE. Portal independente.
          </p>
        </div>
      </dialog>
    </>
  )
}
