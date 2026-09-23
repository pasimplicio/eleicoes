import { CaretDown } from '@phosphor-icons/react'
import { partyColor } from '../../config/parties'
import { cn, fmtInt, fmtPct, fmtUpdated } from '../../lib/format'
import type { CandidateResult, ResultSummary } from '../../lib/tse/model'
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

/** Barra proporcional animada via transform (sem animar largura). */
function Bar({ pct, color, className }: { pct: number; color: string; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      <div
        className="bar-grow h-full w-full rounded-full transition-transform duration-700 ease-out-expo"
        style={{ transform: `scaleX(${Math.max(0, Math.min(100, pct)) / 100})`, background: color }}
      />
    </div>
  )
}

export function SectionsProgress({ result }: { result: ResultSummary }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-2 font-medium">
        <span
          className={cn('h-2 w-2 rounded-full', result.final ? 'bg-ok' : 'live-dot bg-live')}
          aria-hidden
        />
        {result.final ? 'Totalização concluída' : `${fmtPct(result.sectionsPct)} das seções totalizadas`}
      </span>
      <span className="text-muted tabular">Atualizado em {fmtUpdated(result.updatedAt)}</span>
    </div>
  )
}

function Row({ c, index, result, compact, showStatus }: { c: CandidateResult; index: number } & Props) {
  const color = partyColor(c.party, index)
  const leader = index === 0 && !compact
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 sm:gap-x-4">
      <CandidatePhoto src={c.photo} name={c.name} color={color} size={compact ? 40 : leader ? 60 : 48} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('truncate font-semibold', leader ? 'text-lg' : 'text-[0.95rem]')}>{c.name}</span>
          <PartyChip party={c.party} />
          {showStatus && <StatusBadge elected={c.elected} runoff={c.runoff} final={result.final} />}
        </div>
        <Bar pct={c.pct} color={color} className="mt-2" />
      </div>
      <div className="text-right tabular">
        <div className={cn('font-semibold tracking-tight', leader ? 'text-2xl' : 'text-lg')}>{fmtPct(c.pct)}</div>
        <div className="text-xs text-muted">{fmtInt(c.votes)} votos</div>
      </div>
    </li>
  )
}

export function Scoreboard(props: Props) {
  const { result, limit = 6, showStatus = true } = props
  const list = result.candidates.slice(0, limit)
  const rest = result.candidates.slice(limit)

  return (
    <div className="space-y-5">
      <ol className="space-y-5" aria-label="Candidatos por votos válidos">
        {list.map((c, i) => (
          <Row key={c.id} c={c} index={i} {...props} showStatus={showStatus} />
        ))}
      </ol>

      {rest.length > 0 && (
        <details className="group rounded-md border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-ink-2 hover:bg-surface-2">
            Outros {rest.length} candidatos
            <CaretDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="grid gap-x-6 px-4 pb-3 sm:grid-cols-2">
            {rest.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="truncate">
                  {c.name} <span className="text-muted">{c.party}</span>
                </span>
                <span className="text-ink-2 tabular">{fmtPct(c.pct)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/** Confronto direto (2º turno): uma barra dividida com a marca de 50%. */
export function HeadToHead({ result, showStatus = true }: { result: ResultSummary; showStatus?: boolean }) {
  const [a, b] = result.candidates
  if (!a || !b) return null
  const ca = partyColor(a.party, 0)
  const cb = partyColor(b.party, 1)
  const total = a.pct + b.pct || 100

  const side = (c: CandidateResult, color: string, align: 'left' | 'right') => (
    <div className={cn('flex items-center gap-2.5 sm:gap-3', align === 'right' && 'flex-row-reverse text-right')}>
      <span className="sm:hidden">
        <CandidatePhoto src={c.photo} name={c.name} color={color} size={44} />
      </span>
      <span className="hidden sm:block">
        <CandidatePhoto src={c.photo} name={c.name} color={color} size={64} />
      </span>
      <div className="min-w-0">
        <div className={cn('flex flex-wrap items-center gap-1.5', align === 'right' && 'justify-end')}>
          <PartyChip party={c.party} />
          {showStatus && <StatusBadge elected={c.elected} runoff={false} final={result.final} />}
        </div>
        <p className="mt-1 line-clamp-2 leading-snug font-semibold">{c.name}</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {side(a, ca, 'left')}
        {side(b, cb, 'right')}
      </div>
      <div className="mt-5 flex items-end justify-between tabular">
        <span className="text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: ca }}>
          {fmtPct(a.pct)}
        </span>
        <span className="text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: cb }}>
          {fmtPct(b.pct)}
        </span>
      </div>
      <div className="relative mt-3 flex h-4 overflow-hidden rounded-full bg-surface-2" role="img"
        aria-label={`${a.name} ${fmtPct(a.pct)}, ${b.name} ${fmtPct(b.pct)}`}>
        <div className="bar-grow h-full" style={{ width: `${(a.pct / total) * 100}%`, background: ca }} />
        <div className="h-full flex-1" style={{ background: cb }} />
        <span className="absolute inset-y-[-3px] left-1/2 w-0.5 -translate-x-1/2 bg-ink" aria-hidden />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted tabular">
        <span>{fmtInt(a.votes)} votos</span>
        <span>50%</span>
        <span>{fmtInt(b.votes)} votos</span>
      </div>
    </div>
  )
}

/** Totais de participação em linha, sem cartões. */
export function TotalsStrip({ result }: { result: ResultSummary }) {
  const base = result.turnout || 1
  const items = [
    { label: 'Eleitorado', value: fmtInt(result.electorate) },
    { label: 'Comparecimento', value: fmtPct(result.turnoutPct) },
    { label: 'Abstenção', value: fmtPct(result.abstentionPct) },
    { label: 'Brancos', value: fmtPct((result.blank / base) * 100) },
    { label: 'Nulos', value: fmtPct((result.nulls / base) * 100) },
  ]
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-5">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-base font-semibold tabular">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}
