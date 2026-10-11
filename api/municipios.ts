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

/** Formato unificado de 2026 (-u): candidatos, totais e situação num só arquivo. */
interface RawUnified {
  dt: string
  ht: string
  dg: string
  hg: string
  tf: string
  s: { pst: string }
  carg: { agr: { par: { sg: string; cand: { n: string; nm: string; nmu: string; vap: string; pvap: string }[] }[] }[] }[]
}

export interface MunicipalSummary {
  nadf: string
  names?: Record<string, [string, string]>
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

  if (Number(ciclo.slice(3)) >= 2026) return buildUnified(params, municipalities)

  const results = await mapLimit(municipalities, CONCURRENCY, async (mun) => {
    const res = await fetch(`${ORIGIN}/${ciclo}/${ele}/dados/${uf}/${uf}${mun}-c${c}-e${e}-v.json`)
    if (!res.ok) return { mun, status: res.status }
    return { mun, status: 200, data: (await res.json()) as RawVotes }
  })

  if (results.every((r) => r.status === 404)) return null
  assertComplete(results)

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

async function buildUnified(
  params: { ciclo: string; ele: string; cargo: string; uf: string },
  municipalities: string[],
): Promise<MunicipalSummary | null> {
  const { ciclo, ele, cargo, uf } = params
  const c = cargo.padStart(4, '0')
  const e = ele.padStart(6, '0')
  const results = await mapLimit(municipalities, CONCURRENCY, async (mun) => {
    const res = await fetch(`${ORIGIN}/${ciclo}/${ele}/dados/${uf}/${uf}${mun}-c${c}-e${e}-u.json`)
    if (!res.ok) return { mun, status: res.status }
    return { mun, status: 200, data: (await res.json()) as RawUnified }
  })
  if (results.every((r) => r.status === 404)) return null
  assertComplete(results)

  let updatedAt = ''
  let final = true
  const names: Record<string, [string, string]> = {}
  const cities: MunicipalSummary['cities'] = {}
  for (const r of results) {
    if (!r.data) continue
    const stamp = `${r.data.dt || r.data.dg} ${r.data.ht || r.data.hg}`
    if (sortable(stamp) > sortable(updatedAt)) updatedAt = stamp
    if (r.data.tf?.toLowerCase() !== 's') final = false
    const cands = (r.data.carg[0]?.agr ?? []).flatMap((a) => a.par.flatMap((p) => p.cand.map((x) => ({ x, sg: p.sg }))))
    for (const { x, sg } of cands) names[x.n] ??= [x.nmu || x.nm, sg]
    const top = cands
      .map(({ x }) => [x.n, Number(x.vap) || 0, num(x.pvap)] as [string, number, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    cities[r.mun] = [num(r.data.s?.pst ?? '0'), top]
  }
  return { nadf: '', names, updatedAt, final, cities }
}

/** Falha do TSE (429, 5xx) numa cidade: a resposta não pode ir para o cache como se fosse completa. */
class UpstreamError extends Error {}

/**
 * Uma cidade que não veio por erro do TSE (e não por "ainda não publicado") invalida a varredura:
 * sem isso, a UF sairia sem aquela cidade (ou vazia) e marcada como final, com um dia de cache.
 */
function assertComplete(results: { status: number }[]) {
  const failed = results.filter((r) => r.status !== 200 && r.status !== 404)
  if (failed.length) throw new UpstreamError(`${failed.length} município(s) com erro ${failed[0].status} no TSE`)
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

  let summary: MunicipalSummary | null
  try {
    summary = await buildSummary(params, municipalities)
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err
    return new Response(err.message, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!summary) {
    return new Response('Não publicado', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=60' } })
  }
  return Response.json(summary, {
    headers: {
      'Cache-Control': summary.final
        ? 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400'
        : // Mapa nacional (escala=br): as 27 UFs ao mesmo tempo; cache maior para poupar o TSE.
          url.searchParams.get('escala') === 'br'
          ? 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
          : 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
    },
  })
}
