import { titleCase } from '../format'
import type { CandidateResult, ResultSummary, Totals } from './model'
import type { RawFixed, RawSimplified, RawTotals, RawUnified, RawVotes } from './raw'

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
    sectionsCounted: int(r.st),
    sectionsTotal: int(r.s),
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

// ------------------------------------------------------------ formato unificado (2026)

const flatCandidates = (raw: RawUnified) =>
  (raw.carg[0]?.agr ?? []).flatMap((a) => a.par.flatMap((p) => p.cand.map((c) => ({ c, par: p, agr: a }))))

export function adaptUnified(raw: RawUnified, photoUrl: (sqcand: string) => string): ResultSummary {
  const turnout = int(raw.e?.c)
  return {
    sectionsPct: pct(raw.s?.pst),
    sectionsCounted: int(raw.s?.st),
    sectionsTotal: int(raw.s?.ts),
    electorateCounted: raw.e?.est ? int(raw.e.est) : undefined,
    electorate: int(raw.e?.te),
    turnout,
    turnoutPct: pct(raw.e?.pc),
    abstention: int(raw.e?.a),
    abstentionPct: pct(raw.e?.pa),
    valid: int(raw.v?.vv),
    blank: int(raw.v?.vb),
    nulls: int(raw.v?.tvn),
    electionId: raw.ele,
    officeCode: raw.carg[0]?.cd ?? '',
    turn: int(raw.t),
    scope: raw.cdabr,
    updatedAt: `${raw.dt || raw.dg} ${raw.ht || raw.hg}`,
    final: raw.tf?.toLowerCase() === 's',
    candidates: flatCandidates(raw)
      .map<CandidateResult>(({ c, par, agr }) => {
        const vice = c.vs?.find((v) => v.tp === 'v') ?? c.vs?.[0]
        const st = status(c.st ?? '')
        return {
          id: c.sqcand,
          number: c.n,
          name: titleCase(c.nmu || c.nm),
          vice: vice ? titleCase(vice.nmu || vice.nm) : undefined,
          party: par.sg,
          coalition: agr.tp === 'i' ? undefined : agr.com,
          votes: int(c.vap),
          pct: pct(c.pvap),
          photo: photoUrl(c.sqcand),
          // A situação vem de "st" ("Eleito", "2º turno", "Não eleito"). O campo "e" do
          // formato unificado também vale "s" para quem vai ao 2º turno, então não serve.
          ...st,
        }
      })
      .sort(byVotes),
  }
}

/** Nomes e partidos por número, a partir do arquivo unificado. */
export function unifiedNames(raw: RawUnified): Map<string, FixedCandidate> {
  const map = new Map<string, FixedCandidate>()
  for (const { c, par } of flatCandidates(raw)) {
    map.set(c.n, { id: c.sqcand, name: titleCase(c.nmu || c.nm), party: par.sg })
  }
  return map
}

/**
 * Soma de várias abrangências (ex.: os estados de uma região). Votos, urnas e eleitorado
 * são somados; os percentuais são recalculados sobre as somas, como o TSE calcula.
 */
export function aggregateResults(results: ResultSummary[], scope: string): ResultSummary | undefined {
  if (!results.length) return undefined
  const sum = (f: (r: ResultSummary) => number | undefined) => results.reduce((t, r) => t + (f(r) ?? 0), 0)
  const sectionsCounted = sum((r) => r.sectionsCounted)
  const sectionsTotal = sum((r) => r.sectionsTotal)
  const turnout = sum((r) => r.turnout)
  const abstention = sum((r) => r.abstention)
  const base = sum((r) => r.electorateCounted ?? r.turnout + r.abstention) || 1
  const valid = sum((r) => r.valid)
  const byId = new Map<string, CandidateResult>()
  for (const r of results) {
    for (const c of r.candidates) {
      const cur = byId.get(c.id)
      byId.set(c.id, cur ? { ...cur, votes: cur.votes + c.votes } : { ...c })
    }
  }
  const first = results[0]
  return {
    sectionsPct: sectionsTotal ? (sectionsCounted / sectionsTotal) * 100 : 0,
    sectionsCounted,
    sectionsTotal,
    electorateCounted: base,
    electorate: sum((r) => r.electorate),
    turnout,
    turnoutPct: (turnout / base) * 100,
    abstention,
    abstentionPct: (abstention / base) * 100,
    valid,
    blank: sum((r) => r.blank),
    nulls: sum((r) => r.nulls),
    electionId: first.electionId,
    officeCode: first.officeCode,
    turn: Math.max(...results.map((r) => r.turn)),
    scope,
    updatedAt: results.map((r) => r.updatedAt).sort((a, b) => sortable(b).localeCompare(sortable(a)))[0],
    final: results.every((r) => r.final),
    candidates: [...byId.values()]
      .map((c) => ({ ...c, pct: valid ? (c.votes / valid) * 100 : 0, elected: false, runoff: false, status: '' }))
      .sort(byVotes),
  }
}

/** "04/10/2026 17:24:02" -> "20261004 17:24:02" */
const sortable = (s: string) => (s ? `${s.slice(6, 10)}${s.slice(3, 5)}${s.slice(0, 2)}${s.slice(10)}` : '')
