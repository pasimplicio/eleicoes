// Alianças presidenciais do 1º turno, como registradas no TSE: cada candidatura a
// presidente com a composição da sua coligação ou federação (campo "com" do arquivo
// unificado). Serve de critério objetivo para a correlação de forças no Congresso e
// nos estados, sem classificar partidos por conta própria.
import { useQuery } from '@tanstack/react-query'
import type { Cycle, ElectionIds, Office } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { titleCase } from '../format'
import { livePolling } from '../live'
import { unifiedPath } from './paths'
import { electionId, getJson, HttpError } from './queries'
import type { RawUnified } from './raw'

export interface Bloc {
  id: string
  /** "Aliança de Lula", "Outras candidaturas"... */
  label: string
  /** Nome curto para legendas estreitas. */
  short: string
  color: string
  /** Candidato que encabeça a aliança (só nos blocos de finalistas). */
  candidate?: { name: string; party: string; votes: number }
  parties: string[]
}

export interface Alliances {
  blocs: Bloc[]
  blocOf: (party: string) => Bloc
  /** A aliança já reflete o resultado final do 1º turno (finalistas definidos). */
  final: boolean
}

/** "PC do B", "PCdoB" e "PCDOB" viram a mesma chave. */
export const partyKey = (sg: string) => sg.toUpperCase().replace(/\s+/g, '')

export const OTHER_ID = 'outras'
export const NONE_ID = 'sem-alianca'

export function buildAlliances(raw: RawUnified): Alliances {
  const cands = (raw.carg[0]?.agr ?? []).flatMap((a) =>
    a.par.flatMap((p) =>
      p.cand.map((c) => ({
        name: titleCase(c.nmu || c.nm),
        party: p.sg,
        votes: Number(c.vap) || 0,
        runoff: /2º turno/i.test(c.st ?? '') || /^eleito/i.test(c.st ?? ''),
        parties: [...new Set([...(a.com || '').split('/'), p.sg].map((x) => x.trim()).filter(Boolean).map(partyKey))],
      })),
    ),
  )
  cands.sort((a, b) => b.votes - a.votes)
  const final = raw.tf?.toLowerCase() === 's'
  // Finalistas: quem foi ao 2º turno (ou venceu); durante a apuração, os dois primeiros.
  const declared = cands.filter((c) => c.runoff)
  const finalists = declared.length ? declared : cands.slice(0, 2)

  const blocs: Bloc[] = finalists.map((c, i) => ({
    id: `pres-${partyKey(c.party)}`,
    label: `Aliança de ${c.name}`,
    short: c.name,
    color: partyColor(c.party, i),
    candidate: { name: c.name, party: c.party, votes: c.votes },
    parties: c.parties,
  }))
  const others = cands.filter((c) => !finalists.includes(c))
  blocs.push({
    id: OTHER_ID,
    label: 'Outras candidaturas a presidente',
    short: 'Outras candidaturas',
    color: 'var(--bloc-other)',
    parties: [...new Set(others.flatMap((c) => c.parties))],
  })
  blocs.push({ id: NONE_ID, label: 'Sem aliança presidencial', short: 'Sem aliança', color: 'var(--bloc-none)', parties: [] })

  const index = new Map<string, Bloc>()
  for (const b of blocs) for (const p of b.parties) if (!index.has(p)) index.set(p, b)
  const none = blocs[blocs.length - 1]
  return { blocs, final, blocOf: (party) => index.get(partyKey(party)) ?? none }
}

export function useAlliances(cycle: Cycle, ids: ElectionIds | undefined, president: Office | undefined) {
  const ele = president ? electionId(ids, president, 1) : undefined
  return useQuery({
    queryKey: ['alliances', cycle.tse, ele],
    enabled: Boolean(ele),
    refetchInterval: livePolling(cycle, 1, 60_000),
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return buildAlliances(await getJson<RawUnified>(unifiedPath(cycle.tse, ele!, '1', 'br')))
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null
        throw err
      }
    },
  })
}
