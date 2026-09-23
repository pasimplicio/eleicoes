// Dados das eleições proporcionais (deputados federais, estaduais e distritais) de uma UF.
// Três arquivos do servidor de resultados do TSE:
//   -v  votos por candidato e totais por agremiação (nominais, legenda e vagas oficiais)
//   -f  estrutura: agremiações, federações, partidos e candidatos (nome, nascimento, situação)
//   -r  situação oficial de cada candidato ("Eleito por QP", "Eleito por média", "Suplente")
// A distribuição das vagas é refeita pelas regras do Código Eleitoral (lib/proportional.ts):
// serve de projeção durante a apuração e é substituída pelo resultado oficial quando o
// TSE o declara.
import { useQuery } from '@tanstack/react-query'
import type { Cycle, ElectionIds, Office } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { byStatusThenName } from '../candidates'
import { livePolling } from '../live'
import { decodeEntities, titleCase } from '../format'
import { allocate, thirdPhaseRule, type CandidateOutcome, type ThirdPhaseRule } from '../proportional'
import { photoPath, simplifiedPath, BASE } from './paths'
import { electionId, getJson, HttpError } from './queries'

/** Deputado estadual no DF é o cargo 8 (distrital). */
export function proportionalCode(office: Office, uf: string): string {
  return office.slug === 'deputado-estadual' && uf.toUpperCase() === 'DF' ? '8' : office.code
}

export function proportionalName(office: Office, uf: string, plural = false): string {
  if (office.slug === 'deputado-estadual' && uf.toUpperCase() === 'DF') return plural ? 'Deputados distritais' : 'Deputado distrital'
  if (!plural) return office.name
  return office.slug === 'deputado-federal' ? 'Deputados federais' : 'Deputados estaduais'
}

interface RawAgrVotes {
  n: string
  tvtn: string
  tvtl: string
  vag: string
}
interface RawPropVotes {
  nadf: string
  dg: string
  hg: string
  abr: {
    tpabr: string
    tf: string
    pst: string
    e: string
    c: string
    pc: string
    a: string
    pa: string
    vv: string
    vnom: string
    vl: string
    vb: string
    tvn: string
    agr: RawAgrVotes[]
    cand: { n: string; vap: string }[]
  }[]
}
interface RawPropFixed {
  carg: {
    nv: string
    fed?: { n: string; nm: string; sg: string; npar: string[] }[]
    agr: {
      n: string
      nm: string
      tp: string
      com: string
      par: {
        n: string
        sg: string
        nfed: string
        cand: { n: string; sqcand: string; nm: string; nmu: string; dt: string; dvt: string }[]
      }[]
    }[]
  }
}
interface RawPropSimplified {
  tf: string
  cand: { n: string; st: string }[]
}

export interface PropParty {
  id: string
  /** Sigla exibida (federações: siglas dos partidos). */
  label: string
  /** Nome completo (federações: nome da federação). */
  name: string
  color: string
  isFederation: boolean
  votes: number
  nominal: number
  legenda: number
  quotient: number
  qpSeats: number
  averageSeats: number
  seats: number
  reaches80: boolean
}

export interface PropCandidate {
  id: string
  number: string
  name: string
  party: string
  partyId: string
  votes: number
  pct: number
  photo: string
  outcome: CandidateOutcome
  /** Situação do registro no TSE (Válido, Anulado sub judice...). */
  registration: string
}

export interface ProportionalData {
  seats: number
  validVotes: number
  nominal: number
  legenda: number
  qe: number
  min10: number
  min20: number
  min80: number
  sectionsPct: number
  turnoutPct: number
  updatedAt: string
  /** Vagas e situações vêm do TSE (true) ou da projeção pelas regras (false). */
  official: boolean
  final: boolean
  rule: ThirdPhaseRule
  parties: PropParty[]
  candidates: PropCandidate[]
}

const int = (v?: string) => Number.parseInt(v ?? '0', 10) || 0
const num = (v?: string) => Number.parseFloat((v ?? '0').replace(',', '.')) || 0
const iso = (d?: string) => (d && d.length === 10 ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : undefined)

const OUTCOME_FROM_TSE: Record<string, CandidateOutcome> = {
  'eleito por qp': 'qp',
  'eleito por média': 'media',
  'eleito por media': 'media',
  suplente: 'suplente',
  'não eleito': 'nao-eleito',
}

async function optional<T>(url: string): Promise<T | null> {
  try {
    return await getJson<T>(url)
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null
    throw err
  }
}

export function useProportional(cycle: Cycle, ids: ElectionIds | undefined, office: Office, uf: string) {
  const ele = electionId(ids, office, 1)
  const ufl = uf.toLowerCase()
  const code = proportionalCode(office, uf)

  return useQuery({
    queryKey: ['proportional', cycle.tse, ele, code, ufl],
    enabled: Boolean(ele),
    refetchInterval: livePolling(cycle, 1, 60_000),
    queryFn: async (): Promise<ProportionalData | null> => {
      const c4 = code.padStart(4, '0')
      const e6 = ele!.padStart(6, '0')
      const votes = await optional<RawPropVotes>(`${BASE}/${cycle.tse}/${ele}/dados/${ufl}/${ufl}-c${c4}-e${e6}-v.json`)
      if (!votes) return null
      const [fixed, simplified] = await Promise.all([
        getJson<RawPropFixed>(`${BASE}/${cycle.tse}/${ele}/dados/${ufl}/${votes.nadf}.json`),
        optional<RawPropSimplified>(simplifiedPath(cycle.tse, ele!, code, ufl)),
      ])
      const abr = votes.abr.find((a) => a.tpabr === 'UF') ?? votes.abr[0]
      const seats = int(fixed.carg.nv)

      // Agremiações: federação (nome e siglas da federação) ou partido isolado.
      const feds = Object.fromEntries((fixed.carg.fed ?? []).map((f) => [f.n, f]))
      const agrTotals = Object.fromEntries(abr.agr.map((a) => [a.n, a]))
      const meta = fixed.carg.agr.map((a) => {
        const fed = a.tp === 'F' ? feds[a.par[0]?.nfed] : undefined
        // Cor da federação: a do primeiro partido do nome (PT em PT/PC do B/PV).
        const firstParty = fed ? fed.sg.split('/')[0].trim() : a.par[0]?.sg
        return {
          id: a.n,
          label: fed ? fed.sg : a.com || a.par[0]?.sg || a.nm,
          name: decodeEntities(fed ? fed.nm : a.nm),
          color: partyColor(firstParty ?? a.com),
          isFederation: Boolean(fed),
        }
      })

      const voteOf = Object.fromEntries(abr.cand.map((c) => [c.n, int(c.vap)]))
      const cands = fixed.carg.agr.flatMap((a) =>
        a.par.flatMap((p) =>
          p.cand.map((c) => ({
            id: c.n,
            sq: c.sqcand,
            partyId: a.n,
            party: p.sg,
            name: titleCase(c.nmu || c.nm),
            votes: voteOf[c.n] ?? 0,
            eligible: c.dvt === 'Válido',
            birth: iso(c.dt),
            registration: c.dvt,
          })),
        ),
      )

      const rule = thirdPhaseRule(cycle.year)
      const res = allocate(
        meta.map((m) => ({ id: m.id, label: m.label, nominal: int(agrTotals[m.id]?.tvtn), legenda: int(agrTotals[m.id]?.tvtl) })),
        cands.map((c) => ({ id: c.id, partyId: c.partyId, votes: c.votes, eligible: c.eligible, birth: c.birth })),
        seats,
        rule,
      )

      // Resultado oficial: situação declarada pelo TSE no arquivo simplificado.
      const officialStatus = new Map<string, CandidateOutcome>()
      for (const c of simplified?.cand ?? []) {
        const o = OUTCOME_FROM_TSE[c.st?.toLowerCase().trim()]
        if (o) officialStatus.set(c.n, o)
      }
      const officialSeats = abr.agr.reduce((s, a) => s + int(a.vag), 0)
      const official =
        [...officialStatus.values()].filter((o) => o === 'qp' || o === 'media').length === seats && officialSeats === seats

      const byId = Object.fromEntries(res.parties.map((p) => [p.id, p]))
      const parties: PropParty[] = meta
        .map((m) => {
          const t = agrTotals[m.id]
          const r = byId[m.id]
          const cs = cands.filter((c) => c.partyId === m.id)
          const qp = official ? cs.filter((c) => officialStatus.get(c.id) === 'qp').length : r.qpSeats
          const avg = official ? cs.filter((c) => officialStatus.get(c.id) === 'media').length : r.averageSeats
          return {
            ...m,
            nominal: int(t?.tvtn),
            legenda: int(t?.tvtl),
            votes: r.votes,
            quotient: r.quotient,
            reaches80: r.reaches80,
            qpSeats: qp,
            averageSeats: avg,
            seats: qp + avg,
          }
        })
        .filter((p) => p.votes > 0 || p.seats > 0)
        .sort((a, b) => b.seats - a.seats || b.votes - a.votes)

      const validVotes = res.validVotes || 1
      const candidates: PropCandidate[] = cands
        .map((c) => ({
          id: c.id,
          number: c.id,
          name: c.name,
          party: c.party,
          partyId: c.partyId,
          votes: c.votes,
          pct: (c.votes / validVotes) * 100,
          photo: photoPath(cycle.tse, ele!, ufl, c.sq),
          outcome: (official ? officialStatus.get(c.id) : undefined) ?? res.outcome[c.id] ?? 'nao-eleito',
          registration: c.registration,
        }))
        .sort((a, b) => b.votes - a.votes)

      return {
        seats,
        validVotes: res.validVotes,
        nominal: int(abr.vnom),
        legenda: int(abr.vl),
        qe: res.qe,
        min10: res.min10,
        min20: res.min20,
        min80: res.min80,
        sectionsPct: num(abr.pst),
        turnoutPct: num(abr.pc),
        updatedAt: `${votes.dg} ${votes.hg}`,
        official,
        final: official || simplified?.tf?.toLowerCase() === 's',
        rule,
        parties,
        candidates,
      }
    },
  })
}

// ------------------------------------------------------------ candidatos (antes da eleição)

export interface PropSnapshotCandidate {
  id: string | number
  nomeUrna: string
  numero: string | number
  partido: string
  situacao?: string
  foto?: string
}

/** Retrato do DivulgaCand por cargo e UF: public/data/candidatos-<ano>/<cargo>/<uf>.json */
export function useProportionalCandidates(year: number, office: Office, uf: string) {
  return useQuery({
    queryKey: ['prop-candidates', year, office.slug, uf],
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/data/candidatos-${year}/${office.slug}/${uf.toLowerCase()}.json`)
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
      const data = (await res.json()) as { coletadoEm: string; candidatos: PropSnapshotCandidate[] }
      return {
        collectedAt: data.coletadoEm,
        candidates: data.candidatos
          .map((c) => ({
            id: String(c.id),
            name: titleCase(c.nomeUrna),
            number: String(c.numero),
            party: c.partido,
            status: c.situacao,
            photo: c.foto,
          }))
          .sort(byStatusThenName),
      }
    },
  })
}
