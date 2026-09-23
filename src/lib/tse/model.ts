// Modelo interno normalizado. A interface consome apenas estes tipos; se o TSE
// mudar o formato num ciclo futuro, basta um novo adapter.

export interface CandidateResult {
  id: string
  number: string
  name: string
  vice?: string
  party: string
  coalition?: string
  votes: number
  pct: number
  elected: boolean
  runoff: boolean
  status: string
  photo?: string
}

export interface Totals {
  sectionsPct: number
  electorate: number
  turnout: number
  turnoutPct: number
  abstention: number
  abstentionPct: number
  valid: number
  blank: number
  nulls: number
}

export interface ResultSummary extends Totals {
  electionId: string
  officeCode: string
  turn: number
  /** 'br', sigla da UF ou código TSE do município. */
  scope: string
  updatedAt: string
  final: boolean
  candidates: CandidateResult[]
}
