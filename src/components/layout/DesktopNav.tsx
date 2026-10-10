// Menu do cabeçalho a partir de lg: links diretos e grupos que abrem um painel ao clicar.
// O painel fecha com Esc (devolvendo o foco ao botão), ao clicar fora ou ao trocar de página.
import { CaretDown, MapPin } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { groupIsActive, type NavEntry, type NavItem, type NavSection } from '../../config/nav'
import { UFS, type Region } from '../../config/ufs'
import { cn } from '../../lib/format'

const tab = 'relative flex h-16 cursor-pointer items-center gap-1 px-3 text-sm font-medium whitespace-nowrap transition-colors'
const activeBar = 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-ink'

function Popover({
  label,
  active,
  trigger,
  panelClassName,
  children,
}: {
  label: string
  active?: boolean
  trigger?: (open: boolean) => ReactNode
  panelClassName?: string
  children: ReactNode
}) {
  // Guarda a página em que o painel abriu: trocar de página o fecha sem precisar de efeito.
  const { pathname } = useLocation()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenAt((typeof v === 'function' ? v(open) : v) ? pathname : null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenAt(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenAt(null)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={trigger ? undefined : cn(tab, open && 'bg-surface-2 text-ink', active ? activeBar : 'text-muted hover:text-ink')}
      >
        {trigger ? (
          trigger(open)
        ) : (
          <>
            {label}
            <CaretDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden />
          </>
        )}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn(
          'absolute top-full z-40 mt-px rounded-lg border border-line bg-surface p-2 shadow-[0_18px_40px_rgb(17_20_24/0.16)]',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

function PanelItem({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn('group grid grid-cols-[2.25rem_1fr] items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-surface-2', isActive && 'bg-surface-2')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md',
              isActive ? 'bg-accent text-on-accent' : 'bg-surface-2 group-hover:bg-surface',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">{item.label}</span>
            {item.hint && <span className="block text-[12.5px] text-muted">{item.hint}</span>}
          </span>
        </>
      )}
    </NavLink>
  )
}

function Panel({ sections }: { sections: NavSection[] }) {
  const filled = sections.filter((s) => s.items.length)
  return (
    <div className={cn('grid gap-x-1', filled.length > 1 ? 'w-[35rem] grid-cols-2' : 'w-[19rem]')}>
      {filled.map((s, i) => (
        <div key={s.label ?? i}>
          {s.label && <p className="px-2.5 pt-2 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{s.label}</p>}
          {s.items.map((it) => (
            <PanelItem key={it.to} item={it} />
          ))}
        </div>
      ))}
    </div>
  )
}

const REGIONS: Region[] = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

/** Atalho para a página de um estado (governador do ciclo corrente). */
export function UfPicker({ year }: { year: number }) {
  return (
    <Popover
      label="Meu estado"
      panelClassName="right-0 mt-2"
      trigger={(open) => (
        <span
          className={cn(
            'flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm font-medium transition-colors hover:border-ink-2/40 hover:text-ink',
            open ? 'bg-surface-2 text-ink' : 'bg-surface text-ink-2',
          )}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Meu estado
        </span>
      )}
    >
      <div className="grid w-[50rem] grid-cols-5 gap-x-3 p-2">
        {REGIONS.map((r) => (
          <div key={r}>
            <p className="pb-1.5 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{r}</p>
            <ul>
              {UFS.filter((u) => u.regiao === r).map((u) => (
                <li key={u.sigla}>
                  <Link
                    to={`/${year}/governador/${u.sigla.toLowerCase()}`}
                    title={u.nome}
                    className="flex min-h-8 items-center rounded px-1.5 py-1 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <span className="w-8 shrink-0 font-semibold text-ink">{u.sigla}</span>
                    <span className="text-[13px] leading-tight text-muted">{u.nome}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Popover>
  )
}

export function DesktopNav({ entries }: { entries: NavEntry[] }) {
  const { pathname } = useLocation()
  return (
    <nav className="ml-auto hidden items-center lg:flex" aria-label="Principal">
      {entries.map((e) =>
        e.kind === 'link' ? (
          <NavLink
            key={e.item.to}
            to={e.item.to}
            end={e.item.end}
            className={({ isActive }) => cn(tab, isActive ? activeBar : 'text-muted hover:text-ink')}
          >
            {e.item.label}
          </NavLink>
        ) : (
          <Popover
            key={e.label}
            label={e.label}
            active={groupIsActive(e.sections, pathname)}
            panelClassName="left-1/2 -translate-x-1/2"
          >
            <Panel sections={e.sections} />
          </Popover>
        ),
      )}
    </nav>
  )
}
