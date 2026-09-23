export type Region = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul'

export interface Uf {
  sigla: string
  nome: string
  ibge: string
  regiao: Region
}

export const UFS: Uf[] = [
  { sigla: 'AC', nome: 'Acre', ibge: '12', regiao: 'Norte' },
  { sigla: 'AL', nome: 'Alagoas', ibge: '27', regiao: 'Nordeste' },
  { sigla: 'AP', nome: 'Amapá', ibge: '16', regiao: 'Norte' },
  { sigla: 'AM', nome: 'Amazonas', ibge: '13', regiao: 'Norte' },
  { sigla: 'BA', nome: 'Bahia', ibge: '29', regiao: 'Nordeste' },
  { sigla: 'CE', nome: 'Ceará', ibge: '23', regiao: 'Nordeste' },
  { sigla: 'DF', nome: 'Distrito Federal', ibge: '53', regiao: 'Centro-Oeste' },
  { sigla: 'ES', nome: 'Espírito Santo', ibge: '32', regiao: 'Sudeste' },
  { sigla: 'GO', nome: 'Goiás', ibge: '52', regiao: 'Centro-Oeste' },
  { sigla: 'MA', nome: 'Maranhão', ibge: '21', regiao: 'Nordeste' },
  { sigla: 'MT', nome: 'Mato Grosso', ibge: '51', regiao: 'Centro-Oeste' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', ibge: '50', regiao: 'Centro-Oeste' },
  { sigla: 'MG', nome: 'Minas Gerais', ibge: '31', regiao: 'Sudeste' },
  { sigla: 'PA', nome: 'Pará', ibge: '15', regiao: 'Norte' },
  { sigla: 'PB', nome: 'Paraíba', ibge: '25', regiao: 'Nordeste' },
  { sigla: 'PR', nome: 'Paraná', ibge: '41', regiao: 'Sul' },
  { sigla: 'PE', nome: 'Pernambuco', ibge: '26', regiao: 'Nordeste' },
  { sigla: 'PI', nome: 'Piauí', ibge: '22', regiao: 'Nordeste' },
  { sigla: 'RJ', nome: 'Rio de Janeiro', ibge: '33', regiao: 'Sudeste' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', ibge: '24', regiao: 'Nordeste' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', ibge: '43', regiao: 'Sul' },
  { sigla: 'RO', nome: 'Rondônia', ibge: '11', regiao: 'Norte' },
  { sigla: 'RR', nome: 'Roraima', ibge: '14', regiao: 'Norte' },
  { sigla: 'SC', nome: 'Santa Catarina', ibge: '42', regiao: 'Sul' },
  { sigla: 'SP', nome: 'São Paulo', ibge: '35', regiao: 'Sudeste' },
  { sigla: 'SE', nome: 'Sergipe', ibge: '28', regiao: 'Nordeste' },
  { sigla: 'TO', nome: 'Tocantins', ibge: '17', regiao: 'Norte' },
]

export const UF_BY_SIGLA = Object.fromEntries(UFS.map((u) => [u.sigla, u])) as Record<string, Uf>
export const UF_BY_IBGE = Object.fromEntries(UFS.map((u) => [u.ibge, u])) as Record<string, Uf>

// Artigo usado com o nome de cada UF ("no Rio de Janeiro", "na Bahia", "em São Paulo").
const ARTICLE: Record<string, 'o' | 'a' | ''> = {
  AC: 'o', AP: 'o', AM: 'o', CE: 'o', DF: 'o', ES: 'o', MA: 'o', MT: 'o', MS: 'o', PA: 'o', PR: 'o', PI: 'o',
  RJ: 'o', RN: 'o', RS: 'o', BA: 'a', PB: 'a',
}

/** "no Distrito Federal", "na Bahia", "em São Paulo" */
export const inUf = (uf: Uf) => ({ o: 'no', a: 'na', '': 'em' })[ARTICLE[uf.sigla] ?? ''] + ' ' + uf.nome
/** "do Distrito Federal", "da Bahia", "de São Paulo" */
export const ofUf = (uf: Uf) => ({ o: 'do', a: 'da', '': 'de' })[ARTICLE[uf.sigla] ?? ''] + ' ' + uf.nome

export function findUf(sigla?: string): Uf | undefined {
  return sigla ? UF_BY_SIGLA[sigla.toUpperCase()] : undefined
}
