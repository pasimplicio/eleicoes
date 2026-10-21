// Seções que mudaram de local de votação, lidas direto do arquivo oficial de locais de votação
// dos dados abertos do TSE, sempre na versão mais recente.
//  - O arquivo é um ZIP de ~176 MB com um CSV por UF. Esta função lê só o pedaço do ZIP com o
//    CSV da UF pedida (requisições HTTP Range), descompacta e compara o local de cada seção
//    no 1º e no 2º turno e o local original.
//  - O CDN do TSE guarda cópias antigas do arquivo; um parâmetro de versão na URL faz o CDN
//    buscar na origem. Todas as leituras de uma execução usam a mesma URL (mesma versão).
// GET /api/locais-mudancas?uf=sp
import { inflateRawSync } from 'node:zlib'

const ANO = '2026'
const ZIP = `https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_${ANO}.zip`
/** Janela de reaproveitamento: a cada 10 minutos o CDN do TSE é forçado a buscar a versão nova. */
const JANELA_MS = 10 * 60_000
const UA = 'Mozilla/5.0 (ApuracaoBrasil; +https://eleicoes.sistemaspsdev.com.br)'

type LocalInfo = [string, string, string, number | null, number | null]
type Mudanca = [string, string, string, number, number, number, 'turno' | 'original', LocalInfo, LocalInfo]

async function range(url: string, start: number, end: number): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, 'User-Agent': UA } })
  if (res.status !== 206) throw new Error(`TSE: leitura parcial recusada (HTTP ${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000

interface Entry {
  name: string
  method: number
  compSize: number
  offset: number
}

/** Diretório central do ZIP (lido do fim do arquivo). */
async function listEntries(url: string): Promise<{ entries: Entry[]; lastModified: string }> {
  const head = await fetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': UA } })
  if (head.status !== 206) throw new Error(`TSE: HTTP ${head.status}`)
  const total = Number(head.headers.get('content-range')?.split('/')[1])
  const lastModified = head.headers.get('last-modified') ?? ''
  if (!total) throw new Error('TSE: tamanho do arquivo desconhecido')
  const tailLen = Math.min(total, 65_557)
  const tail = await range(url, total - tailLen, total - 1)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('ZIP sem diretório central')
  const cdSize = u32(tail, eocd + 12)
  const cdOffset = u32(tail, eocd + 16)
  const cd = cdOffset >= total - tailLen ? tail.subarray(cdOffset - (total - tailLen), cdOffset - (total - tailLen) + cdSize) : await range(url, cdOffset, cdOffset + cdSize - 1)
  const entries: Entry[] = []
  for (let i = 0; i + 46 <= cd.length && u32(cd, i) === 0x02014b50; ) {
    const nameLen = u16(cd, i + 28)
    const extraLen = u16(cd, i + 30)
    const commentLen = u16(cd, i + 32)
    entries.push({
      name: new TextDecoder().decode(cd.subarray(i + 46, i + 46 + nameLen)),
      method: u16(cd, i + 10),
      compSize: u32(cd, i + 20),
      offset: u32(cd, i + 42),
    })
    i += 46 + nameLen + extraLen + commentLen
  }
  return { entries, lastModified }
}

/** Conteúdo (latin1) de um arquivo do ZIP. */
async function readEntry(url: string, e: Entry): Promise<string> {
  // Cabeçalho local (30 bytes + nome + extra) seguido dos dados comprimidos.
  const buf = await range(url, e.offset, e.offset + 30 + 1024 + e.compSize)
  if (u32(buf, 0) !== 0x04034b50) throw new Error('ZIP: cabeçalho local inválido')
  const start = 30 + u16(buf, 26) + u16(buf, 28)
  const data = buf.subarray(start, start + e.compSize)
  const raw = e.method === 0 ? data : e.method === 8 ? inflateRawSync(data) : null
  if (!raw) throw new Error(`ZIP: compressão ${e.method} não suportada`)
  return new TextDecoder('latin1').decode(raw)
}

const clean = (s: string | undefined) => String(s ?? '').trim().replace(/\s+/g, ' ')
const coord = (v: string) => {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n !== -1 ? Math.round(n * 1e6) / 1e6 : null
}

/** Mesma regra de scripts/build-mudancas.mjs. */
function mudancas(csv: string): { geradoEm: string; mudancas: Mudanca[] } {
  const lines = csv.split(/\r?\n/)
  const head = lines[0].split(';').map((h) => h.replace(/"/g, ''))
  const c = Object.fromEntries(head.map((h, i) => [h, i])) as Record<string, number>
  const t1 = new Map<string, string[]>()
  const t2 = new Map<string, string[]>()
  let geradoEm = ''
  for (const line of lines.slice(1)) {
    if (!line) continue
    const r = line.split(';').map((x) => x.replace(/^"|"$/g, ''))
    geradoEm ||= `${r[c.DT_GERACAO]} ${r[c.HH_GERACAO]}`
    ;(r[c.NR_TURNO] === '1' ? t1 : t2).set(`${r[c.CD_MUNICIPIO]}-${r[c.NR_ZONA]}-${r[c.NR_SECAO]}`, r)
  }
  const local = (r: string[]): LocalInfo => [
    clean(r[c.NM_LOCAL_VOTACAO]),
    clean(r[c.DS_ENDERECO]),
    clean(r[c.NM_BAIRRO]),
    coord(r[c.NR_LATITUDE]),
    coord(r[c.NR_LONGITUDE]),
  ]
  const out: Mudanca[] = []
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
    ] as const
    if (r1[c.NR_LOCAL_VOTACAO] !== r2[c.NR_LOCAL_VOTACAO] || clean(r1[c.DS_ENDERECO]) !== clean(r2[c.DS_ENDERECO])) {
      out.push([...base, 'turno', local(r1), local(r2)])
    } else if (r2[c.NR_LOCAL_VOTACAO] !== r2[c.NR_LOCAL_VOTACAO_ORIGINAL]) {
      out.push([...base, 'original', [clean(r2[c.NM_LOCAL_VOTACAO_ORIGINAL]), clean(r2[c.DS_ENDERECO_LOCVT_ORIGINAL]), '', null, null], local(r2)])
    }
  }
  out.sort((a, b) => a[2].localeCompare(b[2]) || a[3] - b[3] || a[4] - b[4])
  return { geradoEm, mudancas: out }
}

export async function GET(request: Request): Promise<Response> {
  const uf = (new URL(request.url).searchParams.get('uf') ?? '').toLowerCase()
  if (!/^[a-z]{2}$/.test(uf)) return Response.json({ erro: 'Parâmetro inválido: uf' }, { status: 400 })

  const versao = Math.floor(Date.now() / JANELA_MS)
  const url = `${ZIP}?v=${versao}`
  try {
    const { entries, lastModified } = await listEntries(url)
    const entry = entries.find((e) => e.name.toLowerCase().endsWith(`_${uf}.csv`))
    if (!entry) return Response.json({ erro: 'UF não encontrada no arquivo do TSE' }, { status: 404 })
    const result = mudancas(await readEntry(url, entry))
    return Response.json(
      { uf, fonte: ZIP, lastModified, ...result },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600' } },
    )
  } catch (err) {
    return Response.json({ erro: (err as Error).message }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
