// Formato cru dos arquivos do servidor de resultados do TSE. Os campos usam
// abreviações do próprio TSE; nada fora de lib/tse deve depender destes tipos.

/** Totais comuns a arquivos simplificados (-r) e de votação (-v). */
export interface RawTotals {
  s: string // seções
  st: string // seções totalizadas
  pst: string
  e: string // eleitorado
  c: string // comparecimento
  pc: string
  a: string // abstenção
  pa: string
  vb: string // brancos
  pvb?: string
  tvn: string // nulos
  ptvn?: string
  vv: string // válidos
  pvv?: string
  pvvc?: string
}

export interface RawSimplifiedCandidate {
  seq: string
  sqcand: string
  n: string
  nm: string
  cc: string
  nv: string
  e: string
  st: string
  dvt: string
  vap: string
  pvap: string
}

/** Arquivo simplificado: dados-simplificados/<abr>/<abr>-cNNNN-eNNNNNN-r.json */
export interface RawSimplified extends RawTotals {
  ele: string
  tpabr: string
  cdabr: string
  carper: string
  t: string
  dg: string
  hg: string
  dt: string
  ht: string
  tf: string // totalização final (s/n)
  cand: RawSimplifiedCandidate[]
}

export interface RawVoteCandidate {
  seq: string
  n: string
  vap: string
  pvap: string
  e: string
  st: string
}

/** Arquivo de votação por abrangência: dados/<uf>/<uf><mun>-cNNNN-eNNNNNN-v.json */
export interface RawVotes {
  ele: string
  carper: string
  t: string
  dg: string
  hg: string
  nadf: string // nome do arquivo fixo de candidatos
  abr: (RawTotals & {
    tpabr: string
    cdabr: string
    dt: string
    ht: string
    tf: string
    cand: RawVoteCandidate[]
  })[]
}

/** Arquivo fixo de candidatos (-f): nomes, partidos e sequenciais. */
export interface RawFixed {
  carg: {
    cd: string
    agr: {
      nm: string
      com: string
      par: {
        n: string
        sg: string
        cand: { n: string; sqcand: string; nm: string; nmu: string; dvt: string; vs?: { nmu: string }[] }[]
      }[]
    }[]
  }
}

/** Config pública de eleições do ciclo corrente: comum/config/ele-c.json */
export interface RawElectionConfig {
  /** Formato antigo (até 2024): pasta do ciclo. O formato de 2026 lista todas as eleições. */
  c?: string
  pl: {
    cd: string
    dt: string
    e: { cd: string; t: string; nm: string; tp: string; abr?: { cd: string; cp?: { cd: string }[] }[] }[]
  }[]
}

/** Candidato no arquivo unificado (-u), formato de 2026. */
export interface RawUnifiedCandidate {
  n: string
  sqcand: string
  nm: string
  nmu: string
  dt: string
  dvt: string
  seq: string
  e: string // eleito (s/n)
  st: string // situação ("Eleito", "2º turno", "Eleito por QP"...)
  vap: string
  pvap: string
  vs?: { tp: string; nmu: string; nm: string }[]
}

/**
 * Arquivo unificado de 2026: dados/<uf>/<abr>-cNNNN-eNNNNNN-u.json. Substitui o
 * simplificado (-r), o de votação (-v) e o fixo (-f): candidatos, agremiações e totais.
 */
export interface RawUnified {
  ele: string
  t: string
  tpabr: string
  cdabr: string
  dg: string
  hg: string
  dt: string
  ht: string
  tf: string
  carg: {
    cd: string
    nv: string
    fed?: { n: string; sg: string; nm: string; com: string; npar: string[] }[]
    agr: {
      n: string
      nm: string
      tp: string // i: partido isolado, c: coligação, f: federação
      com: string
      vag?: string
      par: {
        n: string
        sg: string
        nm: string
        nfed: string
        tvtn?: string // votos nominais
        tvtl?: string // votos de legenda
        cand: RawUnifiedCandidate[]
      }[]
    }[]
  }[]
  s: { ts: string; st: string; pst: string }
  e: { te: string; c: string; pc: string; a: string; pa: string }
  v: { vv: string; vnom?: string; vl?: string; vb: string; tvn: string }
}
