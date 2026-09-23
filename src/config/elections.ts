// Modelo dos ciclos eleitorais. Eleições ocorrem em anos pares, alternando:
//   - gerais (2022, 2026, 2030...): presidente, governador, senador, deputados
//   - municipais (2024, 2028, 2032...): prefeito e vereador
// 1º turno no primeiro domingo de outubro e 2º turno no último (CF, art. 77).
// Os códigos de eleição do TSE (ex.: 544) mudam a cada ciclo: os conhecidos ficam em
// KNOWN_IDS e os do ciclo corrente são descobertos na config pública do TSE
// (ver lib/tse/discovery.ts). Um ciclo novo não exige mudança de código.

export type Level = 'federal' | 'estadual' | 'municipal'
export type CycleKind = 'geral' | 'municipal'
export type Turn = 1 | 2

export interface Office {
  /** Código do cargo no TSE (c0001 = presidente). */
  code: string
  slug: string
  name: string
  /** Nível da eleição no TSE que contém o cargo. */
  level: Level
  /** Abrangência do resultado principal. */
  scope: 'br' | 'uf' | 'mu'
  system: 'majoritario' | 'proporcional'
  hasRunoff: boolean
}

export type ElectionIds = Partial<Record<Turn, Partial<Record<Level, string>>>>

export interface Cycle {
  year: number
  kind: CycleKind
  /** Pasta do ciclo no servidor de resultados (ex.: ele2026). */
  tse: string
  dates: Record<Turn, string>
  offices: Office[]
}

const GENERAL_OFFICES: Office[] = [
  { code: '1', slug: 'presidente', name: 'Presidente', level: 'federal', scope: 'br', system: 'majoritario', hasRunoff: true },
  { code: '3', slug: 'governador', name: 'Governador', level: 'estadual', scope: 'uf', system: 'majoritario', hasRunoff: true },
  { code: '5', slug: 'senador', name: 'Senador', level: 'estadual', scope: 'uf', system: 'majoritario', hasRunoff: false },
  { code: '6', slug: 'deputado-federal', name: 'Deputado Federal', level: 'estadual', scope: 'uf', system: 'proporcional', hasRunoff: false },
  { code: '7', slug: 'deputado-estadual', name: 'Deputado Estadual', level: 'estadual', scope: 'uf', system: 'proporcional', hasRunoff: false },
]

const MUNICIPAL_OFFICES: Office[] = [
  { code: '11', slug: 'prefeito', name: 'Prefeito', level: 'municipal', scope: 'mu', system: 'majoritario', hasRunoff: true },
  { code: '13', slug: 'vereador', name: 'Vereador', level: 'municipal', scope: 'mu', system: 'proporcional', hasRunoff: false },
]

/** Códigos de eleição já publicados pelo TSE. */
export const KNOWN_IDS: Record<number, ElectionIds> = {
  2022: { 1: { federal: '544', estadual: '546' }, 2: { federal: '545', estadual: '547' } },
  2024: { 1: { municipal: '619' }, 2: { municipal: '620' } },
}

function sundayOfOctober(year: number, which: 'first' | 'last'): string {
  if (which === 'first') {
    const d = new Date(Date.UTC(year, 9, 1))
    d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7))
    return d.toISOString().slice(0, 10)
  }
  const d = new Date(Date.UTC(year, 9, 31))
  d.setUTCDate(31 - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

export function getCycle(year: number): Cycle | undefined {
  if (year < 2022 || year % 2 !== 0) return undefined
  const kind: CycleKind = year % 4 === 2 ? 'geral' : 'municipal'
  return {
    year,
    kind,
    tse: `ele${year}`,
    dates: { 1: sundayOfOctober(year, 'first'), 2: sundayOfOctober(year, 'last') },
    offices: kind === 'geral' ? GENERAL_OFFICES : MUNICIPAL_OFFICES,
  }
}

export function findOffice(cycle: Cycle, slug?: string): Office | undefined {
  return cycle.offices.find((o) => o.slug === slug)
}

/** Relógio do portal (horário real). */
export const appNow = () => new Date()

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
export function todayBrasilia(now = appNow()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)
}

/** Ciclo em destaque: o do ano eleitoral corrente ou, em ano ímpar, o próximo. */
export function currentYear(now = appNow()): number {
  const year = Number(todayBrasilia(now).slice(0, 4))
  return year % 2 === 0 ? year : year + 1
}

/** Último ciclo do mesmo tipo (referência enquanto o atual não tem resultados). */
export function previousCycleOfKind(year: number): number {
  return year - 4
}
