// Gera os arquivos estáticos de mapa em public/geo a partir das fontes oficiais:
//  - malhas IBGE (API v3) do Brasil por UF e de cada UF por município (TopoJSON)
//  - tabela de códigos de município TSE <-> IBGE (config de municípios do TSE)
// Uso: node scripts/build-geo.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'geo')
const IBGE = 'https://servicodados.ibge.gov.br/api/v3/malhas'
// Tabela de municípios da última eleição com totalização por município. Os
// códigos TSE são estáveis entre ciclos; atualize quando houver novos municípios.
const TSE_MUN = 'https://resultados.tse.jus.br/oficial/ele2022/544/config/mun-e000544-cm.json'

const UFS = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
}

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      if (attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
}

async function save(path, data) {
  const file = join(OUT, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
  console.log('✓', path)
}

const q = 'formato=application/json&qualidade=minima'

await save('br-uf.json', await getJson(`${IBGE}/paises/BR?${q}&intrarregiao=UF`))

for (const [code, sg] of Object.entries(UFS)) {
  await save(`uf/${sg.toLowerCase()}.json`, await getJson(`${IBGE}/estados/${code}?${q}&intrarregiao=municipio`))
}

const cm = await getJson(TSE_MUN)
for (const uf of cm.abr) {
  if (uf.cd === 'ZZ') continue
  const rows = uf.mu.map((m) => ({ tse: m.cd, ibge: m.cdi, nome: m.nm, capital: m.c === 'S' }))
  await save(`mun/${uf.cd.toLowerCase()}.json`, rows)
}
