// Proxy para o servidor oficial de resultados do TSE (resultados.tse.jus.br/oficial).
// Os navegadores nunca chamam o TSE diretamente: a resposta fica no CDN da Vercel,
// o que absorve o pico de acesso no dia da eleição.
// Rota pública: /tse/<caminho> (reescrita em vercel.json para /api/tse?p=<caminho>).

const ORIGIN = 'https://resultados.tse.jus.br/oficial/'

// Apenas arquivos do padrão de divulgação do TSE: ciclo, config comum, dados e fotos.
const ALLOWED = /^(comum\/config\/[\w-]+\.json|ele\d{4}\/[\w/-]+\.(json|jpe?g))$/

export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get('p') ?? ''
  if (!ALLOWED.test(path) || path.includes('..')) {
    return new Response('Caminho inválido', { status: 400 })
  }

  const upstream = await fetch(ORIGIN + path, {
    headers: { 'User-Agent': 'ApuracaoBrasil/1.0 (+https://github.com/pasimplicio/eleicoes)' },
  })

  const isPhoto = /\.jpe?g$/.test(path)
  const isConfig = path.includes('/config/')
  // Dados de apuração: 20s no CDN e até 5 min servindo o último valor enquanto revalida.
  const cache = !upstream.ok
    ? 'public, s-maxage=60'
    : isPhoto
      ? 'public, max-age=86400, s-maxage=604800, immutable'
      : isConfig
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
        : 'public, max-age=10, s-maxage=20, stale-while-revalidate=300'

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
      'Cache-Control': cache,
      'Access-Control-Allow-Origin': '*',
    },
  })
}
