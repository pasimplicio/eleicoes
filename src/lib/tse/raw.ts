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
  c: string
  pl: {
    cd: string
    dt: string
    e: { cd: string; t: string; nm: string; tp: string; abr?: { cd: string; cp?: { cd: string }[] }[] }[]
  }[]
}
