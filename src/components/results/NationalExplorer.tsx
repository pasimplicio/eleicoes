import { ArrowRight, Clock } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { UF_BY_IBGE, UFS, type Region } from '../../config/ufs'
import { leaderColor } from '../../lib/colors'
import { cn, fmtPct } from '../../lib/format'
import type { ResultSummary } from '../../lib/tse/model'
import { useResult, useUfResults } from '../../lib/tse/queries'
import { ChoroplethMap } from '../map/ChoroplethMap'
import { EmptyState, SectionHeading, Skeleton } from '../ui'
import { PartyChip } from './Candidate'
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

export function NationalExplorer({ cycle, ids, office, turn, header }: Props) {
  const navigate = useNavigate()
  const target = { cycle, ids, office, turn }
  const national = useResult(target, 'br')
  const { byUf, loaded } = useUfResults(target)
  const isNational = office.scope === 'br'
  const stateHref = (sigla: string) => `/${cycle.year}/${office.slug}/${sigla.toLowerCase()}?turno=${turn}`

  const noData = !national.isLoading && loaded === 0 && (national.data === null || !isNational)
  const headline = isNational ? national.data : undefined

  return (
    <div className="space-y-14">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
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
          <ChoroplethMap
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
            <PartyLegend byUf={byUf} />
          </figcaption>
        </figure>
      </div>

      <section aria-labelledby="por-estado">
        <SectionHeading id="por-estado" title="Resultado por estado" />
        <RegionGroups byUf={byUf} href={stateHref} showStatus={office.scope === 'uf'} />
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

function RegionGroups({ byUf, href, showStatus }: { byUf: ByUf; href: (uf: string) => string; showStatus: boolean }) {
  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {REGIONS.map((region) => (
        <div key={region}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{region}</h3>
          <ul>
            {UFS.filter((u) => u.regiao === region).map((uf) => {
              const r = byUf[uf.sigla]
              const lead = r?.candidates[0]
              const status = showStatus && lead ? (lead.elected ? 'eleito' : lead.runoff && r?.final ? '2º turno' : '') : ''
              return (
                <li key={uf.sigla}>
                  <Link
                    to={href(uf.sigla)}
                    className="group -mx-2 grid min-h-11 grid-cols-[3px_2rem_1fr_auto] items-center gap-x-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2"
                  >
                    <span
                      className="h-7 rounded-full"
                      style={{ background: lead ? partyColor(lead.party) : 'var(--color-line)' }}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold tabular">{uf.sigla}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{lead ? lead.name : uf.nome}</span>
                      {lead && (
                        <span className="block truncate text-xs text-muted">
                          {lead.party}
                          {status && `, ${status}`}
                        </span>
                      )}
                    </span>
                    <span className={cn('text-sm font-semibold tabular', !lead && 'text-muted')}>
                      {lead ? fmtPct(lead.pct) : '...'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink hover:underline">
      {children} <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
