import { KNOWN_IDS, type ElectionIds, type Level, type Turn } from '../../config/elections'
import type { RawElectionConfig } from './raw'

const LEVEL_PATTERNS: [Level, RegExp][] = [
  ['federal', /federal/i],
  ['estadual', /estadual/i],
  ['municipal', /municipal/i],
]

type ConfigElection = RawElectionConfig['pl'][number]['e'][number]

/** Nível pela lista de cargos: presidente (1) é federal; governador, senador e deputados (3, 5 a 8), estadual. */
function levelFromOffices(e: ConfigElection): Level | undefined {
  const codes = new Set((e.abr ?? []).flatMap((a) => (a.cp ?? []).map((c) => c.cd)))
  if (codes.has('1')) return 'federal'
  if (['3', '5', '6', '7', '8'].some((c) => codes.has(c))) return 'estadual'
  if (codes.has('11') || codes.has('13')) return 'municipal'
  return undefined
}

/**
 * Extrai os códigos de eleição do ciclo publicado na config do TSE.
 * Considera apenas eleições ordinárias (ignora consultas populares e suplementares).
 */
export function parseElectionConfig(raw: RawElectionConfig, year: number): ElectionIds | undefined {
  if (raw.c !== `ele${year}`) return undefined
  const ids: ElectionIds = {}
  for (const pleito of raw.pl) {
    for (const e of pleito.e) {
      if (e.tp === '7' || /consulta|suplementar|plebiscito|referendo/i.test(e.nm)) continue
      const turn = Number(e.t) as Turn
      const level = levelFromOffices(e) ?? LEVEL_PATTERNS.find(([, re]) => re.test(e.nm))?.[0]
      if (!level || (turn !== 1 && turn !== 2)) continue
      ids[turn] = { ...ids[turn], [level]: e.cd }
    }
  }
  return Object.keys(ids).length ? ids : undefined
}

export function knownIds(year: number): ElectionIds | undefined {
  return KNOWN_IDS[year]
}
