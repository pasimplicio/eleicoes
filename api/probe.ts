// Sonda temporária: verifica quais fontes do TSE respondem a partir da Vercel.
const TARGETS = [
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip',
  'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip',
  'https://dadosabertos.tse.jus.br/api/3/action/package_search?q=candidatos%202026&rows=3',
  'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
]

export async function GET(): Promise<Response> {
  const out = await Promise.all(
    TARGETS.map(async (url) => {
      try {
        const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-200' } })
        const body = (await res.text()).slice(0, 160)
        return { url, status: res.status, len: res.headers.get('content-length'), type: res.headers.get('content-type'), body }
      } catch (e) {
        return { url, error: String(e) }
      }
    }),
  )
  return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
