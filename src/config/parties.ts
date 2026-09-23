// Cores editoriais por partido, usadas no mapa e nas barras de resultado.
// Chave: sigla exatamente como o TSE publica no início do campo de coligação.
const PARTY_COLORS: Record<string, string> = {
  PT: '#c8102e',
  PL: '#1b3f8b',
  'UNIÃO': '#2b7bd6',
  PSD: '#f28c28',
  MDB: '#2e8b57',
  PP: '#5fa8e8',
  REPUBLICANOS: '#0e7c86',
  PSDB: '#0079c1',
  PSB: '#e6b800',
  PDT: '#e05a2b',
  PSOL: '#7b2d8e',
  'PC do B': '#8b0000',
  PV: '#3fa34d',
  REDE: '#00a19a',
  NOVO: '#ff6a13',
  PODE: '#1fa59a',
  CIDADANIA: '#d6336c',
  AVANTE: '#2bb3c0',
  SOLIDARIEDADE: '#f06a3a',
  PRD: '#3d4db7',
  PTB: '#4f5d6b',
  PRTB: '#556b2f',
  DC: '#8d6e63',
  AGIR: '#a1887f',
  MOBILIZA: '#6d4c41',
  PMB: '#9c27b0',
  PCB: '#b71c1c',
  PCO: '#a31515',
  PSTU: '#d32f2f',
  UP: '#262626',
  PROS: '#ef7d00',
  PSC: '#00897b',
  PMN: '#795548',
  PATRIOTA: '#2e7d32',
}

const FALLBACK = ['#64748b', '#8b5cf6', '#0ea5e9', '#14b8a6', '#a3a3a3', '#f43f5e']

export function partyColor(sigla: string | undefined, index = 0): string {
  if (sigla && PARTY_COLORS[sigla]) return PARTY_COLORS[sigla]
  return FALLBACK[index % FALLBACK.length]
}
