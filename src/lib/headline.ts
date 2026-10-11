// Manchete em uma frase, gerada a partir dos números do TSE (nenhum texto escrito à mão).
import { fmtInt, fmtPct } from './format'
import type { ResultSummary } from './tse/model'

/** "A", "A e B", "A, B e C" */
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`

/** 2.243.965 → "2,2 milhões de votos"; 12.340 → "12,3 mil votos". */
export function fmtVotesShort(n: number) {
  const one = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  if (n >= 1_000_000) return `${one(n / 1_000_000)} ${n >= 2_000_000 ? 'milhões' : 'milhão'} de votos`
  if (n >= 10_000) return `${one(n / 1_000)} mil votos`
  return `${fmtInt(n)} ${n === 1 ? 'voto' : 'votos'}`
}

export const pts = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${Math.abs(n) >= 2 ? 'pontos' : 'ponto'}`

/**
 * A frase que resume o resultado, ou null quando ainda não há o que dizer.
 * `withStatus` falso ignora "eleito"/"2º turno" (ex.: presidente dentro de uma UF,
 * onde o TSE repete o status nacional).
 */
export function headlineFor(
  r: ResultSummary,
  { withStatus = true, hasRunoff = false }: { withStatus?: boolean; hasRunoff?: boolean } = {},
): string | null {
  const [lead, second] = r.candidates
  if (!lead) return null
  if (withStatus) {
    const elected = r.candidates.filter((c) => c.elected)
    if (elected.length) {
      const verb = elected.length > 1 ? 'vencem' : 'vence'
      return `${joinNames(elected.map((c) => c.name))} ${verb}${hasRunoff && r.turn === 1 ? ' no 1º turno' : ''}`
    }
    const runoff = r.candidates.filter((c) => c.runoff)
    if (runoff.length === 2) return `${joinNames(runoff.map((c) => c.name))} disputam o 2º turno`
  }
  if (!r.sectionsPct) return null
  if (r.final) return second ? `${lead.name} termina à frente, ${pts(lead.pct - second.pct)} adiante` : `${lead.name} termina à frente`
  return `${lead.name} lidera com ${fmtPct(lead.pct)}, com ${fmtPct(r.sectionsPct)} das seções apuradas`
}

