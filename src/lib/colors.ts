import { partyColor } from '../config/parties'
import type { ResultSummary } from './tse/model'

/** Intensidade da cor proporcional à vantagem do líder: vitórias apertadas ficam mais claras. */
export function shade(color: string, pct: number): string {
  const strength = Math.round(Math.min(100, Math.max(38, 38 + (pct - 35) * 1.9)))
  return `color-mix(in srgb, ${color} ${strength}%, var(--color-surface))`
}

export function leaderColor(r: ResultSummary | undefined) {
  const lead = r?.candidates[0]
  if (!lead || lead.votes === 0) return undefined
  return shade(partyColor(lead.party), lead.pct)
}
