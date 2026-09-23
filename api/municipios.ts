// Resumo por município de uma UF (líderes e % de seções), para colorir o mapa estadual.
// O TSE publica um arquivo por município; esta função os agrega e o CDN guarda o
// resultado, de modo que o TSE recebe no máximo uma varredura por UF/cargo a cada 30 s.
// GET /api/municipios?ciclo=ele2022&ele=544&cargo=1&uf=sp

const ORIGIN = 'https://resultados.tse.jus.br/oficial'
const CONCURRENCY = 32

interface RawVotes {
  nadf: string
  dg: string
  hg: string
  abr: { tpabr: string; cdabr: string; pst: string; tf: string; cand: { n: string; vap: string; pvap: string }[] }[]
}

export interface MunicipalSummary {
  nadf: string
  updatedAt: string
  final: boolean
  /** código TSE -> [% seções, [[número, votos, %], ... top 3]] */
  cities: Record<string, [number, [string, number, number][]]>
}

/** "04/10/2022 12:07:13" -> "20221004 12:07:13", comparável como texto */
const sortable = (s: string) => (s ? `${s.slice(6, 10)}${s.slice(3, 5)}${s.slice(0, 2)}${s.slice(10)}` : '')
const num = (v: string) => Number.parseFloat(v.replace(',', '.')) || 0

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export async function buildSummary(
  params: { ciclo: string; ele: string; cargo: string; uf: string },
  municipalities: string[],
): Promise<MunicipalSummary | null> {
  const { ciclo, ele, cargo, uf } = params
  const c = cargo.padStart(4, '0')
  const e = ele.padStart(6, '0')
  let nadf = ''
  let updatedAt = ''
  let final = true
  const cities: MunicipalSummary['cities'] = {}

  const results = await mapLimit(municipalities, CONCURRENCY, async (mun) => {
    const res = await fetch(`${ORIGIN}/${ciclo}/${ele}/dados/${uf}/${uf}${mun}-c${c}-e${e}-v.json`)
    if (!res.ok) return { mun, status: res.status }
    return { mun, status: 200, data: (await res.json()) as RawVotes }
  })

  if (results.every((r) => r.status === 404)) return null

  for (const r of results) {
    if (!r.data) continue
    const abr = r.data.abr.find((a) => a.tpabr === 'MU') ?? r.data.abr[0]
    if (!abr) continue
    nadf ||= r.data.nadf
    const stamp = `${r.data.dg} ${r.data.hg}`
    if (sortable(stamp) > sortable(updatedAt)) updatedAt = stamp
    if (abr.tf?.toLowerCase() !== 's') final = false
    const top = abr.cand
      .map((x) => [x.n, Number(x.vap) || 0, num(x.pvap)] as [string, number, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    cities[r.mun] = [num(abr.pst), top]
  }
  return { nadf, updatedAt, final, cities }
}

const VALID = { ciclo: /^ele\d{4}$/, ele: /^\d{1,6}$/, cargo: /^\d{1,4}$/, uf: /^[a-z]{2}$/ }

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const params = {
    ciclo: url.searchParams.get('ciclo') ?? '',
    ele: url.searchParams.get('ele') ?? '',
    cargo: url.searchParams.get('cargo') ?? '',
    uf: (url.searchParams.get('uf') ?? '').toLowerCase(),
  }
  for (const [k, re] of Object.entries(VALID)) {
    if (!re.test(params[k as keyof typeof params])) return new Response(`Parâmetro inválido: ${k}`, { status: 400 })
  }

  const listRes = await fetch(`${url.origin}/geo/mun/${params.uf}.json`)
  if (!listRes.ok) return new Response('UF desconhecida', { status: 404 })
  const municipalities = ((await listRes.json()) as { tse: string }[]).map((m) => m.tse)

  const summary = await buildSummary(params, municipalities)
  if (!summary) {
    return new Response('Não publicado', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=60' } })
  }
  return Response.json(summary, {
    headers: {
      'Cache-Control': summary.final
        ? 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400'
        : 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
    },
  })
}
