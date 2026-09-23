// Distribuição de vagas nas eleições proporcionais (deputados e vereadores), conforme o
// Código Eleitoral (arts. 106 a 112, redação da Lei 14.211/2021), com federações
// partidárias tratadas como um único partido (Lei 14.208/2021).
//
//  1. Quociente eleitoral (QE, art. 106): votos válidos (nominais + legenda) / vagas,
//     desprezada a fração igual ou inferior a meio e arredondada para 1 se superior.
//  2. Quociente partidário (QP, art. 107): votos do partido / QE, desprezada a fração.
//     As vagas do QP vão aos mais votados do partido com pelo menos 10% do QE (art. 108).
//  3. Sobras (art. 109, I e II): maiores médias, votos / (vagas obtidas + 1), entre
//     partidos com pelo menos 80% do QE e que tenham candidato com pelo menos 20% do QE.
//  4. Terceira fase (art. 109, III): sem partido e candidato que atendam ao item 3, as
//     vagas restantes vão às maiores médias sem a exigência dos 20% para o candidato.
//     Até 2022, o TSE aplicou essa fase só a partidos com 80% do QE. A partir de 2024,
//     por decisão do STF (ADIs 7228, 7263 e 7325), todos os partidos participam.
//  5. Nenhum partido alcançou o QE (art. 111): eleitos os candidatos mais votados.
// Empate entre médias: maior votação do partido. Empate entre candidatos: o mais idoso.

export type ThirdPhaseRule = 'tse-2022' | 'stf-2024'

export interface PartyInput {
  id: string
  label: string
  nominal: number
  legenda: number
}

export interface CandidateInput {
  id: string
  partyId: string
  votes: number
  /** Pode receber vaga (registro válido). Votos "válidos para a legenda" não elegem. */
  eligible: boolean
  /** AAAA-MM-DD, para desempate por idade. */
  birth?: string
}

export type SeatKind = 'qp' | 'media'
export type CandidateOutcome = SeatKind | 'suplente' | 'nao-eleito'

export interface PartyResult {
  id: string
  label: string
  votes: number
  /** Votos / QE, sem arredondar. */
  quotient: number
  qpSeats: number
  averageSeats: number
  seats: number
  reaches80: boolean
}

export interface ProportionalResult {
  seats: number
  validVotes: number
  qe: number
  min10: number
  min20: number
  min80: number
  parties: PartyResult[]
  outcome: Record<string, CandidateOutcome>
  /** Ordem de preenchimento das vagas (útil para explicar a distribuição). */
  order: { candidateId: string; partyId: string; kind: SeatKind }[]
}

export function roundQE(validVotes: number, seats: number): number {
  const raw = validVotes / seats
  const frac = raw - Math.floor(raw)
  return frac > 0.5 ? Math.ceil(raw) : Math.floor(raw)
}

export function allocate(
  partiesIn: PartyInput[],
  candidatesIn: CandidateInput[],
  seats: number,
  rule: ThirdPhaseRule,
): ProportionalResult {
  const validVotes = partiesIn.reduce((s, p) => s + p.nominal + p.legenda, 0)
  const qe = seats > 0 ? roundQE(validVotes, seats) : 0
  const min10 = qe * 0.1
  const min20 = qe * 0.2
  const min80 = qe * 0.8

  const parties = new Map(
    partiesIn.map((p) => [
      p.id,
      { ...p, votes: p.nominal + p.legenda, qpSeats: 0, averageSeats: 0, seats: 0 },
    ]),
  )

  // Candidatos de cada partido, do mais votado ao menos; empate: o mais idoso.
  const byParty = new Map<string, CandidateInput[]>()
  for (const c of candidatesIn) {
    if (!c.eligible || !parties.has(c.partyId)) continue
    const list = byParty.get(c.partyId) ?? []
    list.push(c)
    byParty.set(c.partyId, list)
  }
  for (const list of byParty.values()) {
    list.sort((a, b) => b.votes - a.votes || (a.birth ?? '9999').localeCompare(b.birth ?? '9999'))
  }

  const outcome: Record<string, CandidateOutcome> = {}
  const order: ProportionalResult['order'] = []
  const taken = new Set<string>()
  let filled = 0

  const nextCandidate = (partyId: string, minVotes: number) =>
    (byParty.get(partyId) ?? []).find((c) => !taken.has(c.id) && c.votes >= minVotes)

  const give = (partyId: string, c: CandidateInput, kind: SeatKind) => {
    const p = parties.get(partyId)!
    taken.add(c.id)
    outcome[c.id] = kind
    order.push({ candidateId: c.id, partyId, kind })
    if (kind === 'qp') p.qpSeats++
    else p.averageSeats++
    p.seats++
    filled++
  }

  const anyReachesQE = [...parties.values()].some((p) => qe > 0 && p.votes >= qe)

  if (!anyReachesQE) {
    // Art. 111: nenhum partido atingiu o QE; eleitos os mais votados.
    const all = [...byParty.values()].flat().sort((a, b) => b.votes - a.votes)
    for (const c of all) {
      if (filled >= seats) break
      give(c.partyId, c, 'media')
    }
  } else {
    // Fase 1: quociente partidário, candidatos com 10% do QE.
    for (const p of parties.values()) {
      const qp = Math.floor(p.votes / qe)
      for (let i = 0; i < qp && filled < seats; i++) {
        const c = nextCandidate(p.id, min10)
        if (!c) break
        give(p.id, c, 'qp')
      }
    }

    // Fases 2 e 3: maiores médias.
    const bestAverage = (phase: 2 | 3) => {
      let best: { id: string; avg: number; votes: number; cand: CandidateInput } | undefined
      for (const p of parties.values()) {
        const partyOk =
          phase === 2 || rule === 'tse-2022' ? p.votes >= min80 : p.votes > 0
        if (!partyOk) continue
        const cand = nextCandidate(p.id, phase === 2 ? min20 : 0)
        if (!cand) continue
        const avg = p.votes / (p.seats + 1)
        if (!best || avg > best.avg || (avg === best.avg && p.votes > best.votes)) {
          best = { id: p.id, avg, votes: p.votes, cand }
        }
      }
      return best
    }

    while (filled < seats) {
      const pick = bestAverage(2) ?? bestAverage(3)
      if (!pick) break
      give(pick.id, pick.cand, 'media')
    }
  }

  // Suplentes: não eleitos de partidos que obtiveram vaga (art. 112).
  for (const c of candidatesIn) {
    if (outcome[c.id]) continue
    const p = parties.get(c.partyId)
    outcome[c.id] = p && p.seats > 0 && c.eligible && c.votes > 0 ? 'suplente' : 'nao-eleito'
  }

  return {
    seats,
    validVotes,
    qe,
    min10,
    min20,
    min80,
    parties: [...parties.values()]
      .map((p) => ({
        id: p.id,
        label: p.label,
        votes: p.votes,
        quotient: qe ? p.votes / qe : 0,
        qpSeats: p.qpSeats,
        averageSeats: p.averageSeats,
        seats: p.seats,
        reaches80: p.votes >= min80,
      }))
      .sort((a, b) => b.seats - a.seats || b.votes - a.votes),
    outcome,
    order,
  }
}

/** Regra da terceira fase vigente no ano da eleição. */
export function thirdPhaseRule(year: number): ThirdPhaseRule {
  return year >= 2024 ? 'stf-2024' : 'tse-2022'
}
