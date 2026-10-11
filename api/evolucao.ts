// Evolução gravada da apuração nacional (presidente), ponto a ponto.
// GET /api/evolucao?ciclo=ele2026&ele=6258
import { readNational, recordingEnabled } from './_evolucao.js'

const VALID = { ciclo: /^ele\d{4}$/, ele: /^\d{1,6}$/ }

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const ciclo = url.searchParams.get('ciclo') ?? ''
  const ele = url.searchParams.get('ele') ?? ''
  if (!VALID.ciclo.test(ciclo) || !VALID.ele.test(ele)) return new Response('Parâmetro inválido', { status: 400 })

  try {
    const points = await readNational(ciclo, ele.padStart(6, '0'))
    return Response.json(
      { recording: recordingEnabled, points },
      { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=20, stale-while-revalidate=60' } },
    )
  } catch {
    return Response.json({ recording: recordingEnabled, points: [] }, { headers: { 'Cache-Control': 'public, s-maxage=15' } })
  }
}
