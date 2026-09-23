// Divide o arquivo de coletar-proporcionais.js em um arquivo por cargo e UF:
//   public/data/candidatos-<ano>/<cargo>/<uf>.json
// Uso: node scripts/dividir-proporcionais.mjs candidatos-proporcionais-2026.json
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/dividir-proporcionais.mjs <arquivo.json>')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(input, 'utf8'))
let files = 0
let total = 0

for (const [cargo, ufs] of Object.entries(data.cargos)) {
  for (const [uf, candidatos] of Object.entries(ufs)) {
    const valid = candidatos.filter((c) => c.nomeUrna && c.numero != null && c.partido)
    if (valid.length !== candidatos.length) {
      console.warn(`${cargo} ${uf}: ${candidatos.length - valid.length} registros sem nome, número ou partido`)
    }
    const out = join(root, 'public', 'data', `candidatos-${data.ano}`, cargo, `${uf.toLowerCase()}.json`)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, JSON.stringify({ coletadoEm: data.coletadoEm, candidatos: valid }))
    files++
    total += valid.length
  }
}
console.log(`${files} arquivos, ${total} candidaturas.`)
