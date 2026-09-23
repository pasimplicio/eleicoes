import { CaretRight, MagnifyingGlass, MapPin, X } from '@phosphor-icons/react'
import { useId, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { HeadToHead, Scoreboard, SectionsProgress, TotalsStrip } from '../components/results/Scoreboard'
import { Container, EmptyState, Segmented, Skeleton } from '../components/ui'
import { findOffice, getCycle, type Turn } from '../config/elections'
import { partyColor } from '../config/parties'
import { findUf, inUf, ofUf, type Uf } from '../config/ufs'
import { shade } from '../lib/colors'
import { cn, fmtPct } from '../lib/format'
import { defaultTurn } from '../lib/phase'
import {
  useCityResult,
  useElectionIds,
  useMunicipalities,
  useMunicipalLeaders,
  useResult,
  type Municipality,
} from '../lib/tse/queries'
import { NotFound } from './NotFound'

export function StatePage() {
  const params = useParams()
  const [search, setSearch] = useSearchParams()
  const cycle = getCycle(Number(params.ano))
  const office = cycle && findOffice(cycle, params.cargo)
  const uf = findUf(params.uf)
  const { ids } = useElectionIds(cycle?.year ?? 0)

  if (!cycle || !office || !uf || office.scope === 'mu') return <NotFound />

  const q = Number(search.get('turno'))
  const turn: Turn = !office.hasRunoff ? 1 : q === 1 || q === 2 ? q : defaultTurn(cycle, Boolean(ids?.[2]))
  const mun = search.get('municipio') ?? undefined

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setSearch(next, { replace: true })
  }

  return (
    <StateView
      key={`${cycle.year}-${office.slug}-${uf.sigla}`}
      target={{ cycle, ids, office, turn }}
      uf={uf}
      mun={mun}
      onTurn={(t) => update({ turno: String(t) })}
      onCity={(m) => update({ municipio: m })}
    />
  )
}

type Target = Parameters<typeof useResult>[0]

function StateView({
  target,
  uf,
  mun,
  onTurn,
  onCity,
}: {
  target: Target
  uf: Uf
  mun?: string
  onTurn: (t: Turn) => void
  onCity: (m?: string) => void
}) {
  const { cycle, office, turn, ids } = target
  const ufl = uf.sigla.toLowerCase()
  const state = useResult(target, ufl)
  const city = useCityResult(target, uf.sigla, mun)
  const leaders = useMunicipalLeaders(target, uf.sigla)
  const { data: municipalities } = useMunicipalities(uf.sigla)

  const byIbge = useMemo(
    () => Object.fromEntries((municipalities ?? []).map((m) => [m.ibge, m])) as Record<string, Municipality>,
    [municipalities],
  )
  const byTse = useMemo(
    () => Object.fromEntries((municipalities ?? []).map((m) => [m.tse, m])) as Record<string, Municipality>,
    [municipalities],
  )
  const selected = mun ? byTse[mun] : undefined
  const lead = (ibge: string) => leaders.data?.leaders[byIbge[ibge]?.tse]

  const shown = mun ? city : state
  const decidedInFirst = turn === 2 && state.data?.turn === 1
  const showStatus = office.scope === 'uf' && !selected
  const nationalHref = `/${cycle.year}/${office.slug}?turno=${turn}`

  return (
    <Container className="pt-6 sm:pt-8">
      <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to={nationalHref} className="hover:text-ink hover:underline">
          {office.name} {cycle.year}
        </Link>
        <CaretRight className="h-3.5 w-3.5" aria-hidden />
        {selected ? (
          <button type="button" onClick={() => onCity(undefined)} className="cursor-pointer hover:text-ink hover:underline">
            {uf.nome}
          </button>
        ) : (
          <span aria-current="page" className="text-ink">
            {uf.nome}
          </span>
        )}
        {selected && (
          <>
            <CaretRight className="h-3.5 w-3.5" aria-hidden />
            <span aria-current="page" className="text-ink">
              {selected.nome}
            </span>
          </>
        )}
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">{uf.nome}</h1>
        {office.hasRunoff && (
          <Segmented<Turn>
            label="Turno"
            value={turn}
            onChange={onTurn}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno', disabled: !ids?.[2], hint: 'Ainda não houve 2º turno' },
            ]}
          />
        )}
      </div>
      {decidedInFirst && (
        <p className="mt-4 max-w-2xl rounded-md border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink-2">
          {inUf(uf).replace(/^./, (c) => c.toUpperCase())}, a eleição para {office.name.toLowerCase()} foi decidida no 1º turno. Mostrando esse resultado.
        </p>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <section aria-live="polite" className="fade-up lg:sticky lg:top-24">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="h-4 w-4" aria-hidden />
                {selected ? 'Município' : 'Estado'}
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                {selected ? selected.nome : `${office.name}, ${uf.sigla}`}
              </h2>
            </div>
            {selected && (
              <button
                type="button"
                onClick={() => onCity(undefined)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-surface-2"
              >
                <X className="h-4 w-4" aria-hidden /> Ver estado
              </button>
            )}
          </div>

          {shown.isLoading ? (
            <div className="space-y-5" aria-busy="true">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : shown.data ? (
            <div className="space-y-6">
              <SectionsProgress result={shown.data} />
              {shown.data.turn === 2 && shown.data.candidates.length === 2 ? (
                <HeadToHead result={shown.data} showStatus={showStatus} />
              ) : (
                <Scoreboard result={shown.data} limit={4} compact={Boolean(selected)} showStatus={showStatus} />
              )}
              <TotalsStrip result={shown.data} />
            </div>
          ) : (
            <EmptyState title="Resultado ainda não divulgado">
              Os números aparecem aqui assim que o TSE publicar a apuração desta localidade.
            </EmptyState>
          )}
        </section>

        <figure>
          <CitySearch municipalities={municipalities ?? []} onPick={(m) => onCity(m.tse)} />
          <div className="relative mt-4">
            <ChoroplethMap
              src={`/geo/uf/${ufl}.json`}
              label={`Mapa ${ofUf(uf)} com o candidato à frente em cada município`}
              selected={selected?.ibge}
              fill={(code) => {
                const l = lead(code)?.top[0]
                return l && l.votes > 0 ? shade(partyColor(l.party), l.pct) : undefined
              }}
              name={(code) => byIbge[code]?.nome ?? code}
              tooltip={(code) => {
                const l = lead(code)
                return (
                  <div>
                    <p className="mb-1.5 font-semibold">{byIbge[code]?.nome}</p>
                    {l ? (
                      <ul className="space-y-1">
                        {l.top.map((c, i) => (
                          <li key={c.number} className="flex justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                style={{ background: partyColor(c.party, i) }}
                              />
                              <span className="truncate">{c.name}</span>
                            </span>
                            <span className="font-semibold tabular">{fmtPct(c.pct)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">{leaders.isLoading ? 'Carregando' : 'Sem dados'}</span>
                    )}
                  </div>
                )
              }}
              onSelect={(code) => onCity(byIbge[code]?.tse)}
            />
            {leaders.isLoading && (
              <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
                Carregando os municípios
              </p>
            )}
          </div>
          <figcaption className="mt-3 text-sm text-muted">
            Cor do candidato à frente em cada município. Toque ou clique para ver o resultado.
          </figcaption>
        </figure>
      </div>
    </Container>
  )
}

function CitySearch({ municipalities, onPick }: { municipalities: Municipality[]; onPick: (m: Municipality) => void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const matches = q.length >= 2 ? municipalities.filter((m) => norm(m.nome).includes(norm(q))).slice(0, 8) : []

  const pick = (m: Municipality) => {
    onPick(m)
    setQ('')
    setActive(0)
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Buscar município
      </label>
      <div className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-ink/50">
        <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (!matches.length) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => (a + 1) % matches.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => (a - 1 + matches.length) % matches.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              pick(matches[active])
            } else if (e.key === 'Escape') setQ('')
          }}
          placeholder="Ex.: Campinas"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"
        />
      </div>
      {matches.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-[0_12px_32px_rgb(17_20_24/0.14)]"
        >
          {matches.map((m, i) => (
            <li key={m.tse} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  'flex min-h-11 w-full cursor-pointer items-center justify-between px-3 text-left text-sm',
                  i === active ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m)}
              >
                {m.nome}
                {m.capital && <span className="text-xs text-muted">capital</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
