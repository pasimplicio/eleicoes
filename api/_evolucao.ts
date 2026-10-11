// Gravação da evolução da apuração nacional no Upstash Redis (instalado pelo Marketplace da
// Vercel, que cria as variáveis KV_REST_API_URL e KV_REST_API_TOKEN no projeto).
// Sem as variáveis, nada é gravado e a leitura devolve lista vazia: o site segue funcionando.
// Arquivo com "_" no início: a Vercel não o publica como rota.

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

export const recordingEnabled = Boolean(URL_ && TOKEN)

/** Um ponto da curva: horário do TSE, % de seções e [número, votos] de cada candidato. */
export interface EvolutionPoint {
  /** "AAAAMMDD HH:MM:SS" (Brasília) */
  t: string
  st: number
  c: [string, number][]
}

const key = (ciclo: string, ele: string) => `evolucao:${ciclo}:${ele}:br`

async function redis(commands: (string | number)[][]): Promise<{ result?: unknown }[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2500),
  })
  if (!res.ok) throw new Error(`Redis ${res.status}`)
  return (await res.json()) as { result?: unknown }[]
}

const num = (v: string) => Number.parseFloat(String(v).replace(',', '.')) || 0
/** "25/10/2026" + "18:42:10" -> "20261025 18:42:10" */
const sortable = (d: string, h: string) => `${d.slice(6, 10)}${d.slice(3, 5)}${d.slice(0, 2)} ${h}`

interface RawNational {
  dt?: string
  ht?: string
  dg?: string
  hg?: string
  s?: { pst?: string }
  carg?: { agr?: { par?: { cand?: { n: string; vap: string }[] }[] }[] }[]
}

/**
 * Grava o ponto do arquivo nacional recém-lido do TSE. Pontos repetidos (mesmo horário e
 * mesmos números) não duplicam: o membro do conjunto ordenado é o próprio ponto.
 */
export async function recordNational(ciclo: string, ele: string, body: string) {
  if (!recordingEnabled) return
  try {
    const d = JSON.parse(body) as RawNational
    const st = num(d.s?.pst ?? '0')
    if (!st) return // 2º turno ainda zerado: nada a gravar
    const date = d.dt || d.dg
    const hour = d.ht || d.hg
    if (!date || !hour) return
    const c = (d.carg?.[0]?.agr ?? [])
      .flatMap((a) => (a.par ?? []).flatMap((p) => p.cand ?? []))
      .map((x) => [x.n, Number(x.vap) || 0] as [string, number])
    const point: EvolutionPoint = { t: sortable(date, hour), st, c }
    const score = Number(point.t.replace(/\D/g, ''))
    await redis([['ZADD', key(ciclo, ele), score, JSON.stringify(point)]])
  } catch {
    /* a gravação nunca atrapalha a entrega do resultado */
  }
}

export async function readNational(ciclo: string, ele: string): Promise<EvolutionPoint[]> {
  if (!recordingEnabled) return []
  const [res] = await redis([['ZRANGE', key(ciclo, ele), 0, -1]])
  return ((res?.result as string[]) ?? []).map((m) => JSON.parse(m) as EvolutionPoint)
}
