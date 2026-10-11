// Reconstrói a evolução da apuração de presidente a partir dos boletins de urna do TSE.
//
// O servidor de resultados só publica o acumulado e, ao retotalizar, sobrescreve os horários.
// Os boletins de urna (Portal de Dados Abertos) trazem, para cada urna, os votos e o horário
// em que o TSE recebeu o boletim (DT_BU_RECEBIDO, horário de Brasília). Somando os votos na
// ordem de chegada, minuto a minuto, temos a curva da noite sem inventar nada.
//
// Uso (na sua máquina; o portal bloqueia servidores):
//   node scripts/build-evolution.mjs <ano> <turno> <código da eleição>
//   node scripts/build-evolution.mjs 2026 1 6257
// Gera public/data/evolucao/ele<ano>-<código com 6 dígitos>.json, no mesmo formato da
// gravação ao vivo (api/_evolucao.ts). Baixa um estado por vez e apaga o arquivo em seguida
// (SP tem ~1,3 GB). Precisa de um tar que leia zip: o do Windows (System32) ou bsdtar.

import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const [ano, turno, eleicao] = process.argv.slice(2)
if (!/^\d{4}$/.test(ano ?? '') || !/^[12]$/.test(turno ?? '') || !/^\d+$/.test(eleicao ?? '')) {
  console.error('Uso: node scripts/build-evolution.mjs <ano> <turno> <código da eleição>')
  process.exit(1)
}

const TAR = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'bsdtar'
const TURNO_NOME = turno === '1' ? 'Primeiro turno' : 'Segundo turno'

// Lista dos arquivos no portal (um zip por UF, mais o exterior).
const pkg = await (await fetch(`https://dadosabertos.tse.jus.br/api/3/action/package_show?id=resultados-${ano}-boletim-de-urna`)).json()
const zips = pkg.result.resources
  .filter((r) => r.url.endsWith('.zip') && r.name.includes(TURNO_NOME))
  .map((r) => ({ uf: r.name.slice(0, 2), url: r.url }))
if (!zips.length) {
  console.error(`Nenhum boletim de urna do ${TURNO_NOME.toLowerCase()} de ${ano} no portal.`)
  process.exit(1)
}

/** minuto "AAAAMMDD HH:MM" -> { urnas, votos por número } */
const minutes = new Map()
const seen = new Set()
const missing = []

async function processUf({ uf, url }) {
  const zip = join(tmpdir(), `bweb-${uf}.zip`)
  const started = Date.now()
  const res = await fetch(url)
  if (!res.ok) {
    missing.push(uf)
    console.log(`${uf}: não baixou (${res.status})`)
    return
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip))
  const csv = url.split('/').pop().replace('.zip', '.csv')
  const tar = spawn(TAR, ['-xOf', zip, csv], { stdio: ['ignore', 'pipe', 'inherit'] })
  const rl = createInterface({ input: tar.stdout, crlfDelay: Infinity })

  let col
  let rows = 0
  for await (const line of rl) {
    if (!col) {
      const h = line.split(';').map((s) => s.replaceAll('"', ''))
      col = Object.fromEntries(h.map((name, i) => [name, i]))
      continue
    }
    if (!line.includes('"Presidente"')) continue
    const r = line.split(';').map((s) => s.replaceAll('"', ''))
    if (r[col.DS_CARGO_PERGUNTA] !== 'Presidente' || r[col.NR_TURNO] !== turno) continue
    const when = r[col.DT_BU_RECEBIDO] // "AAAA-MM-DD HH:MM:SS"
    if (!when) continue
    const key = `${when.slice(0, 4)}${when.slice(5, 7)}${when.slice(8, 10)} ${when.slice(11, 16)}`
    const m = minutes.get(key) ?? { urnas: 0, votos: new Map() }
    minutes.set(key, m)
    const urna = `${uf}-${r[col.CD_MUNICIPIO]}-${r[col.NR_ZONA]}-${r[col.NR_SECAO]}`
    if (!seen.has(urna)) {
      seen.add(urna)
      m.urnas++
    }
    if (r[col.DS_TIPO_VOTAVEL] === 'Nominal') {
      const n = r[col.NR_VOTAVEL]
      m.votos.set(n, (m.votos.get(n) ?? 0) + (Number(r[col.QT_VOTOS]) || 0))
    }
    rows++
  }
  await new Promise((ok) => tar.on('close', ok))
  rmSync(zip, { force: true })
  console.log(`${uf}: ${rows} linhas de presidente, ${((Date.now() - started) / 1000).toFixed(0)} s`)
}

// UFS=AC,RR limita a alguns estados (para testar).
const only = process.env.UFS?.split(',')
for (const z of zips) if (!only || only.includes(z.uf)) await processUf(z)

// Acumula na ordem do tempo. "st" é o % de urnas já recebidas (o TSE mostra % de seções;
// a diferença são as seções agregadas, que dividem uma urna).
const total = seen.size
const acc = new Map()
let urnas = 0
const points = [...minutes.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([key, m]) => {
    urnas += m.urnas
    for (const [n, v] of m.votos) acc.set(n, (acc.get(n) ?? 0) + v)
    return {
      t: `${key}:00`,
      st: Math.round((urnas / total) * 10000) / 100,
      c: [...acc.entries()].sort((a, b) => b[1] - a[1]),
    }
  })

const out = join('public', 'data', 'evolucao')
mkdirSync(out, { recursive: true })
const file = join(out, `ele${ano}-${eleicao.padStart(6, '0')}.json`)
writeFileSync(
  file,
  JSON.stringify({
    fonte: 'boletins de urna',
    unidade: 'urnas',
    exterior: !missing.includes('ZZ'),
    urnas: total,
    points,
  }),
)
console.log(`\n${file}: ${points.length} pontos, ${total} urnas${missing.length ? `, sem: ${missing.join(', ')}` : ''}`)
