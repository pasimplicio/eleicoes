import { partyColor } from '../../config/parties'
import { cn, fmtInt, fmtPct, fmtUpdated } from '../../lib/format'
import type { ResultSummary } from '../../lib/tse/model'
import { CandidatePhoto, PartyChip, StatusBadge } from './Candidate'

interface Props {
  result: ResultSummary
  /** Quantos candidatos mostrar antes de "ver todos". */
  limit?: number
  compact?: boolean
  /** Mostra "eleito"/"2º turno". Desligue quando a abrangência não é a do cargo
   *  (ex.: presidente dentro de uma UF), pois o TSE repete o status nacional. */
  showStatus?: boolean
}

export function SectionsProgress({ result }: { result: ResultSummary }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">
          {result.final ? 'Totalização concluída' : `${fmtPct(result.sectionsPct)} das seções totalizadas`}
        </span>
        <span className="text-xs text-muted">Atualizado em {fmtUpdated(result.updatedAt)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700', result.final ? 'bg-ok' : 'bg-live')}
          style={{ width: `${result.sectionsPct}%` }}
        />
      </div>
    </div>
  )
}

export function Scoreboard({ result, limit = 6, compact, showStatus = true }: Props) {
  const list = result.candidates.slice(0, limit)
  const rest = result.candidates.slice(limit)

  return (
    <div className="space-y-5">
      <SectionsProgress result={result} />

      <ol className="space-y-4">
        {list.map((c, i) => {
          const color = partyColor(c.party, i)
          const leader = i === 0
          return (
            <li key={c.id} className="flex items-center gap-3 sm:gap-4">
              <CandidatePhoto src={c.photo} name={c.name} color={color} size={compact ? 40 : leader ? 64 : 52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('truncate font-semibold', leader && !compact ? 'text-lg' : 'text-base')}>{c.name}</span>
                  <PartyChip party={c.party} />
                  {showStatus && <StatusBadge elected={c.elected} runoff={c.runoff} final={result.final} />}
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${c.pct}%`, background: color }}
                  />
                </div>
                {!compact && c.vice && <div className="mt-1 truncate text-xs text-muted">Vice: {c.vice}</div>}
              </div>
              <div className="text-right tabular">
                <div className={cn('font-bold', leader && !compact ? 'text-2xl' : 'text-lg')}>{fmtPct(c.pct)}</div>
                <div className="text-xs text-muted">{fmtInt(c.votes)} votos</div>
              </div>
            </li>
          )
        })}
      </ol>

      {rest.length > 0 && (
        <details className="group rounded-xl border border-line">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
            Ver outros {rest.length} candidatos
          </summary>
          <ul className="divide-y divide-line">
            {rest.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="truncate">
                  {c.name} <span className="text-muted">· {c.party}</span>
                </span>
                <span className="tabular text-ink-2">
                  {fmtPct(c.pct)} <span className="text-muted">({fmtInt(c.votes)})</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function TotalsGrid({ result }: { result: ResultSummary }) {
  const base = result.turnout || 1
  const items = [
    { label: 'Eleitorado', value: fmtInt(result.electorate) },
    { label: 'Comparecimento', value: fmtPct(result.turnoutPct), sub: fmtInt(result.turnout) },
    { label: 'Abstenção', value: fmtPct(result.abstentionPct), sub: fmtInt(result.abstention) },
    { label: 'Válidos', value: fmtPct((result.valid / base) * 100), sub: fmtInt(result.valid) },
    { label: 'Brancos', value: fmtPct((result.blank / base) * 100), sub: fmtInt(result.blank) },
    { label: 'Nulos', value: fmtPct((result.nulls / base) * 100), sub: fmtInt(result.nulls) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-4 py-3">
          <dt className="text-xs font-medium text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-lg font-bold tabular">{it.value}</dd>
          {it.sub && <dd className="text-xs text-muted tabular">{it.sub}</dd>}
        </div>
      ))}
    </dl>
  )
}
