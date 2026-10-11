// Busca rápida (Ctrl+K, ⌘K ou "/"): páginas, estados, municípios e candidatos a presidente.
// A lista de municípios (27 arquivos pequenos de /geo/mun) só carrega quando a busca abre.
import { Buildings, City, MagnifyingGlass, MapPin, User, type Icon } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { findOffice, type Cycle, type ElectionIds } from '../../config/elections'
import { buildNav } from '../../config/nav'
import { UFS } from '../../config/ufs'
import { cn } from '../../lib/format'
import { municipalitiesQuery, useResult } from '../../lib/tse/queries'

interface Hit {
  group: string
  label: string
  hint?: string
  to: string
  icon: Icon
  /** Texto normalizado para comparar. */
  key: string
}

/** Minúsculas e sem acentos: "São Paulo" -> "sao paulo". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Começo de palavra vale mais que trecho no meio; null quando não combina. */
function score(key: string, q: string) {
  if (key.startsWith(q)) return 0
  if (key.includes(` ${q}`)) return 1
  if (key.includes(q)) return 2
  return null
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

const LIMITS: Record<string, number> = { Páginas: 5, Estados: 5, Municípios: 8, Candidatos: 5 }

export function SearchDialog({ cycle, ids }: { cycle: Cycle; ids?: ElectionIds }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const geral = cycle.kind === 'geral'

  const lists = useQueries({ queries: UFS.map((uf) => ({ ...municipalitiesQuery(uf.sigla), enabled: open && geral })) })
  const president = findOffice(cycle, 'presidente')
  const national = useResult(
    // Sem presidente no ciclo (eleição municipal): sem ids, a consulta fica desligada.
    { cycle, ids: president ? ids : undefined, office: president ?? cycle.offices[0], turn: 1 },
    'br',
  )

  const show = () => {
    setOpen(true)
    ref.current?.showModal()
    requestAnimationFrame(() => input.current?.focus())
  }
  const hide = () => ref.current?.close()

  // Atalhos: Ctrl+K / ⌘K em qualquer lugar; "/" fora de campos de texto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        show()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const index = useMemo<Hit[]>(() => {
    const hits: Hit[] = []
    for (const e of buildNav(cycle)) {
      const items = e.kind === 'link' ? [e.item] : e.sections.flatMap((s) => s.items)
      for (const it of items) hits.push({ group: 'Páginas', label: it.label, hint: it.hint, to: it.to, icon: it.icon, key: norm(it.label) })
    }
    if (geral) {
      for (const uf of UFS) {
        hits.push({
          group: 'Estados',
          label: uf.nome,
          hint: `${uf.sigla} · governador, senador e presidente no estado`,
          to: `/${cycle.year}/governador/${uf.sigla.toLowerCase()}`,
          icon: MapPin,
          key: norm(`${uf.nome} ${uf.sigla}`),
        })
      }
      UFS.forEach((uf, i) => {
        for (const m of lists[i].data ?? []) {
          hits.push({
            group: 'Municípios',
            label: m.nome,
            hint: `${uf.nome} · resultado no município`,
            to: `/${cycle.year}/presidente/${uf.sigla.toLowerCase()}?municipio=${m.tse}`,
            icon: m.capital ? Buildings : City,
            key: norm(m.nome),
          })
        }
      })
    }
    for (const c of national.data?.candidates ?? []) {
      hits.push({
        group: 'Candidatos',
        label: c.name,
        hint: `${c.party} · presidente`,
        to: `/${cycle.year}/presidente`,
        icon: User,
        key: norm(`${c.name} ${c.number}`),
      })
    }
    return hits
    // As listas de municípios mudam de identidade a cada render; o que importa é quando chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, geral, national.data, lists.map((l) => l.dataUpdatedAt).join()])

  const results = useMemo(() => {
    const term = norm(q.trim())
    if (!term) return index.filter((h) => h.group === 'Páginas')
    const scored = index
      .map((h) => ({ h, s: score(h.key, term) }))
      .filter((x): x is { h: Hit; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || a.h.label.localeCompare(b.h.label, 'pt-BR'))
    const out: Hit[] = []
    const used: Record<string, number> = {}
    for (const { h } of scored) {
      used[h.group] = (used[h.group] ?? 0) + 1
      if (used[h.group] <= LIMITS[h.group]) out.push(h)
    }
    // Mantém os grupos na ordem fixa.
    return Object.keys(LIMITS).flatMap((g) => out.filter((h) => h.group === g))
  }, [q, index])

  const go = (h: Hit | undefined) => {
    if (!h) return
    hide()
    navigate(h.to)
  }

  const loadingCities = geral && open && lists.some((l) => l.isLoading)

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="hidden h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-muted transition-colors hover:border-ink-2/40 hover:text-ink xl:flex"
        aria-haspopup="dialog"
      >
        <MagnifyingGlass className="h-4 w-4" aria-hidden />
        Buscar
        <kbd className="rounded border border-line bg-surface-2 px-1.5 font-sans text-[11px]">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <button
        type="button"
        onClick={show}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-ink-2 transition hover:bg-surface-2 hover:text-ink sm:h-11 sm:w-11 xl:hidden"
        aria-label="Buscar"
        aria-haspopup="dialog"
      >
        <MagnifyingGlass className="h-5 w-5" />
      </button>

      <dialog
        ref={ref}
        aria-label="Buscar no site"
        className="search-dialog mx-auto mt-[max(4rem,10vh)] w-[min(40rem,calc(100vw-1.5rem))] max-w-none rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_rgb(17_20_24/0.3)] backdrop:bg-black/45"
        onClick={(e) => e.target === ref.current && hide()}
        onClose={() => {
          setOpen(false)
          setQ('')
          setActive(0)
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <MagnifyingGlass className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                go(results[active])
              }
            }}
            placeholder={geral ? 'Município, estado, candidato ou página' : 'Página ou candidato'}
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
          />
          <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 text-[11px] text-muted sm:block">Esc</kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[60vh] overflow-y-auto p-2">
          {results.map((h, i) => {
            const Ico = h.icon
            const first = i === 0 || results[i - 1].group !== h.group
            return (
              <li key={`${h.group}-${h.to}-${h.label}`} role="presentation">
                {first && <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{h.group}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => setActive(i)}
                  onClick={() => go(h)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-1.5',
                    i === active ? 'bg-surface-2' : '',
                  )}
                >
                  <Ico className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{h.label}</span>
                    {h.hint && <span className="block truncate text-xs text-muted">{h.hint}</span>}
                  </span>
                </div>
              </li>
            )
          })}
          {q.trim() && !results.length && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              {loadingCities ? 'Carregando municípios…' : `Nada encontrado para “${q.trim()}”.`}
            </li>
          )}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> para escolher · <kbd className="font-sans">Enter</kbd> para abrir
        </p>
      </dialog>
    </>
  )
}
