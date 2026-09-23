import { ArrowLeft, MapPin, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { Scoreboard, TotalsGrid } from '../components/results/Scoreboard'
import { Card, EmptyState, Segmented, Skeleton } from '../components/ui'
import { findOffice, getCycle, type Turn } from '../config/elections'
import { partyColor } from '../config/parties'
import { findUf } from '../config/ufs'
import { shade } from '../lib/colors'
import { fmtPct } from '../lib/format'
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

  const queryTurn = Number(search.get('turno'))
  const turn: Turn = !office.hasRunoff ? 1 : queryTurn === 1 || queryTurn === 2 ? queryTurn : defaultTurn(cycle, Boolean(ids?.[2]))
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
  uf: NonNullable<ReturnType<typeof findUf>>
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        to={`/${cycle.year}/${office.slug}?turno=${turn}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Brasil
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
            {office.name} · Eleições {cycle.year}
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{uf.nome}</h1>
        </div>
        {office.hasRunoff && (
          <Segmented<Turn>
            label="Turno"
            value={turn}
            onChange={onTurn}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno', disabled: !ids?.[2] },
            ]}
          />
        )}
      </div>
      {decidedInFirst && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
          Em {uf.nome} a disputa para {office.name.toLowerCase()} foi decidida no 1º turno.
        </p>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-3 sm:p-5">
          <CitySearch municipalities={municipalities ?? []} onPick={(m) => onCity(m.tse)} />
          <ChoroplethMap
            className="mt-3"
            src={`/geo/uf/${ufl}.json`}
            label={`Mapa de ${uf.nome} por município`}
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
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: partyColor(c.party, i) }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="font-semibold tabular">{fmtPct(c.pct)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">{leaders.isLoading ? 'Carregando…' : 'Sem dados'}</span>
                  )}
                </div>
              )
            }}
            onSelect={(code) => onCity(byIbge[code]?.tse)}
          />
          {leaders.isLoading && (
            <p className="mt-2 text-center text-xs text-muted">Carregando resultados dos municípios…</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-muted uppercase">
                  <MapPin className="h-3.5 w-3.5" />
                  {selected ? 'Município' : 'Estado'}
                </p>
                <h2 className="font-serif text-2xl font-semibold">{selected ? selected.nome : uf.nome}</h2>
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={() => onCity(undefined)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="h-4 w-4" /> Ver estado
                </button>
              )}
            </div>
            {shown.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : shown.data ? (
              <Scoreboard
                result={shown.data}
                limit={4}
                compact={Boolean(selected)}
                showStatus={office.scope === 'uf' && !selected}
              />
            ) : (
              <EmptyState title="Resultado ainda não divulgado">
                Os dados aparecem aqui assim que o TSE publicar a apuração desta localidade.
              </EmptyState>
            )}
          </Card>
          {shown.data && <TotalsGrid result={shown.data} />}
        </div>
      </div>
    </div>
  )
}

function CitySearch({ municipalities, onPick }: { municipalities: Municipality[]; onPick: (m: Municipality) => void }) {
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const matches = q.length >= 2 ? municipalities.filter((m) => norm(m.nome).includes(norm(q))).slice(0, 8) : []

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 focus-within:border-ink/40">
        <Search className="h-4 w-4 text-muted" />
        <span className="sr-only">Buscar município</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar município"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      {matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {matches.map((m) => (
            <li key={m.tse}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => {
                  onPick(m)
                  setQ('')
                }}
              >
                {m.nome}
                {m.capital && <span className="ml-2 text-xs text-muted">capital</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
