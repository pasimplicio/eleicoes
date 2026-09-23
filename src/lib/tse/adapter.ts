import { titleCase } from '../format'
import type { CandidateResult, ResultSummary, Totals } from './model'
import type { RawFixed, RawSimplified, RawTotals, RawVotes } from './raw'

const int = (v?: string) => (v ? Number.parseInt(v, 10) || 0 : 0)
const pct = (v?: string) => (v ? Number.parseFloat(v.replace(',', '.')) || 0 : 0)

/** "PT - Federação Brasil da Esperança..." -> "PT" */
function partyFromCoalition(cc: string): string {
  return cc.split(' - ')[0]?.trim() ?? ''
}

function status(st: string) {
  return { elected: /^eleito/i.test(st), runoff: /2º turno/i.test(st), status: st }
}

function totals(r: RawTotals): Totals {
  const turnout = int(r.c)
  return {
    sectionsPct: pct(r.pst),
    electorate: int(r.e),
    turnout,
    turnoutPct: pct(r.pc),
    abstention: int(r.a),
    abstentionPct: pct(r.pa),
    valid: int(r.vv),
    blank: int(r.vb),
    nulls: int(r.tvn),
  }
}

const byVotes = (a: CandidateResult, b: CandidateResult) => b.votes - a.votes

export function adaptSimplified(raw: RawSimplified, photoUrl: (sqcand: string) => string): ResultSummary {
  return {
    ...totals(raw),
    electionId: raw.ele,
    officeCode: raw.carper,
    turn: int(raw.t),
    scope: raw.cdabr,
    updatedAt: `${raw.dt || raw.dg} ${raw.ht || raw.hg}`,
    final: raw.tf?.toLowerCase() === 's',
    candidates: raw.cand
      .map<CandidateResult>((c) => ({
        id: c.sqcand,
        number: c.n,
        name: titleCase(c.nm),
        vice: c.nv ? titleCase(c.nv) : undefined,
        party: partyFromCoalition(c.cc),
        coalition: c.cc,
        votes: int(c.vap),
        pct: pct(c.pvap),
        photo: photoUrl(c.sqcand),
        ...status(c.st),
      }))
      .sort(byVotes),
  }
}

export interface FixedCandidate {
  id: string
  name: string
  party: string
  vice?: string
}

export function adaptFixed(raw: RawFixed): Map<string, FixedCandidate> {
  const map = new Map<string, FixedCandidate>()
  for (const agr of raw.carg.agr) {
    for (const par of agr.par) {
      for (const c of par.cand) {
        map.set(c.n, {
          id: c.sqcand,
          name: titleCase(c.nmu || c.nm),
          party: par.sg,
          vice: c.vs?.[0]?.nmu ? titleCase(c.vs[0].nmu) : undefined,
        })
      }
    }
  }
  return map
}

/** Resultado de um município (ou UF) a partir do arquivo -v, com nomes do arquivo fixo. */
export function adaptVotes(
  raw: RawVotes,
  names: Map<string, FixedCandidate>,
  photoUrl: (sqcand: string) => string,
): ResultSummary | undefined {
  const abr = raw.abr.find((a) => a.tpabr === 'MU' || a.tpabr === 'UF') ?? raw.abr[0]
  if (!abr) return undefined
  return {
    ...totals(abr),
    electionId: raw.ele,
    officeCode: raw.carper,
    turn: int(raw.t),
    scope: abr.cdabr,
    updatedAt: `${abr.dt || raw.dg} ${abr.ht || raw.hg}`,
    final: abr.tf?.toLowerCase() === 's',
    candidates: abr.cand
      .map<CandidateResult>((c) => {
        const info = names.get(c.n)
        return {
          id: info?.id ?? c.n,
          number: c.n,
          name: info?.name ?? `Candidato ${c.n}`,
          vice: info?.vice,
          party: info?.party ?? '',
          votes: int(c.vap),
          pct: pct(c.pvap),
          photo: info ? photoUrl(info.id) : undefined,
          ...status(c.st),
        }
      })
      .sort(byVotes),
  }
}
