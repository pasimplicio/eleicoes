import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { UFS } from '../../config/ufs'
import { titleCase } from '../format'
import { livePolling } from '../live'
import { currentYear } from '../../config/elections'
import { adaptFixed, adaptSimplified, adaptUnified, adaptVotes } from './adapter'
import { knownIds, parseElectionConfig } from './discovery'
import type { ResultSummary } from './model'
import { ELECTION_CONFIG_PATH, fixedPath, photoPath, simplifiedPath, unifiedPath, usesUnified, votesPath } from './paths'
import type { RawElectionConfig, RawFixed, RawSimplified, RawUnified, RawVotes } from './raw'

export class HttpError extends Error {
  status: number
  constructor(status: number, url: string) {
    super(`HTTP ${status} em ${url}`)
    this.status = status
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new HttpError(res.status, url)
  return (await res.json()) as T
}

const notFound = (err: unknown) => err instanceof HttpError && err.status === 404

const retry = (count: number, err: unknown) => !notFound(err) && count < 2

// ---------------------------------------------------------------- ciclo

export function useElectionIds(year: number): { ids?: ElectionIds; loading: boolean } {
  const known = knownIds(year)
  const corrente = year === currentYear()
  // Ciclo corrente: consulta a config mesmo com códigos conhecidos (o 2º turno sai depois).
  const config = useQuery({
    queryKey: ['tse-config'],
    queryFn: () => getJson<RawElectionConfig>(ELECTION_CONFIG_PATH),
    enabled: !known || corrente,
    staleTime: 60_000,
    refetchInterval: corrente ? 2 * 60_000 : known ? false : 10 * 60_000,
  })
  const found = config.data ? parseElectionConfig(config.data, year) : undefined
  if (!known) return { ids: found, loading: config.isLoading }
  if (!found) return { ids: known, loading: false }
  // Junta por turno, mas só cria o turno que tem algum código: um 2º turno vazio
  // habilitaria a aba antes de o TSE publicar a eleição de 2º turno.
  const ids: ElectionIds = {}
  for (const t of [1, 2] as Turn[]) {
    const merged = { ...known[t], ...found[t] }
    if (Object.keys(merged).length) ids[t] = merged
  }
  return { ids, loading: false }
}

export function electionId(ids: ElectionIds | undefined, office: Office, turn: Turn): string | undefined {
  return ids?.[turn]?.[office.level]
}

// ---------------------------------------------------------------- resultados

function photoAbr(office: Office, abr: string) {
  return office.scope === 'br' ? 'br' : abr.slice(0, 2)
}

async function fetchSimplified(cycle: Cycle, ele: string, office: Office, abr: string) {
  const photo = (sq: string) => photoPath(cycle.tse, ele, photoAbr(office, abr), sq)
  if (usesUnified(cycle.year)) return adaptUnified(await getJson<RawUnified>(unifiedPath(cycle.tse, ele, office.code, abr)), photo)
  const raw = await getJson<RawSimplified>(simplifiedPath(cycle.tse, ele, office.code, abr))
  return adaptSimplified(raw, (sq) => photoPath(cycle.tse, ele, photoAbr(office, abr), sq))
}

/**
 * O TSE publica o arquivo do 2º turno zerado dias antes da votação. Até a primeira seção
 * ser totalizada, ele vale como "ainda não publicado": a página segue com a prévia
 * (finalistas e 1º turno) em vez de mostrar 0% para todos.
 */
function hasVotes(r: ResultSummary) {
  return r.sectionsPct > 0 || (r.sectionsCounted ?? 0) > 0 || r.valid > 0
}

interface Target {
  cycle: Cycle
  ids?: ElectionIds
  office: Office
  turn: Turn
}

/** O 1º turno terminou sem eleito e com finalistas: a disputa segue no 2º turno. */
export function isRunoffPending(r?: ResultSummary | null): boolean {
  return Boolean(r && !r.candidates.some((c) => c.elected) && r.candidates.some((c) => c.runoff))
}

/**
 * Resultado de uma abrangência (br, UF ou município). No 2º turno, abrangências decididas
 * no 1º turno mostram o resultado do 1º; onde há 2º turno ainda sem arquivo, devolve null
 * (nunca os números do 1º turno no lugar do 2º).
 */
export function resultQuery({ cycle, ids, office, turn }: Target, abr: string) {
  const ele2 = turn === 2 ? electionId(ids, office, 2) : undefined
  const ele1 = electionId(ids, office, 1)
  return queryOptions({
    queryKey: ['result', cycle.tse, office.code, turn, abr, ele1, ele2],
    enabled: Boolean(ele1),
    retry,
    refetchInterval: livePolling(cycle, turn),
    queryFn: async (): Promise<ResultSummary | null> => {
      if (ele2) {
        try {
          const second = await fetchSimplified(cycle, ele2, office, abr)
          if (hasVotes(second)) return second
        } catch (err) {
          if (!notFound(err)) throw err
        }
      }
      try {
        const first = await fetchSimplified(cycle, ele1!, office, abr)
        return ele2 && isRunoffPending(first) ? null : first
      } catch (err) {
        if (notFound(err)) return null // ainda não publicado
        throw err
      }
    },
  })
}

/** No 2º turno sem arquivo publicado: a abrangência-mãe (Brasil ou UF) vai ao 2º turno? */
async function parentRunoffPending(cycle: Cycle, ids: ElectionIds | undefined, office: Office, uf: string) {
  const ele1 = electionId(ids, office, 1)
  if (!ele1) return false
  try {
    return isRunoffPending(await fetchSimplified(cycle, ele1, office, office.scope === 'br' ? 'br' : uf))
  } catch {
    return false
  }
}

export function useResult(target: Target, abr: string) {
  return useQuery(resultQuery(target, abr))
}

/** Resultado do cargo em cada UF, para o mapa nacional. */
export function useUfResults(target: Target) {
  return useQueries({
    queries: UFS.map((uf) => resultQuery(target, uf.sigla.toLowerCase())),
    combine: (results) => ({
      byUf: Object.fromEntries(
        UFS.map((uf, i) => [uf.sigla, results[i].data ?? undefined]),
      ) as Record<string, ResultSummary | undefined>,
      loading: results.some((r) => r.isLoading),
      loaded: results.filter((r) => r.data).length,
    }),
  })
}

/** Resultado de um município a partir do arquivo de votação e do arquivo fixo de candidatos. */
export function useCityResult(target: Target, uf: string, mun: string | undefined) {
  const { cycle, ids, office, turn } = target
  const ufl = uf.toLowerCase()
  return useQuery({
    queryKey: ['city', cycle.tse, office.code, turn, ufl, mun],
    enabled: Boolean(mun && electionId(ids, office, 1)),
    retry,
    refetchInterval: livePolling(cycle, turn),
    queryFn: async (): Promise<ResultSummary | null> => {
      const candidates = [turn === 2 ? electionId(ids, office, 2) : undefined, electionId(ids, office, 1)]
      for (const ele of candidates) {
        if (!ele) continue
        if (turn === 2 && ele === electionId(ids, office, 1) && candidates[0] && (await parentRunoffPending(cycle, ids, office, ufl))) {
          return null
        }
        try {
          let result: ResultSummary | null
          if (usesUnified(cycle.year)) result = await fetchSimplified(cycle, ele, office, `${ufl}${mun}`)
          else {
            const votes = await getJson<RawVotes>(votesPath(cycle.tse, ele, office.code, ufl, mun))
            const fixed = await getJson<RawFixed>(fixedPath(cycle.tse, ele, ufl, votes.nadf))
            result = adaptVotes(votes, adaptFixed(fixed), (sq) => photoPath(cycle.tse, ele, photoAbr(office, ufl), sq)) ?? null
          }
          // 2º turno ainda zerado: segue para o 1º turno, como se não estivesse publicado.
          if (ele === candidates[0] && result && !hasVotes(result)) continue
          return result
        } catch (err) {
          if (!notFound(err)) throw err
        }
      }
      return null
    },
  })
}

// ---------------------------------------------------------------- geografia

export interface Municipality {
  tse: string
  ibge: string
  nome: string
  capital: boolean
}

export function useStatic<T>(path: string | undefined) {
  return useQuery({
    queryKey: ['static', path],
    queryFn: () => getJson<T>(path!),
    enabled: Boolean(path),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useMunicipalities(uf: string) {
  return useQuery({
    queryKey: ['municipalities', uf],
    queryFn: async () =>
      (await getJson<Municipality[]>(`/geo/mun/${uf.toLowerCase()}.json`))
        .map((m) => ({ ...m, nome: titleCase(m.nome) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// ---------------------------------------------------------------- mapa municipal

/** Resposta de api/municipios.ts. */
export interface MunicipalSummary {
  nadf: string
  updatedAt: string
  final: boolean
  cities: Record<string, [number, [string, number, number][]]>
  /** Formato unificado (2026): número -> [nome, partido]; dispensa o arquivo fixo. */
  names?: Record<string, [string, string]>
}

export interface CityLeader {
  sectionsPct: number
  top: { number: string; name: string; party: string; votes: number; pct: number }[]
}

/** Líderes por município de uma UF (código TSE do município -> líder). */
export function useMunicipalLeaders(target: Target, uf: string) {
  const { cycle, ids, office, turn } = target
  const ufl = uf.toLowerCase()
  return useQuery({
    queryKey: ['municipal-map', cycle.tse, office.code, turn, ufl],
    enabled: Boolean(electionId(ids, office, 1)),
    retry,
    refetchInterval: livePolling(cycle, turn),
    queryFn: async () => {
      const eles = [turn === 2 ? electionId(ids, office, 2) : undefined, electionId(ids, office, 1)]
      for (const ele of eles) {
        if (!ele) continue
        if (turn === 2 && ele === electionId(ids, office, 1) && eles[0] && (await parentRunoffPending(cycle, ids, office, ufl))) {
          return null
        }
        try {
          const qs = new URLSearchParams({ ciclo: cycle.tse, ele, cargo: office.code, uf: ufl })
          const summary = await getJson<MunicipalSummary>(`/api/municipios?${qs}`)
          // 2º turno ainda zerado em todas as cidades: segue para o 1º turno.
          if (ele === eles[0] && Object.values(summary.cities).every(([pct]) => !pct)) continue
          const names = summary.names
            ? new Map(Object.entries(summary.names).map(([n, [name, party]]) => [n, { id: n, name: titleCase(name), party }]))
            : adaptFixed(await getJson<RawFixed>(fixedPath(cycle.tse, ele, ufl, summary.nadf)))
          const leaders: Record<string, CityLeader> = {}
          for (const [mun, [sectionsPct, top]] of Object.entries(summary.cities)) {
            leaders[mun] = {
              sectionsPct,
              top: top.map(([number, votes, pct]) => ({
                number,
                votes,
                pct,
                name: names.get(number)?.name ?? `Candidato ${number}`,
                party: names.get(number)?.party ?? '',
              })),
            }
          }
          return { turn: ele === electionId(ids, office, 2) ? 2 : 1, final: summary.final, leaders }
        } catch (err) {
          if (!notFound(err)) throw err
        }
      }
      return null
    },
  })
}
