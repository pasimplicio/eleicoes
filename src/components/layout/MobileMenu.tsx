// Menu lateral retrátil para celular, tablet e notebook pequeno (abaixo de xl). Usa <dialog> modal:
// prende o foco, fecha com Esc, ao tocar no fundo, pelo botão ou ao escolher uma página.
import { List, X } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/format'

export interface MenuItem {
  to: string
  label: string
  end: boolean
}

export function MobileMenu({ items }: { items: MenuItem[] }) {
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
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-ink transition hover:bg-surface-2 xl:hidden"
        aria-label="Abrir menu"
        aria-haspopup="dialog"
      >
        <List className="h-6 w-6" />
      </button>

      <dialog
        ref={ref}
        aria-label="Menu principal"
        className="mobile-menu m-0 ml-auto h-dvh max-h-dvh w-[min(84vw,20rem)] max-w-none border-l border-line bg-surface p-0 text-ink backdrop:bg-black/45"
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
          <nav aria-label="Principal" className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-0.5">
              {items.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    onClick={fechar}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-12 items-center rounded-md px-4 text-[15px] font-medium transition-colors',
                        isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn('mr-3 h-5 w-1 rounded-full', isActive ? 'bg-accent' : 'bg-transparent')}
                          aria-hidden
                        />
                        {n.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <p className="shrink-0 border-t border-line px-6 py-4 text-xs text-muted">
            Dados oficiais do TSE. Portal independente.
          </p>
        </div>
      </dialog>
    </>
  )
}
