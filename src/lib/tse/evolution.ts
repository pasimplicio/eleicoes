// Evolução da apuração nacional (presidente): o percentual de cada candidato ao longo da noite.
// O TSE só publica o resultado acumulado e, ao retotalizar, sobrescreve os horários de cada
// município. Por isso a curva só existe se for gravada durante a apuração: o site guarda cada
// leitura do arquivo nacional (api/_evolucao.ts) e devolve a série em /api/evolucao.
import { useQuery } from '@tanstack/react-query'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { electionId, getJson } from './queries'
import type { ResultSummary } from './model'

export interface EvolutionLine {
  number: string
  name: string
  party: string
  /** Posição do candidato no resultado (para a cor de reserva do partido). */
  index: number
  pct: number[]
}

export interface EvolutionSeries {
  /** Instantes (ms) de cada ponto. */
  times: number[]
  /** % das seções apuradas em cada ponto. */
  sections: number[]
  lines: EvolutionLine[]
}

export type EvolutionState = { status: 'none' } | { status: 'loading' } | { status: 'ready'; series: EvolutionSeries }

interface Recorded {
  recording: boolean
  points: { t: string; st: number; c: [string, number][] }[]
}

/** "AAAAMMDD HH:MM:SS" (Brasília) -> instante em ms */
const parseStamp = (s: string) => Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9)}-03:00`)

/** A curva começa com 1% das seções: antes disso, poucas urnas fazem o percentual oscilar demais. */
const MIN_SECTIONS = 1

export function buildSeries(points: Recorded['points'], result: ResultSummary, lineCount = 2): EvolutionSeries | undefined {
  const picked = result.candidates.slice(0, lineCount)
  const kept = points.filter((p) => p.st >= MIN_SECTIONS)
  if (picked.length < 2 || kept.length < 2) return undefined
  const rows = kept.map((p) => {
    const votes = Object.fromEntries(p.c)
    return { t: parseStamp(p.t), st: p.st, votes, total: p.c.reduce((s, [, v]) => s + v, 0) || 1 }
  })
  return {
    times: rows.map((r) => r.t),
    sections: rows.map((r) => r.st),
    lines: picked.map((c) => ({
      number: c.number,
      name: c.name,
      party: c.party,
      index: result.candidates.indexOf(c),
      pct: rows.map((r) => ((r.votes[c.number] ?? 0) / r.total) * 100),
    })),
  }
}

/** Série gravada para o resultado nacional de um turno; 'none' enquanto não houver pontos. */
export function useEvolution(
  { cycle, ids, office, turn }: { cycle: Cycle; ids?: ElectionIds; office: Office; turn: Turn },
  result: ResultSummary | null | undefined,
): EvolutionState {
  const ele = electionId(ids, office, turn)
  const enabled = Boolean(ele && result && office.scope === 'br')
  const recorded = useQuery({
    queryKey: ['evolucao', cycle.tse, ele],
    enabled,
    retry: 1,
    // Durante a apuração, acompanha o placar (30 s); com o resultado final, para.
    refetchInterval: result && !result.final ? 30_000 : false,
    queryFn: () => getJson<Recorded>(`/api/evolucao?ciclo=${cycle.tse}&ele=${ele}`),
  })

  if (!enabled || !result) return { status: 'none' }
  if (recorded.isLoading) return { status: 'loading' }
  const series = buildSeries(recorded.data?.points ?? [], result)
  return series ? { status: 'ready', series } : { status: 'none' }
}
