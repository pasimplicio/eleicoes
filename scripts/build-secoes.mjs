// Gera os arquivos de seções eleitorais com coordenadas para o mapa de seções, a partir do
// arquivo de locais de votação dos dados abertos do TSE:
//   https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_<ano>.zip
// Uso: node scripts/build-secoes.mjs <pasta com os CSVs extraídos> [ano]
// Saída: public/data/secoes-<ano>/<uf>/<municipio TSE>.json (um arquivo por município)
//   { locais: [[local, nome, endereço, bairro, lat, lng, zona, [[seção, aptos, principal?], ...]], ...] }
// Seções agregadas não têm urna própria: os votos entram no boletim da seção principal.
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
const ano = process.argv[3] ?? '2026'
if (!src) throw new Error('Informe a pasta com os CSVs: node scripts/build-secoes.mjs <pasta> [ano]')

const OUT = join(ROOT, 'public', 'data', `secoes-${ano}`)
await rm(OUT, { recursive: true, force: true })

const files = (await readdir(src)).filter((f) => /_[A-Z]{2}\.csv$/.test(f) && !f.endsWith('_ZZ.csv') && !f.includes('BRASIL'))
let totalSecoes = 0
let semCoordenada = 0

for (const file of files.sort()) {
  const uf = file.match(/_([A-Z]{2})\.csv$/)[1].toLowerCase()
  const lines = (await readFile(join(src, file), 'latin1')).split(/\r?\n/)
  const head = lines[0].split(';').map((h) => h.replace(/"/g, ''))
  const col = Object.fromEntries(head.map((h, i) => [h, i]))
  const num = (v) => Number(String(v).replace(',', '.'))

  // município -> local -> dados do local + seções
  const byMun = new Map()
  for (const line of lines.slice(1)) {
    if (!line) continue
    const c = line.split(';').map((x) => x.replace(/^"|"$/g, ''))
    if (c[col.NR_TURNO] !== '1') continue // as seções são as mesmas nos dois turnos
    const mun = c[col.CD_MUNICIPIO].padStart(5, '0')
    const zona = Number(c[col.NR_ZONA])
    const local = Number(c[col.NR_LOCAL_VOTACAO])
    const lat = num(c[col.NR_LATITUDE])
    const lng = num(c[col.NR_LONGITUDE])
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === -1 || lng === -1) {
      semCoordenada++
      continue
    }
    const key = `${zona}-${local}`
    const locais = byMun.get(mun) ?? new Map()
    byMun.set(mun, locais)
    const entry =
      locais.get(key) ??
      [local, c[col.NM_LOCAL_VOTACAO], c[col.DS_ENDERECO], c[col.NM_BAIRRO], Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, zona, []]
    locais.set(key, entry)
    const secao = Number(c[col.NR_SECAO])
    const aptos = Number(c[col.QT_ELEITOR_SECAO]) || 0
    const principal = Number(c[col.NR_SECAO_PRINCIPAL])
    entry[7].push(c[col.DS_TIPO_SECAO_AGREGADA] === 'Agregada' && principal > 0 ? [secao, aptos, principal] : [secao, aptos])
    totalSecoes++
  }

  for (const [mun, locais] of byMun) {
    const list = [...locais.values()].sort((a, b) => a[6] - b[6] || a[0] - b[0])
    for (const l of list) l[7].sort((a, b) => a[0] - b[0])
    await mkdir(join(OUT, uf), { recursive: true })
    await writeFile(join(OUT, uf, `${mun}.json`), JSON.stringify({ locais: list }))
  }
  console.log(`${uf}: ${byMun.size} municípios`)
}
console.log(`${totalSecoes} seções; ${semCoordenada} sem coordenada (fora do mapa)`)
