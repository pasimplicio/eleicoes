// Caminhos dos arquivos oficiais. Todos passam pelo proxy /tse (dev: Vite; prod: api/tse.ts).

const pad = (v: string, n: number) => v.padStart(n, '0')

export const BASE = '/tse'

/** abr: 'br', 'sp' ou 'sp71072' (UF + código TSE do município). */
export function simplifiedPath(tse: string, ele: string, office: string, abr: string) {
  const folder = abr.slice(0, 2)
  return `${BASE}/${tse}/${ele}/dados-simplificados/${folder}/${abr}-c${pad(office, 4)}-e${pad(ele, 6)}-r.json`
}

export function votesPath(tse: string, ele: string, office: string, uf: string, mun = '') {
  return `${BASE}/${tse}/${ele}/dados/${uf}/${uf}${mun}-c${pad(office, 4)}-e${pad(ele, 6)}-v.json`
}

export function fixedPath(tse: string, ele: string, uf: string, nadf: string) {
  return `${BASE}/${tse}/${ele}/dados/${uf}/${nadf}.json`
}

export function photoPath(tse: string, ele: string, abr: string, sqcand: string) {
  return `${BASE}/${tse}/${ele}/fotos/${abr}/${sqcand}.jpeg`
}

export const ELECTION_CONFIG_PATH = `${BASE}/comum/config/ele-c.json`
