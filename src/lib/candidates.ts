// Candidaturas de uma eleição que ainda não aconteceu. Fontes, em ordem:
//  1. Servidor de resultados do TSE: quando o ciclo é publicado, o arquivo simplificado
//     de cada abrangência já lista os candidatos (com vice, coligação e foto).
//  2. Retrato coletado do DivulgaCandContas (public/data/candidatos-<ano>.json),
//     gerado por scripts/coletar-candidatos.js. O DivulgaCand bloqueia servidores,
//     por isso a coleta roda no navegador de uma pessoa.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cycle, ElectionIds, Office } from '../config/elections'
import { titleCase } from './format'
import { electionId, resultQuery } from './tse/queries'

export interface Candidate {
  id: string
  name: string
  fullName?: string
  number: string
  party: string
  coalition?: string
  vice?: string
  /** Situação do registro (Deferido, Indeferido com recurso, Aguardando julgamento...). */
  status?: string
  photo?: string
}

export interface CandidateList {
  source: 'resultados' | 'divulgacand'
  collectedAt?: string
  candidates: Candidate[]
}

interface SnapshotCandidate {
  id: string | number
  nomeUrna: string
  nomeCompleto?: string
  numero: string | number
  partido: string
  coligacao?: string
  vice?: string
  situacao?: string
  foto?: string
}

export interface Snapshot {
  ano: number
  coletadoEm: string
  eleicaoId?: string
  cargos: Record<string, Record<string, SnapshotCandidate[]>>
}

const byName = (a: Candidate, b: Candidate) => a.name.localeCompare(b.name, 'pt-BR')

function fromSnapshot(list: SnapshotCandidate[]): Candidate[] {
  return list
    .map((c) => ({
      id: String(c.id),
      name: titleCase(c.nomeUrna),
      fullName: c.nomeCompleto ? titleCase(c.nomeCompleto) : undefined,
      number: String(c.numero),
      party: c.partido,
      coalition: c.coligacao,
      vice: c.vice ? titleCase(c.vice) : undefined,
      status: c.situacao,
      photo: c.foto,
    }))
    .sort(byName)
}

export function useSnapshot(year: number) {
  return useQuery({
    queryKey: ['candidates-snapshot', year],
    queryFn: async (): Promise<Snapshot | null> => {
      // Arquivo opcional: pode faltar (404) ou vir substituído pelo index.html da SPA.
      const res = await fetch(`/data/candidatos-${year}.json`)
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
      return (await res.json()) as Snapshot
    },
    staleTime: 10 * 60_000,
    retry: false,
  })
}

/** abr: 'br' ou sigla da UF em minúsculas. */
export function useCandidates(cycle: Cycle, ids: ElectionIds | undefined, office: Office, abr: string | undefined) {
  const client = useQueryClient()
  const snapshot = useSnapshot(cycle.year)
  const ele = electionId(ids, office, 1)

  return useQuery({
    queryKey: ['candidates', cycle.year, office.slug, abr, ele, Boolean(snapshot.data)],
    enabled: Boolean(abr) && !snapshot.isLoading,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<CandidateList | null> => {
      if (ele) {
        const r = await client.fetchQuery(resultQuery({ cycle, ids, office, turn: 1 }, abr!))
        if (r?.candidates.length) {
          return {
            source: 'resultados',
            candidates: r.candidates
              .map((c) => ({
                id: c.id,
                name: c.name,
                number: c.number,
                party: c.party,
                coalition: c.coalition?.split(' - ').slice(1).join(' - ') || undefined,
                vice: c.vice,
                photo: c.photo,
              }))
              .sort(byName),
          }
        }
      }
      const list = snapshot.data?.cargos[office.slug]?.[abr!.toUpperCase()]
      if (list?.length) {
        return { source: 'divulgacand', collectedAt: snapshot.data!.coletadoEm, candidates: fromSnapshot(list) }
      }
      return null
    },
  })
}

/** Registro apto a receber votos? Usado para destacar ou esmaecer o cartão. */
export function statusTone(status?: string): 'ok' | 'warn' | 'off' | 'none' {
  if (!status) return 'none'
  const s = status.toLowerCase()
  if (/ren[uú]ncia|cancelad|falecid|cassad|n[aã]o conhecimento/.test(s)) return 'off'
  if (/indeferid|aguardando|pendente|sub judice|recurso/.test(s)) return 'warn'
  if (/deferid|apto/.test(s)) return 'ok'
  return 'none'
}
