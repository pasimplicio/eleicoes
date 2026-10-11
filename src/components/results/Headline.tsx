// Manchete em uma frase, gerada a partir dos números, e a diferença entre os dois primeiros.
// O texto vem de lib/headline.ts.
import { fmtVotesShort, headlineFor, pts } from '../../lib/headline'
import type { ResultSummary } from '../../lib/tse/model'

export function ResultHeadline({
  result,
  withStatus,
  hasRunoff,
}: {
  result: ResultSummary
  withStatus?: boolean
  hasRunoff?: boolean
}) {
  const text = headlineFor(result, { withStatus, hasRunoff })
  if (!text) return null
  return <p className="font-serif text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem]">{text}</p>
}

/** "Diferença: 1,9 ponto · 2,2 milhões de votos" entre os dois primeiros. */
export function LeadGap({ result, label = 'Diferença entre os dois primeiros' }: { result: ResultSummary; label?: string }) {
  const [a, b] = result.candidates
  if (!a || !b || !result.sectionsPct) return null
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular">
        {pts(a.pct - b.pct)} · {fmtVotesShort(a.votes - b.votes)}
      </span>
    </p>
  )
}
