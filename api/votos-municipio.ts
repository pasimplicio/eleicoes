// Votos de cada candidato proporcional (deputado) em cada município de uma UF, para o
// mapa de votos por candidato. O TSE publica um arquivo unificado (-u) por município;
// esta função lê todos de uma vez e devolve só o necessário, em formato compacto. O CDN
// guarda a resposta: o TSE recebe no máximo uma varredura por UF/cargo a cada minuto.
// GET /api/votos-municipio?ciclo=ele2026&ele=6259&cargo=6&uf=sp

const ORIGIN = 'https://resultados.tse.jus.br/oficial'
const CONCURRENCY = 32

interface RawUnified {
  dt: string
  ht: string
  dg: string
  hg: string
  tf: string
  s: { pst: string }
  v: { vv: string }
  carg: { agr: { par: { cand: { n: string; vap: string }[] }[] }[] }[]
}

export interface MunicipalVotes {
  updatedAt: string
  final: boolean
  /** código TSE do município -> [votos válidos, % seções, número, votos, número, votos, ...] */
  mun: Record<string, number[]>
}

/** "04/10/2026 12:07:13" -> "20261004 12:07:13", comparável como texto */
const sortable = (s: string) => (s ? `${s.slice(6, 10)}${s.slice(3, 5)}${s.slice(0, 2)}${s.slice(10)}` : '')
const num = (v?: string) => Number.parseFloat((v ?? '0').replace(',', '.')) || 0

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

export async function buildVotes(
  params: { ciclo: string; ele: string; cargo: string; uf: string },
  municipalities: string[],
): Promise<MunicipalVotes | null> {
  const { ciclo, ele, cargo, uf } = params
  const c = cargo.padStart(4, '0')
  const e = ele.padStart(6, '0')
  const results = await mapLimit(municipalities, CONCURRENCY, async (mun) => {
    const res = await fetch(`${ORIGIN}/${ciclo}/${ele}/dados/${uf}/${uf}${mun}-c${c}-e${e}-u.json`)
    if (!res.ok) return { mun, status: res.status }
    return { mun, status: 200, data: (await res.json()) as RawUnified }
  })
  if (results.every((r) => r.status === 404)) return null

  let updatedAt = ''
  let final = true
  const mun: MunicipalVotes['mun'] = {}
  for (const r of results) {
    if (!r.data) continue
    const stamp = `${r.data.dt || r.data.dg} ${r.data.ht || r.data.hg}`
    if (sortable(stamp) > sortable(updatedAt)) updatedAt = stamp
    if (r.data.tf?.toLowerCase() !== 's') final = false
    const row = [Number(r.data.v?.vv) || 0, num(r.data.s?.pst)]
    for (const a of r.data.carg[0]?.agr ?? []) {
      for (const p of a.par) {
        for (const x of p.cand) {
          const v = Number(x.vap) || 0
          if (v > 0) row.push(Number(x.n), v)
        }
      }
    }
    mun[r.mun] = row
  }
  return { updatedAt, final, mun }
}

const VALID = { ciclo: /^ele(20[2-9]\d)$/, ele: /^\d{1,6}$/, cargo: /^(6|7|8)$/, uf: /^[a-z]{2}$/ }

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

  const votes = await buildVotes(params, municipalities)
  if (!votes) {
    return new Response('Não publicado', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=30' } })
  }
  return Response.json(votes, {
    headers: {
      'Cache-Control': votes.final
        ? 'public, max-age=600, s-maxage=86400, stale-while-revalidate=86400'
        : 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
    },
  })
}
