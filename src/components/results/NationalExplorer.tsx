import { ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { UF_BY_IBGE, UFS } from '../../config/ufs'
import { fmtPct } from '../../lib/format'
import type { ResultSummary } from '../../lib/tse/model'
import { useResult, useUfResults } from '../../lib/tse/queries'
import { leaderColor } from '../../lib/colors'
import { ChoroplethMap } from '../map/ChoroplethMap'
import { EmptyState, Skeleton } from '../ui'
import { CandidatePhoto, PartyChip } from './Candidate'
import { Scoreboard, TotalsGrid } from './Scoreboard'

interface Props {
  cycle: Cycle
  ids?: ElectionIds
  office: Office
  turn: Turn
}

export function NationalExplorer({ cycle, ids, office, turn }: Props) {
  const navigate = useNavigate()
  const target = { cycle, ids, office, turn }
  const national = useResult(target, 'br')
  const { byUf, loaded } = useUfResults(target)
  const isNational = office.scope === 'br'

  const noData = !national.isLoading && loaded === 0 && (national.data === null || !isNational)

  const tooltip = (code: string) => {
    const uf = UF_BY_IBGE[code]
    const r = byUf[uf.sigla]
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold">{uf.nome}</span>
          {r && r.turn === 1 && turn === 2 && <span className="text-[11px] text-muted">decidido no 1º turno</span>}
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
        <p className="mt-2 text-[11px] text-muted">Clique para ver os municípios</p>
      </div>
    )
  }

  const map = (
    <ChoroplethMap
      src="/geo/br-uf.json"
      label={`Mapa do Brasil: ${office.name}, ${turn}º turno`}
      fill={(code) => leaderColor(byUf[UF_BY_IBGE[code]?.sigla])}
      name={(code) => {
        const uf = UF_BY_IBGE[code]
        const lead = byUf[uf.sigla]?.candidates[0]
        return lead ? `${uf.nome}: ${lead.name} lidera com ${fmtPct(lead.pct)}` : uf.nome
      }}
      tooltip={tooltip}
      onSelect={(code) => navigate(`/${cycle.year}/${office.slug}/${UF_BY_IBGE[code].sigla.toLowerCase()}?turno=${turn}`)}
    />
  )

  if (noData) {
    return (
      <EmptyState title="Resultados ainda não divulgados">
        O TSE começa a divulgar a apuração às 17h (horário de Brasília) do dia da votação. Esta página se atualiza
        sozinha assim que os primeiros dados forem publicados.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          {map}
          <PartyLegend byUf={byUf} />
        </div>
        <div>
          {isNational ? (
            national.data ? (
              <div className="space-y-6">
                <Scoreboard result={national.data} limit={turn === 2 ? 2 : 4} />
                <TotalsGrid result={national.data} />
              </div>
            ) : (
              <ScoreboardSkeleton />
            )
          ) : (
            <PartyTally byUf={byUf} office={office} />
          )}
        </div>
      </div>

      <UfList cycle={cycle} office={office} turn={turn} byUf={byUf} />
    </div>
  )
}

function ScoreboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-6 w-2/3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function countByParty(byUf: Record<string, ResultSummary | undefined>) {
  const counts = new Map<string, number>()
  for (const r of Object.values(byUf)) {
    const lead = r?.candidates[0]
    if (lead && lead.votes > 0) counts.set(lead.party, (counts.get(lead.party) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function PartyLegend({ byUf }: { byUf: Record<string, ResultSummary | undefined> }) {
  const counts = countByParty(byUf)
  if (!counts.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2">
      {counts.map(([party, n]) => (
        <span key={party} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: partyColor(party) }} />
          <strong>{party}</strong> {n} {n === 1 ? 'UF' : 'UFs'}
        </span>
      ))}
      <span className="text-muted">· tom mais forte = vantagem maior</span>
    </div>
  )
}

function PartyTally({ byUf, office }: { byUf: Record<string, ResultSummary | undefined>; office: Office }) {
  const counts = countByParty(byUf)
  const elected = Object.values(byUf).reduce((n, r) => n + (r?.candidates.filter((c) => c.elected).length ?? 0), 0)
  const max = counts[0]?.[1] ?? 1
  return (
    <div>
      <p className="text-sm text-ink-2">
        <strong className="text-ink">{elected}</strong> {office.name.toLowerCase()}
        {elected === 1 ? '' : 'es'} eleito{elected === 1 ? '' : 's'} até agora. Estados liderados por partido:
      </p>
      <ul className="mt-4 space-y-3">
        {counts.map(([party, n]) => (
          <li key={party} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3">
            <PartyChip party={party} />
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: partyColor(party) }} />
            </div>
            <span className="text-right font-bold tabular">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UfList({
  cycle,
  office,
  turn,
  byUf,
}: Props & { byUf: Record<string, ResultSummary | undefined> }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold tracking-[0.14em] text-muted uppercase">Por estado</h3>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {UFS.map((uf) => {
          const r = byUf[uf.sigla]
          const lead = r?.candidates[0]
          return (
            <li key={uf.sigla}>
              <Link
                to={`/${cycle.year}/${office.slug}/${uf.sigla.toLowerCase()}?turno=${turn}`}
                className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition hover:border-ink/30 hover:shadow-sm"
              >
                <span className="w-8 text-sm font-bold text-muted">{uf.sigla}</span>
                {lead ? (
                  <>
                    <CandidatePhoto src={lead.photo} name={lead.name} color={partyColor(lead.party)} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{lead.name}</span>
                      <span className="block text-xs text-muted">
                        {lead.party}
                        {office.scope !== 'uf' ? '' : lead.elected ? ' · eleito' : lead.runoff && r?.final ? ' · 2º turno' : ''}
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular">{fmtPct(lead.pct)}</span>
                  </>
                ) : (
                  <span className="flex-1 text-sm text-muted">{uf.nome}</span>
                )}
                <ChevronRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
