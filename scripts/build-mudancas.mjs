// Seções que mudaram de local de votação, a partir do arquivo de locais de votação dos dados
// abertos do TSE (eleitorado_local_votacao_<ano>.zip), que traz uma linha por seção em cada turno
// e o local original da seção.
// Uso: node scripts/build-mudancas.mjs <pasta com os CSVs extraídos> [ano]
// Saída: public/data/secoes-<ano>-mudancas.json
//   mudancas: [uf, mun TSE, município, zona, seção, aptos, tipo, antes, depois]
//   tipo "turno": local (ou endereço) do 2º turno diferente do 1º; antes = local do 1º turno
//   tipo "original": já no 1º turno a seção votava fora do local original; antes = local original
//   antes/depois: [nome, endereço, bairro, lat, lng] (o local original não tem coordenadas: null)
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
const ano = process.argv[3] ?? '2026'
if (!src) throw new Error('Informe a pasta com os CSVs: node scripts/build-mudancas.mjs <pasta> [ano]')

const files = (await readdir(src)).filter((f) => /_[A-Z]{2}\.csv$/.test(f) && !f.includes('BRASIL'))
const mudancas = []
let geradoEm = ''
const coord = (v) => {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n !== -1 ? Math.round(n * 1e6) / 1e6 : null
}
const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ')

for (const file of files.sort()) {
  const lines = (await readFile(join(src, file), 'latin1')).split(/\r?\n/)
  const head = lines[0].split(';').map((h) => h.replace(/"/g, ''))
  const c = Object.fromEntries(head.map((h, i) => [h, i]))
  const t1 = new Map()
  const t2 = new Map()
  for (const line of lines.slice(1)) {
    if (!line) continue
    const r = line.split(';').map((x) => x.replace(/^"|"$/g, ''))
    geradoEm ||= `${r[c.DT_GERACAO]} ${r[c.HH_GERACAO]}`
    const key = `${r[c.CD_MUNICIPIO]}-${r[c.NR_ZONA]}-${r[c.NR_SECAO]}`
    ;(r[c.NR_TURNO] === '1' ? t1 : t2).set(key, r)
  }
  const local = (r) => [clean(r[c.NM_LOCAL_VOTACAO]), clean(r[c.DS_ENDERECO]), clean(r[c.NM_BAIRRO]), coord(r[c.NR_LATITUDE]), coord(r[c.NR_LONGITUDE])]
  for (const [key, r2] of t2) {
    const r1 = t1.get(key)
    if (!r1) continue
    const base = [
      r2[c.SG_UF].toLowerCase(),
      r2[c.CD_MUNICIPIO].padStart(5, '0'),
      clean(r2[c.NM_MUNICIPIO]),
      Number(r2[c.NR_ZONA]),
      Number(r2[c.NR_SECAO]),
      Number(r2[c.QT_ELEITOR_SECAO]) || 0,
    ]
    const mudouNoTurno = r1[c.NR_LOCAL_VOTACAO] !== r2[c.NR_LOCAL_VOTACAO] || clean(r1[c.DS_ENDERECO]) !== clean(r2[c.DS_ENDERECO])
    if (mudouNoTurno) {
      mudancas.push([...base, 'turno', local(r1), local(r2)])
    } else if (r2[c.NR_LOCAL_VOTACAO] !== r2[c.NR_LOCAL_VOTACAO_ORIGINAL]) {
      mudancas.push([...base, 'original', [clean(r2[c.NM_LOCAL_VOTACAO_ORIGINAL]), clean(r2[c.DS_ENDERECO_LOCVT_ORIGINAL]), '', null, null], local(r2)])
    }
  }
}

mudancas.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]) || a[3] - b[3] || a[4] - b[4])
const out = join(ROOT, 'public', 'data', `secoes-${ano}-mudancas.json`)
await writeFile(out, JSON.stringify({ fonte: 'TSE, dados abertos: eleitorado_local_votacao', geradoEm, mudancas }))
const porTipo = mudancas.reduce((m, x) => ((m[x[6]] = (m[x[6]] ?? 0) + 1), m), {})
console.log(`${mudancas.length} seções (${JSON.stringify(porTipo)}), arquivo do TSE gerado em ${geradoEm} -> ${out}`)
