// Pesquisas eleitorais (Quaest e Datafolha) servidas por api/pesquisas.ts, a partir do g1.
import { useQuery } from '@tanstack/react-query'
import { knownPartyColor, partyColor } from '../config/parties'

export type Instituto = 'Quaest' | 'Datafolha'
export const INSTITUTOS: Instituto[] = ['Quaest', 'Datafolha']
export type CargoPesquisa = 'presidente' | 'governador' | 'senador'

export interface Pergunta {
  id: string
  label: string
}
export interface PaginaPesquisa {
  existe: boolean
  pagina?: string
  perguntas: Pergunta[]
  padrao?: string
  metodologia?: string
  url: string
}
export interface SeriePesquisa {
  nome: string
  partido?: string
  cor?: string
  foto?: string
  pontos: { data: string; valor: number }[]
}
export interface GraficoPesquisa {
  margem?: number
  series: SeriePesquisa[]
}
export interface LiderUf {
  uf: string
  data: string
  pergunta: string
  lider: { nome: string; partido?: string; valor: number }
  segundo?: { nome: string; partido?: string; valor: number }
}

/** Respostas que não são candidatos (brancos, nulos, indecisos). */
export const NAO_CANDIDATO = /branco|nulo|nenhum|indecis|não sabe|nao sabe|não vai|outros/i

// Siglas como o g1 publica -> siglas da paleta do portal.
const ALIAS: Record<string, string> = { REP: 'REPUBLICANOS', UNIAO: 'UNIÃO', 'PC DO B': 'PC do B', PCDOB: 'PC do B', MISSAO: 'MISSÃO' }

/** Cor da série: a do partido na paleta do portal; senão a publicada pelo g1. */
export function serieColor(s: { partido?: string; cor?: string; nome: string }, index = 0): string {
  if (NAO_CANDIDATO.test(s.nome)) return '#9aa1ab'
  const sigla = s.partido?.trim()
  const key = sigla ? (ALIAS[sigla.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] ?? sigla) : undefined
  return knownPartyColor(key) ?? s.cor ?? partyColor(undefined, index)
}

async function get<T>(params: Record<string, string>): Promise<T | null> {
  const res = await fetch(`/api/pesquisas?${new URLSearchParams(params)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Pesquisas: HTTP ${res.status}`)
  return (await res.json()) as T
}

const STALE = 10 * 60_000

export function usePaginaPesquisa(cargo: CargoPesquisa, uf: string, instituto: Instituto) {
  return useQuery({
    queryKey: ['pesq-pagina', cargo, uf, instituto],
    queryFn: () => get<PaginaPesquisa>({ tipo: 'pagina', cargo, uf, instituto }),
    staleTime: STALE,
  })
}

export function useGraficoPesquisa(pagina: string | undefined, pergunta: string | undefined, instituto: Instituto) {
  return useQuery({
    queryKey: ['pesq-grafico', pagina, pergunta, instituto],
    queryFn: () => get<GraficoPesquisa>({ tipo: 'grafico', pagina: pagina!, pergunta: pergunta!, instituto }),
    enabled: Boolean(pagina && pergunta),
    staleTime: STALE,
  })
}

export function useMapaPesquisa(cargo: CargoPesquisa, instituto: Instituto) {
  return useQuery({
    queryKey: ['pesq-mapa', cargo, instituto],
    queryFn: async () => (await get<LiderUf[]>({ tipo: 'mapa', cargo, instituto })) ?? [],
    staleTime: STALE,
  })
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "2026-09-21" -> "21 set" */
export const fmtDia = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`

// Rótulo curto: sem títulos de urna ("Escritor", "Policial"...) e com até 17 letras.
const TITULOS = /^(escritora?|veterin[aá]ri[oa]|policial|professora?|pastora?|delegad[oa]|coronel|capit[aã]o|general|doutora?|dra?\.?)\s+/i
export function nomeCurto(nome: string): string {
  let n = nome.trim()
  while (TITULOS.test(n)) n = n.replace(TITULOS, '')
  if (n.length <= 17) return n
  const partes = n.split(' ')
  const fim = partes.slice(-2).join(' ')
  return fim.length <= 17 ? fim : partes[0]
}
