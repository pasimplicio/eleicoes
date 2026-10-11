// Evolução da apuração nacional (presidente): o percentual de cada candidato ao longo da noite.
// O TSE só publica o resultado acumulado e, ao retotalizar, sobrescreve os horários de cada
// município. A curva vem de uma de duas fontes, nesta ordem:
//  - gravada: o site guarda cada leitura do arquivo nacional (api/_evolucao.ts, /api/evolucao);
//  - boletins de urna: reconstruída depois da eleição pelos votos de cada urna, na ordem em que
//    o TSE recebeu os boletins (scripts/build-evolution.mjs -> public/data/evolucao/).
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
  source: 'gravada' | 'boletins'
  /** O que o % de "sections" conta: seções (TSE, ao vivo) ou urnas (boletins). */
  unit: 'seções' | 'urnas'
  /** Boletins: se os votos do exterior estão incluídos. */
  exterior?: boolean
  /** Instantes (ms) de cada ponto. */
  times: number[]
  /** % das seções apuradas em cada ponto. */
  sections: number[]
  lines: EvolutionLine[]
}

export type EvolutionState = { status: 'none' } | { status: 'loading' } | { status: 'ready'; series: EvolutionSeries }

type Point = { t: string; st: number; c: [string, number][] }

interface Recorded {
  recording: boolean
  points: Point[]
}

interface FromBulletins {
  unidade: 'urnas'
  exterior: boolean
  points: Point[]
}

/** "AAAAMMDD HH:MM:SS" (Brasília) -> instante em ms */
const parseStamp = (s: string) => Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9)}-03:00`)

/** A curva começa com 1% das seções: antes disso, poucas urnas fazem o percentual oscilar demais. */
const MIN_SECTIONS = 1
const MAX_SECTIONS = 99.99

export function buildSeries(
  points: Point[],
  result: ResultSummary,
  meta: Pick<EvolutionSeries, 'source' | 'unit' | 'exterior'>,
  lineCount = 2,
): EvolutionSeries | undefined {
  const picked = result.candidates.slice(0, lineCount)
  // Termina quando 99,99% chegaram: depois disso, poucas urnas atrasadas esticam o eixo por horas
  // com a linha reta e espremem a parte em que a disputa acontece.
  const end = points.findIndex((p) => p.st >= MAX_SECTIONS)
  const kept = (end === -1 ? points : points.slice(0, end + 1)).filter((p) => p.st >= MIN_SECTIONS)
  if (picked.length < 2 || kept.length < 2) return undefined
  const rows = kept.map((p) => {
    const votes = Object.fromEntries(p.c)
    return { t: parseStamp(p.t), st: p.st, votes, total: p.c.reduce((s, [, v]) => s + v, 0) || 1 }
  })
  return {
    ...meta,
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

  const hasRecording = (recorded.data?.points.length ?? 0) >= 2
  const bulletins = useQuery({
    queryKey: ['evolucao-boletins', cycle.tse, ele],
    enabled: enabled && !recorded.isLoading && !hasRecording,
    staleTime: Infinity,
    retry: false,
    // Arquivo estático; ausente (404) quando a reconstrução ainda não foi feita.
    queryFn: () =>
      getJson<FromBulletins>(`/data/evolucao/${cycle.tse}-${ele!.padStart(6, '0')}.json`).catch(() => null),
  })

  if (!enabled || !result) return { status: 'none' }
  if (recorded.isLoading) return { status: 'loading' }
  if (hasRecording) {
    const series = buildSeries(recorded.data!.points, result, { source: 'gravada', unit: 'seções' })
    if (series) return { status: 'ready', series }
  }
  if (bulletins.isLoading) return { status: 'loading' }
  const b = bulletins.data
  const series = b && buildSeries(b.points, result, { source: 'boletins', unit: 'urnas', exterior: b.exterior })
  return series ? { status: 'ready', series } : { status: 'none' }
}
