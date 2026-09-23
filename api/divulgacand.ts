// Proxy para o DivulgaCandContas do TSE (candidaturas registradas: nomes, números,
// partidos, situação do registro, vices e fotos). Usado antes da eleição, quando
// ainda não há resultados. Rota pública: /cand/<caminho> (ver vercel.json).

const ORIGIN = 'https://divulgacandcontas.tse.jus.br/divulga/rest/'

const ALLOWED = [
  /^v1\/eleicao\/ordinarias$/,
  /^v1\/candidatura\/listar\/\d{4}\/[A-Z]{2}\/\d+\/\d+\/candidatos$/,
  /^v1\/candidatura\/buscar\/\d{4}\/[A-Z]{2}\/\d+\/candidato\/\d+$/,
  /^arquivo\/img\/\d+\/\d+\/[A-Z]{2}$/,
]

export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get('p') ?? ''
  if (!ALLOWED.some((re) => re.test(path))) return new Response('Caminho inválido', { status: 400 })

  const upstream = await fetch(ORIGIN + path, {
    headers: {
      Accept: path.startsWith('arquivo/') ? 'image/*' : 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; ApuracaoBrasil/1.0; +https://eleicoes.sistemaspsdev.com.br)',
      Referer: 'https://divulgacandcontas.tse.jus.br/divulga/',
    },
  })

  const isImage = path.startsWith('arquivo/')
  // Candidaturas mudam pouco (situação do registro): 1 h no CDN; fotos, 7 dias.
  const cache = !upstream.ok
    ? 'public, s-maxage=120'
    : isImage
      ? 'public, max-age=86400, s-maxage=604800'
      : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
      'Cache-Control': cache,
    },
  })
}
