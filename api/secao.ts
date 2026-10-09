// Resultado de presidente numa seção eleitoral, lido do boletim de urna (BU) oficial do TSE.
// O BU é publicado em arquivo-urna/<pleito>/dados/<uf>/<mun>/<zona>/<seção>/ no formato
// binário ASN.1 (DER), dentro de um envelope. Esta função localiza o BU pelo arquivo -aux,
// decodifica e devolve os votos do cargo de presidente do turno pedido.
// GET /api/secao?uf=ac&mun=01066&zona=4&secao=77&turno=1

const ORIGIN = 'https://resultados.tse.jus.br/oficial'
const CICLO = 'ele2026'
/** Datas dos turnos do ciclo, no formato da config do TSE. */
const DATAS: Record<string, string> = { '1': '04/10/2026', '2': '25/10/2026' }
const CARGO_PRESIDENTE = 1

// ------------------------------------------------------------------ DER mínimo

interface Node {
  tag: number // primeiro octeto (classe + construído + número curto)
  num: number // número da tag
  cons: boolean
  bytes: Uint8Array
  children: Node[]
}

function parse(b: Uint8Array, start = 0, end = b.length): Node[] {
  const out: Node[] = []
  let i = start
  while (i < end) {
    const tag = b[i++]
    let num = tag & 0x1f
    if (num === 0x1f) {
      num = 0
      while (b[i] & 0x80) num = num * 128 + (b[i++] & 0x7f)
      num = num * 128 + b[i++]
    }
    let len = b[i++]
    if (len & 0x80) {
      const n = len & 0x7f
      len = 0
      for (let k = 0; k < n; k++) len = len * 256 + b[i++]
    }
    const cons = Boolean(tag & 0x20)
    const bytes = b.subarray(i, i + len)
    out.push({ tag, num, cons, bytes, children: cons ? parse(b, i, i + len) : [] })
    i += len
  }
  return out
}

const int = (n?: Node) => {
  if (!n) return 0
  let v = 0
  for (const x of n.bytes) v = v * 256 + x
  // inteiros DER são com sinal; os valores do BU são sempre positivos e pequenos
  return v
}
const str = (n?: Node) => (n ? new TextDecoder('latin1').decode(n.bytes) : '')
const isSeq = (n?: Node) => n?.tag === 0x30
const isInt = (n?: Node) => n?.tag === 0x02

/** Primeiro nó (em profundidade) que satisfaz o teste. */
function find(nodes: Node[], test: (n: Node) => boolean): Node | undefined {
  for (const n of nodes) {
    if (test(n)) return n
    const hit = find(n.children, test)
    if (hit) return hit
  }
  return undefined
}

/** "20261004T154409" -> "04/10/2026 15:44:09" */
const fmtTs = (s: string) =>
  /^\d{8}T\d{6}$/.test(s) ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}` : s

export interface SecaoResultado {
  turno: number
  eleicao: string
  aptos: number
  comparecimento: number
  nominais: { numero: number; partido: number; votos: number }[]
  brancos: number
  nulos: number
  emissao: string
  abertura?: string
  encerramento?: string
  recebimento?: string
}

/** Decodifica o BU (envelope + conteúdo) e extrai o cargo de presidente da eleição pedida. */
export function decodeBu(raw: Uint8Array, eleicao: number): Omit<SecaoResultado, 'turno' | 'eleicao' | 'recebimento'> | null {
  const env = parse(raw)[0]
  // O conteúdo do BU vem num OCTET STRING no fim do envelope.
  const octet = [...(env?.children ?? [])].reverse().find((n) => n.tag === 0x04)
  if (!octet) return null
  const bu = parse(octet.bytes)[0]
  if (!bu) return null

  // Datas: emissão (string isolada) e abertura/encerramento (par de strings).
  const strings = bu.children.filter((n) => n.tag === 0x1b).map(str)
  const pair = bu.children.find((n) => n.cons && n.children.length === 2 && n.children.every((c) => c.tag === 0x1b))

  // Resultado por eleição: SEQUENCE cujo primeiro INTEGER é o código da eleição.
  const porEleicao = find(bu.children, (n) => isSeq(n) && isInt(n.children[0]) && int(n.children[0]) === eleicao && n.children.length >= 4)
  if (!porEleicao) return null
  const aptos = int(porEleicao.children[1])

  // ResultadoVotacao: ENUMERATED (tipo), INTEGER (comparecimento), SEQUENCE OF TotalVotosCargo.
  const resultados = porEleicao.children.find((n) => isSeq(n) && n.children.some((c) => isSeq(c) && c.children[0]?.tag === 0x0a))
  for (const rv of resultados?.children ?? []) {
    const comparecimento = int(rv.children[1])
    for (const tvc of rv.children[2]?.children ?? []) {
      // TotalVotosCargo: [1] código do cargo, ordem de impressão, SEQUENCE OF VotoVotavel.
      if (int(tvc.children[0]) !== CARGO_PRESIDENTE) continue
      const votos = tvc.children[2]?.children ?? []
      const nominais: SecaoResultado['nominais'] = []
      let brancos = 0
      let nulos = 0
      for (const v of votos) {
        const tipo = int(v.children.find((c) => c.tag === 0x81))
        const qtd = int(v.children.find((c) => c.tag === 0x82))
        const id = v.children.find((c) => c.tag === 0xa3)
        if (tipo === 1 && id) nominais.push({ partido: int(id.children[0]), numero: int(id.children[1]), votos: qtd })
        else if (tipo === 2) brancos += qtd
        else if (tipo === 3) nulos += qtd
      }
      nominais.sort((a, b) => b.votos - a.votos || a.numero - b.numero)
      return {
        aptos,
        comparecimento,
        nominais,
        brancos,
        nulos,
        emissao: fmtTs(strings[0] ?? ''),
        abertura: pair ? fmtTs(str(pair.children[0])) : undefined,
        encerramento: pair ? fmtTs(str(pair.children[1])) : undefined,
      }
    }
  }
  return null
}

// ------------------------------------------------------------------ config do TSE

interface Pleito {
  cd: string
  dt: string
  e: { cd: string; t: string; abr?: { cp?: { cd: string }[] }[] }[]
}

let configCache: { at: number; pl: Pleito[] } | null = null

async function pleitos(): Promise<Pleito[]> {
  if (configCache && Date.now() - configCache.at < 10 * 60_000) return configCache.pl
  const res = await fetch(`${ORIGIN}/comum/config/ele-c.json`)
  if (!res.ok) throw new Error(`config ${res.status}`)
  const pl = ((await res.json()) as { pl: Pleito[] }).pl
  configCache = { at: Date.now(), pl }
  return pl
}

/** Pleito e eleição de presidente do turno, pela data na config do TSE. */
async function alvo(turno: string): Promise<{ pleito: string; eleicao: string } | null> {
  const pl = (await pleitos()).find((p) => p.dt === DATAS[turno])
  if (!pl) return null
  const e = pl.e.find((x) => (x.abr ?? []).some((a) => (a.cp ?? []).some((c) => c.cd === String(CARGO_PRESIDENTE))))
  return e ? { pleito: pl.cd, eleicao: e.cd } : null
}

// ------------------------------------------------------------------ handler

const VALID = { uf: /^[a-z]{2}$/, mun: /^\d{5}$/, zona: /^\d{1,4}$/, secao: /^\d{1,4}$/, turno: /^[12]$/ }

const json = (body: unknown, status: number, cache: string) =>
  Response.json(body, { status, headers: { 'Cache-Control': cache } })

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const p = Object.fromEntries(Object.keys(VALID).map((k) => [k, (url.searchParams.get(k) ?? '').toLowerCase()])) as Record<keyof typeof VALID, string>
  for (const [k, re] of Object.entries(VALID)) {
    if (!re.test(p[k as keyof typeof VALID])) return json({ erro: `Parâmetro inválido: ${k}` }, 400, 'no-store')
  }

  const t = await alvo(p.turno)
  if (!t) return json({ erro: 'O TSE ainda não publicou os boletins deste turno.' }, 404, 'public, s-maxage=600')

  const zona = p.zona.padStart(4, '0')
  const secao = p.secao.padStart(4, '0')
  const pleito6 = t.pleito.padStart(6, '0')
  const dir = `${ORIGIN}/${CICLO}/arquivo-urna/${t.pleito}/dados/${p.uf}/${p.mun}/${zona}/${secao}`
  const auxRes = await fetch(`${dir}/p${pleito6}-${p.uf}-m${p.mun}-z${zona}-s${secao}-aux.json`)
  if (!auxRes.ok) return json({ erro: 'Boletim de urna desta seção não encontrado.' }, 404, 'public, s-maxage=300')
  const aux = (await auxRes.json()) as { hashes: { hash: string; hr: string; dr: string; st: string; arq: { nm: string; tp: string }[] }[] }
  const entry = [...aux.hashes].reverse().find((h) => h.arq.some((a) => a.tp === 'bu'))
  const nm = entry?.arq.find((a) => a.tp === 'bu')?.nm
  if (!entry || !nm) return json({ erro: 'Boletim de urna desta seção não publicado.' }, 404, 'public, s-maxage=300')

  const buRes = await fetch(`${dir}/${entry.hash}/${nm}`)
  if (!buRes.ok) return json({ erro: 'Não foi possível baixar o boletim de urna.' }, 502, 'no-store')
  const dados = decodeBu(new Uint8Array(await buRes.arrayBuffer()), Number(t.eleicao))
  if (!dados) return json({ erro: 'Boletim de urna sem votos para presidente.' }, 404, 'public, s-maxage=3600')

  const body: SecaoResultado = { turno: Number(p.turno), eleicao: t.eleicao, ...dados, recebimento: `${entry.dr} ${entry.hr}` }
  // Boletim totalizado não muda mais.
  return json(body, 200, 'public, max-age=3600, s-maxage=604800, immutable')
}
