// Pesquisas eleitorais 2026 (Quaest e Datafolha) a partir das páginas de pesquisas do g1
// (especiaisg1.globo). Três consultas, todas com cache no CDN:
//   ?tipo=pagina&cargo=governador&uf=sp&instituto=Quaest   -> id da página, perguntas, metodologia
//   ?tipo=grafico&pagina=153&pergunta=ESTIMULADA-GOV-001&instituto=Quaest -> séries por candidato
//   ?tipo=mapa&cargo=governador&instituto=Quaest           -> líder da última rodada em cada UF
// Só monta endereços a partir de valores conhecidos; não é um repasse aberto.

const BASE = 'https://especiaisg1.globo'
const ANO = '2026'
const CARGOS = new Set(['presidente', 'governador', 'senador'])
const INSTITUTOS = new Set(['Quaest', 'Datafolha'])
const UFS: Record<string, string> = {
  ac: 'acre', al: 'alagoas', ap: 'amapa', am: 'amazonas', ba: 'bahia', ce: 'ceara', df: 'distrito-federal',
  es: 'espirito-santo', go: 'goias', ma: 'maranhao', mt: 'mato-grosso', ms: 'mato-grosso-do-sul',
  mg: 'minas-gerais', pa: 'para', pb: 'paraiba', pr: 'parana', pe: 'pernambuco', pi: 'piaui',
  rj: 'rio-de-janeiro', rn: 'rio-grande-do-norte', rs: 'rio-grande-do-sul', ro: 'rondonia', rr: 'roraima',
  sc: 'santa-catarina', sp: 'sao-paulo', se: 'sergipe', to: 'tocantins',
}

export interface Pergunta {
  id: string
  label: string
}
export interface Pagina {
  existe: boolean
  pagina?: string
  perguntas: Pergunta[]
  padrao?: string
  metodologia?: string
  url: string
}
export interface Serie {
  nome: string
  partido?: string
  cor?: string
  foto?: string
  pontos: { data: string; valor: number }[]
}
export interface Grafico {
  margem?: number
  series: Serie[]
}
export interface LiderUf {
  uf: string
  data: string
  pergunta: string
  lider: { nome: string; partido?: string; valor: number }
  segundo?: { nome: string; partido?: string; valor: number }
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; ApuracaoBrasil/1.0; +https://eleicoes.sistemaspsdev.com.br)' }

function pageUrl(cargo: string, uf: string, instituto: string) {
  const local = uf === 'br' ? 'politica' : `${uf}/${UFS[uf]}`
  return `${BASE}/${local}/eleicoes/${ANO}/pesquisas-eleitorais/${cargo}/1-turno/${instituto}`
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

export async function fetchPagina(cargo: string, uf: string, instituto: string): Promise<Pagina> {
  const url = pageUrl(cargo, uf, instituto)
  const res = await fetch(`${url}/internal/`, { headers: HEADERS })
  if (!res.ok) return { existe: false, perguntas: [], url }
  const html = await res.text()
  const cfg = html.slice(html.indexOf('g1PesquisasEleitorais'))
  const pagina = cfg.match(/paginaId:\s*"(\d+)"/)?.[1]
  const padrao = cfg.match(/tipoPergunta:\s*"([^"]*)"/)?.[1]
  const perguntas = [
    ...new Map(
      [...html.matchAll(/id="([A-Z0-9]+(?:-[A-Z0-9]+)+)"[^>]*>\s*([^<]{2,90})</g)].map((m) => [
        m[1],
        { id: m[1], label: decode(m[2]) },
      ]),
    ).values(),
  ]
  const metodologia = html.match(/methodology__description">([\s\S]*?)<\/p>/)?.[1]
  return {
    existe: Boolean(pagina),
    pagina,
    perguntas,
    padrao,
    metodologia: metodologia ? decode(metodologia.replace(/<[^>]+>/g, '')) : undefined,
    url,
  }
}

interface RawOpcao {
  nome: string
  nome_popular?: string | null
  partido?: { sigla?: string; cor?: string } | null
  foto?: string
}
interface RawData {
  option: string
  color?: string
  values: { date: string; value: number }[]
}

export async function fetchGrafico(pagina: string, pergunta: string, instituto: string): Promise<Grafico | null> {
  const qs = new URLSearchParams({ tipo_pergunta: pergunta, instituto })
  const res = await fetch(`${BASE}/api/pesquisas-eleitorais/graficos/${pagina}/?${qs}`, { headers: HEADERS })
  if (!res.ok) return null
  const json = (await res.json()) as { resultado?: { cenarios?: { margem?: number; data?: RawData[] }[]; opcoes_resposta_estratos?: RawOpcao[] } }
  const cenario = json.resultado?.cenarios?.[0]
  if (!cenario?.data?.length) return null
  const opcoes = new Map((json.resultado?.opcoes_resposta_estratos ?? []).map((o) => [o.nome, o]))
  return {
    margem: cenario.margem,
    series: cenario.data.map((d) => {
      const o = opcoes.get(d.option)
      return {
        nome: (o?.nome_popular || d.option).replace(/(?<=\s)(Da|De|Do|Das|Dos|E)(?=\s)/g, (w) => w.toLowerCase()),
        partido: o?.partido?.sigla,
        cor: o?.partido?.cor || d.color,
        foto: o?.foto,
        pontos: d.values
          .map((v) => ({ data: v.date.slice(0, 10), valor: Math.round(v.value * 1000) / 10 }))
          .sort((a, b) => a.data.localeCompare(b.data)),
      }
    }),
  }
}

/** Respostas que não são candidatos (brancos, indecisos...). */
export const NAO_CANDIDATO = /branco|nulo|nenhum|indecis|não sabe|nao sabe|não vai|outros/i

async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k]).catch(() => undefined as R)
      }
    }),
  )
  return out
}

async function fetchMapa(cargo: string, instituto: string): Promise<LiderUf[]> {
  const res = await mapLimit(Object.keys(UFS), 9, async (uf): Promise<LiderUf | undefined> => {
    const p = await fetchPagina(cargo, uf, instituto)
    if (!p.existe || !p.pagina) return undefined
    const est = p.perguntas.find((q) => /^estimulada$/i.test(q.label)) ?? p.perguntas.find((q) => q.id === p.padrao)
    if (!est) return undefined
    const g = await fetchGrafico(p.pagina, est.id, instituto)
    if (!g) return undefined
    const data = g.series.flatMap((s) => s.pontos.map((pt) => pt.data)).sort().at(-1)!
    const ultimos = g.series
      .filter((s) => !NAO_CANDIDATO.test(s.nome))
      .map((s) => ({ nome: s.nome, partido: s.partido, valor: s.pontos.find((pt) => pt.data === data)?.valor ?? -1 }))
      .filter((s) => s.valor >= 0)
      .sort((a, b) => b.valor - a.valor)
    if (!ultimos.length) return undefined
    return { uf: uf.toUpperCase(), data, pergunta: est.label, lider: ultimos[0], segundo: ultimos[1] }
  })
  return res.filter((x): x is LiderUf => Boolean(x))
}

const json = (body: unknown, maxAge: number) =>
  Response.json(body, {
    headers: { 'Cache-Control': `public, max-age=${Math.min(maxAge, 300)}, s-maxage=${maxAge}, stale-while-revalidate=86400` },
  })
const bad = (msg: string) => new Response(msg, { status: 400 })

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams
  const tipo = q.get('tipo')
  const instituto = q.get('instituto') ?? ''
  if (!INSTITUTOS.has(instituto)) return bad('instituto inválido')

  if (tipo === 'pagina') {
    const cargo = q.get('cargo') ?? ''
    const uf = (q.get('uf') ?? '').toLowerCase()
    if (!CARGOS.has(cargo) || !(uf === 'br' || UFS[uf]) || (uf === 'br' && cargo !== 'presidente')) return bad('parâmetros inválidos')
    return json(await fetchPagina(cargo, uf, instituto), 3600)
  }
  if (tipo === 'grafico') {
    const pagina = q.get('pagina') ?? ''
    const pergunta = q.get('pergunta') ?? ''
    if (!/^\d{1,6}$/.test(pagina) || !/^[A-Z0-9-]{3,40}$/.test(pergunta)) return bad('parâmetros inválidos')
    const g = await fetchGrafico(pagina, pergunta, instituto)
    return g ? json(g, 1800) : new Response('sem dados', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=600' } })
  }
  if (tipo === 'mapa') {
    const cargo = q.get('cargo') ?? ''
    if (!CARGOS.has(cargo)) return bad('cargo inválido')
    return json(await fetchMapa(cargo, instituto), 3 * 3600)
  }
  return bad('tipo inválido')
}
