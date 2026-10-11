// Prévia do 2º turno: entre os turnos (e no dia, antes das 17h), mostra os dois
// finalistas com o desempenho no 1º turno e a contagem até a divulgação. Quando o TSE
// publica o arquivo do 2º turno, a página troca sozinha para a apuração.
import { CalendarCheck } from '@phosphor-icons/react'
import type { Cycle } from '../../config/elections'
import { todayBrasilia } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { fmtDateLong, fmtInt, fmtPct } from '../../lib/format'
import { resultsStart } from '../../lib/phase'
import type { CandidateResult, ResultSummary } from '../../lib/tse/model'
import { fmtVotesShort } from '../../lib/headline'
import { Countdown } from '../Countdown'
import { CandidatePhoto, PartyChip } from './Candidate'

export function RunoffPreview({ cycle, first, place }: { cycle: Cycle; first: ResultSummary; place: string }) {
  const finalists = first.candidates.filter((c) => c.runoff).slice(0, 2)
  const today = todayBrasilia()
  const votingDay = today === cycle.dates[2]
  const started = Date.now() >= new Date(resultsStart(cycle.dates[2])).getTime()
  const [a, b] = finalists
  const gap = a && b ? a.pct - b.pct : 0

  return (
    <div className="fade-up space-y-6">
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="h-5 w-5 text-accent" weight="fill" aria-hidden />
          2º turno em {fmtDateLong(cycle.dates[2])}
        </p>
        <p className="mt-1 text-sm text-muted">
          {place}: {votingDay ? 'votação hoje, das 8h às 17h (Brasília).' : 'votação das 8h às 17h (Brasília).'}
        </p>
        {started ? (
          <p className="mt-4 text-sm font-medium text-ink-2">
            Aguardando os primeiros resultados do TSE. Esta página se atualiza sozinha.
          </p>
        ) : (
          <div className="mt-5">
            <p className="mb-2 text-xs text-muted">Divulgação dos resultados a partir das 17h</p>
            <Countdown to={resultsStart(cycle.dates[2])} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm text-muted">Os finalistas e o desempenho no 1º turno</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {finalists.map((c, i) => (
            <li
              key={c.id}
              className="flex flex-col items-center rounded-lg border border-line bg-surface p-5 text-center"
              style={{ borderTop: `4px solid ${partyColor(c.party, i)}` }}
            >
              <CandidatePhoto src={c.photo} name={c.name} color={partyColor(c.party, i)} size={88} />
              <p className="mt-3 text-lg font-semibold">{c.name}</p>
              <PartyChip party={c.party} className="mt-1" />
              {c.vice && <p className="mt-2 text-xs text-muted">Vice: {c.vice}</p>}
              <p className="mt-4 font-serif text-3xl font-semibold tabular">{fmtPct(c.pct)}</p>
              <p className="text-xs text-muted tabular">{fmtInt(c.votes)} votos no 1º turno</p>
            </li>
          ))}
        </ul>
        {a && b && (
          <p className="mt-3 text-sm text-muted">
            No 1º turno, {a.name} terminou {gap.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
            pontos à frente ({fmtVotesShort(Math.abs(a.votes - b.votes))} de diferença). No 2º turno, a votação recomeça do zero.
          </p>
        )}
        <OthersLine candidates={first.candidates.filter((c) => !c.runoff)} />
      </div>
    </div>
  )
}

/** "Os demais no 1º turno: C 2,9% · D 2,2% · E 2,2% · outros 7 somam 0,5%" */
function OthersLine({ candidates }: { candidates: CandidateResult[] }) {
  if (!candidates.length) return null
  const shown = candidates.slice(0, 3)
  const rest = candidates.slice(3)
  const restPct = rest.reduce((s, c) => s + c.pct, 0)
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 text-xs text-muted">Os demais no 1º turno</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {shown.map((c) => (
          <li key={c.id}>
            {c.name} <span className="text-muted">{c.party}</span>{' '}
            <span className="font-semibold tabular">{fmtPct(c.pct)}</span>
          </li>
        ))}
        {rest.length > 0 && (
          <li className="text-muted">
            {rest.length === 1 ? 'mais 1 candidato' : `outros ${rest.length} somam`}{' '}
            <span className="font-semibold text-ink-2 tabular">{fmtPct(restPct)}</span>
          </li>
        )}
      </ul>
    </div>
  )
}
