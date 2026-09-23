import { ArrowRight, Clock } from '@phosphor-icons/react'
import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { UF_BY_IBGE, UFS, type Region } from '../../config/ufs'
import { leaderColor } from '../../lib/colors'
import { cn, fmtPct, slugify } from '../../lib/format'
import type { ResultSummary } from '../../lib/tse/model'
import { useResult, useUfResults } from '../../lib/tse/queries'
import { ChoroplethMap } from '../map/ChoroplethMap'
import { EmptyState, Segmented, SectionHeading, Skeleton } from '../ui'
import { CandidatePhoto, PartyChip } from './Candidate'
import { HeadToHead, Scoreboard, SectionsProgress, TotalsStrip } from './Scoreboard'

interface Props {
  cycle: Cycle
  ids?: ElectionIds
  office: Office
  turn: Turn
  /** Título e controles, exibidos acima do placar. */
  header?: ReactNode
}

type ByUf = Record<string, ResultSummary | undefined>
type RegionFilter = Region | 'Brasil'

export function NationalExplorer({ cycle, ids, office, turn, header }: Props) {
  const navigate = useNavigate()
  const target = { cycle, ids, office, turn }
  const national = useResult(target, 'br')
  const { byUf, loaded, loading } = useUfResults(target)
  const isNational = office.scope === 'br'
  const stateHref = (sigla: string) => `/${cycle.year}/${office.slug}/${sigla.toLowerCase()}?turno=${turn}`

  const [search, setSearch] = useSearchParams()
  const region: RegionFilter = REGIONS.find((r) => slugify(r) === search.get('regiao')) ?? 'Brasil'
  const setRegion = (r: RegionFilter) => {
    const next = new URLSearchParams(search)
    if (r === 'Brasil') next.delete('regiao')
    else next.set('regiao', slugify(r))
    setSearch(next, { replace: true, preventScrollReset: true })
  }
  const ufsInView = region === 'Brasil' ? UFS : UFS.filter((u) => u.regiao === region)
  const focus = region === 'Brasil' ? undefined : ufsInView.map((u) => u.ibge)
  const inView = Object.fromEntries(ufsInView.map((u) => [u.sigla, byUf[u.sigla]])) as ByUf

  const noData = !national.isFetching && !loading && loaded === 0 && !national.data
  const headline = isNational ? national.data : undefined

  return (
    <div className="space-y-14">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="fade-up space-y-7">
          {header}
          {noData ? (
            <EmptyState icon={<Clock className="h-7 w-7" />} title="Resultados ainda não divulgados">
              O TSE começa a divulgar a apuração às 17h (Brasília) do dia da votação. A página se atualiza sozinha.
            </EmptyState>
          ) : isNational ? (
            headline ? (
              <div className="space-y-6">
                <SectionsProgress result={headline} />
                {headline.turn === 2 && headline.candidates.length === 2 ? (
                  <HeadToHead result={headline} />
                ) : (
                  <Scoreboard result={headline} limit={4} />
                )}
                <TotalsStrip result={headline} />
              </div>
            ) : (
              <ScoreboardSkeleton />
            )
          ) : (
            <PartyTally byUf={byUf} office={office} />
          )}
        </div>

        <figure className="lg:sticky lg:top-24">
          <div className="mb-4">
            <Segmented<RegionFilter>
              label="Filtrar o mapa por região"
              value={region}
              onChange={setRegion}
              options={(['Brasil', ...REGIONS] as RegionFilter[]).map((r) => ({ value: r, label: r }))}
            />
          </div>
          {isNational && region !== 'Brasil' && <RegionSummary region={region} inView={inView} />}
          <ChoroplethMap
            focus={focus}
            src="/geo/br-uf.json"
            label={`Mapa do Brasil com o candidato à frente em cada estado: ${office.name}, ${turn}º turno`}
            fill={(code) => leaderColor(byUf[UF_BY_IBGE[code]?.sigla])}
            name={(code) => {
              const uf = UF_BY_IBGE[code]
              const lead = byUf[uf.sigla]?.candidates[0]
              return lead ? `${uf.nome}: ${lead.name} à frente com ${fmtPct(lead.pct)}` : uf.nome
            }}
            tooltip={(code) => <UfTooltip uf={UF_BY_IBGE[code].sigla} byUf={byUf} turn={turn} />}
            onSelect={(code) => navigate(stateHref(UF_BY_IBGE[code].sigla))}
          />
          <figcaption>
            <PartyLegend byUf={inView} />
          </figcaption>
        </figure>
      </div>

      <section aria-labelledby="por-estado">
        <SectionHeading
          id="por-estado"
          title={region === 'Brasil' ? 'Resultado por estado' : `Resultado por estado: ${region}`}
          action={
            region !== 'Brasil' && (
              <button
                type="button"
                onClick={() => setRegion('Brasil')}
                className="min-h-11 cursor-pointer text-sm font-semibold text-ink hover:underline"
              >
                Ver todos os estados
              </button>
            )
          }
        />
        <StateCards ufs={ufsInView} byUf={byUf} href={stateHref} showStatus={office.scope === 'uf'} turn={turn} />
      </section>
    </div>
  )
}

function UfTooltip({ uf, byUf, turn }: { uf: string; byUf: ByUf; turn: Turn }) {
  const r = byUf[uf]
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-semibold">{UFS.find((u) => u.sigla === uf)?.nome}</span>
        {r && r.turn === 1 && turn === 2 && <span className="text-xs text-muted">decidido no 1º turno</span>}
      </div>
      {r ? (
        <ul className="space-y-1.5">
          {r.candidates.slice(0, 3).map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: partyColor(c.party, i) }} />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="font-semibold tabular">{fmtPct(c.pct)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted">Sem dados ainda</span>
      )}
    </div>
  )
}

function ScoreboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-2/3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2 w-full" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

function countByParty(byUf: ByUf) {
  const counts = new Map<string, number>()
  for (const r of Object.values(byUf)) {
    const lead = r?.candidates[0]
    if (lead && lead.votes > 0) counts.set(lead.party, (counts.get(lead.party) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function PartyLegend({ byUf }: { byUf: ByUf }) {
  const counts = countByParty(byUf)
  if (!counts.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
      {counts.map(([party, n]) => (
        <span key={party} className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: partyColor(party) }} aria-hidden />
          <span>
            <strong className="font-semibold text-ink">{party}</strong> à frente em {n} {n === 1 ? 'UF' : 'UFs'}
          </span>
        </span>
      ))}
      <span className="text-muted">Tom mais forte indica vantagem maior.</span>
    </div>
  )
}

function PartyTally({ byUf, office }: { byUf: ByUf; office: Office }) {
  const counts = countByParty(byUf)
  const elected = Object.values(byUf).reduce((n, r) => n + (r?.candidates.filter((c) => c.elected).length ?? 0), 0)
  if (!counts.length) return <ScoreboardSkeleton />
  const max = counts[0][1]
  return (
    <div>
      <p className="text-ink-2">
        <span className="text-4xl font-semibold tracking-tight text-ink tabular">{elected}</span>{' '}
        {office.name.toLowerCase()}
        {elected === 1 ? '' : 'es'} eleito{elected === 1 ? '' : 's'} até agora.
      </p>
      <p className="mt-6 mb-3 text-sm font-medium text-muted">Estados em que cada partido está à frente</p>
      <ul className="space-y-2.5">
        {counts.map(([party, n]) => (
          <li key={party} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3">
            <PartyChip party={party} className="justify-self-start" />
            <div className="h-2">
              <div
                className="bar-grow h-full rounded-full"
                style={{ width: `${(n / max) * 100}%`, background: partyColor(party) }}
              />
            </div>
            <span className="text-right font-semibold tabular">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const REGIONS: Region[] = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

/** Soma dos votos dos estados filtrados (cargo nacional): o placar da região. */
function RegionSummary({ region, inView }: { region: Region; inView: ByUf }) {
  const rows = useMemo(() => {
    const acc = new Map<string, { name: string; party: string; votes: number }>()
    let total = 0
    for (const r of Object.values(inView)) {
      for (const c of r?.candidates ?? []) {
        const cur = acc.get(c.id) ?? { name: c.name, party: c.party, votes: 0 }
        cur.votes += c.votes
        total += c.votes
        acc.set(c.id, cur)
      }
    }
    return [...acc.values()]
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 2)
      .map((c) => ({ ...c, pct: total ? (c.votes / total) * 100 : 0 }))
  }, [inView])
  if (!rows.length) return null

  return (
    <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">Soma dos votos válidos na região {region}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        {rows.map((c, i) => (
          <span key={c.name} className="inline-flex items-baseline gap-2">
            <span
              className="h-2.5 w-2.5 self-center rounded-sm"
              style={{ background: partyColor(c.party, i) }}
              aria-hidden
            />
            <span className="text-sm">{c.name}</span>
            <strong className="text-lg font-semibold tabular">{fmtPct(c.pct)}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

function StateCards({
  ufs,
  byUf,
  href,
  showStatus,
  turn,
}: {
  ufs: typeof UFS
  byUf: ByUf
  href: (uf: string) => string
  showStatus: boolean
  turn: Turn
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ufs.map((uf, i) => {
        const r = byUf[uf.sigla]
        const top = r?.candidates.slice(0, 2) ?? []
        const lead = top[0]
        const note =
          r && r.turn === 1 && turn === 2
            ? 'Decidido no 1º turno'
            : showStatus && lead
              ? lead.elected
                ? 'Eleito'
                : lead.runoff && r?.final
                  ? 'Vai ao 2º turno'
                  : ''
              : ''
        const margin = lead && top[1] ? lead.pct - top[1].pct : undefined
        return (
          <li key={uf.sigla} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
            <Link
              to={href(uf.sigla)}
              aria-label={`${uf.nome}: ver resultado por município`}
              className="group flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition hover:border-ink/30 hover:shadow-[0_6px_20px_rgb(17_20_24/0.08)] active:translate-y-px"
              style={{ borderTop: `3px solid ${lead ? partyColor(lead.party) : 'var(--color-line)'}` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{uf.nome}</h3>
                {note && <span className="shrink-0 text-xs text-muted">{note}</span>}
              </div>

              {top.length ? (
                <ul className="mt-4 space-y-3">
                  {top.map((c, j) => (
                    <li key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3">
                      <CandidatePhoto
                        src={c.photo}
                        name={c.name}
                        color={partyColor(c.party, j)}
                        size={j === 0 ? 44 : 36}
                      />
                      <div className="min-w-0">
                        <p className={cn('truncate text-sm', j === 0 && 'font-semibold')}>{c.name}</p>
                        <PartyChip party={c.party} className="mt-1" />
                      </div>
                      <span className={cn('tabular', j === 0 ? 'text-lg font-semibold' : 'text-sm text-ink-2')}>
                        {fmtPct(c.pct)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 space-y-3" aria-hidden>
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-9 w-4/5" />
                </div>
              )}

              {margin !== undefined && (
                <p className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
                  <span>
                    Vantagem de{' '}
                    <strong className="font-semibold text-ink-2 tabular">
                      {margin.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.
                    </strong>
                  </span>
                  <span className="font-medium text-ink-2 opacity-0 transition group-hover:opacity-100">
                    Municípios
                  </span>
                </p>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink hover:underline">
      {children} <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
