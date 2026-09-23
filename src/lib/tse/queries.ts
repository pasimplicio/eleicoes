import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { UFS } from '../../config/ufs'
import { titleCase } from '../format'
import { adaptFixed, adaptSimplified, adaptVotes } from './adapter'
import { knownIds, parseElectionConfig } from './discovery'
import type { ResultSummary } from './model'
import { ELECTION_CONFIG_PATH, fixedPath, photoPath, simplifiedPath, votesPath } from './paths'
import type { RawElectionConfig, RawFixed, RawSimplified, RawVotes } from './raw'

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
const LIVE_INTERVAL = 30_000

/** Enquanto a totalização não termina, os dados são atualizados a cada 30 s. */
const liveRefetch = (q: { state: { data?: ResultSummary | null } }) =>
  q.state.data && !q.state.data.final ? LIVE_INTERVAL : false

const retry = (count: number, err: unknown) => !notFound(err) && count < 2

// ---------------------------------------------------------------- ciclo

export function useElectionIds(year: number): { ids?: ElectionIds; loading: boolean } {
  const known = knownIds(year)
  const config = useQuery({
    queryKey: ['tse-config'],
    queryFn: () => getJson<RawElectionConfig>(ELECTION_CONFIG_PATH),
    enabled: !known,
    staleTime: 5 * 60_000,
    refetchInterval: known ? false : 10 * 60_000,
  })
  if (known) return { ids: known, loading: false }
  return { ids: config.data ? parseElectionConfig(config.data, year) : undefined, loading: config.isLoading }
}

export function electionId(ids: ElectionIds | undefined, office: Office, turn: Turn): string | undefined {
  return ids?.[turn]?.[office.level]
}

// ---------------------------------------------------------------- resultados

function photoAbr(office: Office, abr: string) {
  return office.scope === 'br' ? 'br' : abr.slice(0, 2)
}

async function fetchSimplified(cycle: Cycle, ele: string, office: Office, abr: string) {
  const raw = await getJson<RawSimplified>(simplifiedPath(cycle.tse, ele, office.code, abr))
  return adaptSimplified(raw, (sq) => photoPath(cycle.tse, ele, photoAbr(office, abr), sq))
}

interface Target {
  cycle: Cycle
  ids?: ElectionIds
  office: Office
  turn: Turn
}

/**
 * Resultado de uma abrangência (br, UF ou município). No 2º turno, abrangências sem
 * segundo turno (ex.: UF decidida no 1º) caem automaticamente para o 1º turno.
 */
export function resultQuery({ cycle, ids, office, turn }: Target, abr: string) {
  const ele2 = turn === 2 ? electionId(ids, office, 2) : undefined
  const ele1 = electionId(ids, office, 1)
  return queryOptions({
    queryKey: ['result', cycle.tse, office.code, turn, abr, ele1, ele2],
    enabled: Boolean(ele1),
    retry,
    refetchInterval: liveRefetch,
    queryFn: async (): Promise<ResultSummary | null> => {
      if (ele2) {
        try {
          return await fetchSimplified(cycle, ele2, office, abr)
        } catch (err) {
          if (!notFound(err)) throw err
        }
      }
      try {
        return await fetchSimplified(cycle, ele1!, office, abr)
      } catch (err) {
        if (notFound(err)) return null // ainda não publicado
        throw err
      }
    },
  })
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
    refetchInterval: liveRefetch,
    queryFn: async (): Promise<ResultSummary | null> => {
      const candidates = [turn === 2 ? electionId(ids, office, 2) : undefined, electionId(ids, office, 1)]
      for (const ele of candidates) {
        if (!ele) continue
        try {
          const votes = await getJson<RawVotes>(votesPath(cycle.tse, ele, office.code, ufl, mun))
          const fixed = await getJson<RawFixed>(fixedPath(cycle.tse, ele, ufl, votes.nadf))
          return (
            adaptVotes(votes, adaptFixed(fixed), (sq) => photoPath(cycle.tse, ele, photoAbr(office, ufl), sq)) ?? null
          )
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
    refetchInterval: (q) => (q.state.data && !q.state.data.final ? LIVE_INTERVAL : false),
    queryFn: async () => {
      const eles = [turn === 2 ? electionId(ids, office, 2) : undefined, electionId(ids, office, 1)]
      for (const ele of eles) {
        if (!ele) continue
        try {
          const qs = new URLSearchParams({ ciclo: cycle.tse, ele, cargo: office.code, uf: ufl })
          const summary = await getJson<MunicipalSummary>(`/api/municipios?${qs}`)
          const names = adaptFixed(await getJson<RawFixed>(fixedPath(cycle.tse, ele, ufl, summary.nadf)))
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
