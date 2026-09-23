// Configuração do telão, no mesmo modelo do modo TV do app Resultados do TSE
// (resultados.tse.jus.br/oficial/app/#/telao): uma lista de abrangências (cargo +
// localidade) exibidas em rodízio, cada uma por N segundos, com a opção de intercalar
// a tela de acompanhamento geral (mapa da totalização por UF).
import { currentYear } from '../config/elections'

export interface TelaoAbrangencia {
  cargo: string // slug do cargo (presidente, governador, senador)
  uf: string // 'BR' ou sigla da UF
}

export interface TelaoConfig {
  ano: number
  segundos: number
  mostrarAcompanhamentoGeral: boolean
  abrangencias: TelaoAbrangencia[]
}

export type TelaoModulo = { tipo: 'acompanhamento-geral'; cargo: string } | ({ tipo: 'abrangencia' } & TelaoAbrangencia)

const KEY = 'telao.config'

export const defaultTelaoConfig = (): TelaoConfig => ({
  ano: currentYear(),
  segundos: 15,
  mostrarAcompanhamentoGeral: true,
  abrangencias: [{ cargo: 'presidente', uf: 'BR' }],
})

export function loadTelaoConfig(): TelaoConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const c = JSON.parse(raw) as TelaoConfig
      if (Array.isArray(c.abrangencias) && c.abrangencias.length) return c
    }
  } catch {
    /* armazenamento indisponível ou configuração inválida */
  }
  return defaultTelaoConfig()
}

export function saveTelaoConfig(c: TelaoConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* armazenamento indisponível */
  }
}

/** Roteiro de telas, como no TSE: acompanhamento geral (opcional) antes de cada abrangência. */
export function roteiro(c: TelaoConfig): TelaoModulo[] {
  const out: TelaoModulo[] = []
  for (const a of c.abrangencias) {
    if (c.mostrarAcompanhamentoGeral) out.push({ tipo: 'acompanhamento-geral', cargo: a.cargo })
    out.push({ tipo: 'abrangencia', ...a })
  }
  return out
}
