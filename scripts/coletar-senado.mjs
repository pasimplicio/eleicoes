// Senadores que continuam no mandato após a eleição (mandato até o fim da legislatura
// seguinte), com o partido atual, a partir dos dados abertos do Senado Federal.
// Junto com os eleitos no ciclo, forma a composição do Senado na nova legislatura.
// Uso: node scripts/coletar-senado.mjs 2027   (ano de início da nova legislatura)
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const inicio = Number(process.argv[2] ?? 2027)
// Mandato de 8 anos: quem continua termina na legislatura que começa em `inicio`.
const fimMandato = `${inicio + 4}-01-31`

const res = await fetch('https://legis.senado.leg.br/dadosabertos/senador/lista/atual', {
  headers: { Accept: 'application/json' },
})
if (!res.ok) throw new Error(`Senado: HTTP ${res.status}`)
const lista = (await res.json()).ListaParlamentarEmExercicio.Parlamentares.Parlamentar

const senadores = lista
  .filter((p) =>
    [p.Mandato.PrimeiraLegislaturaDoMandato?.DataFim, p.Mandato.SegundaLegislaturaDoMandato?.DataFim].includes(fimMandato),
  )
  .map((p) => ({
    nome: p.IdentificacaoParlamentar.NomeParlamentar,
    uf: p.Mandato.UfParlamentar,
    partido: p.IdentificacaoParlamentar.SiglaPartidoParlamentar,
    foto: p.IdentificacaoParlamentar.UrlFotoParlamentar?.replace('http://', 'https://'),
    suplente: p.Mandato.Suplentes?.Suplente?.find((s) => s.DescricaoParticipacao === '1º Suplente')?.NomeParlamentar ?? null,
    fimMandato,
  }))
  .sort((a, b) => a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome))

const out = join(ROOT, 'public', 'data', `senado-continuam-${inicio}.json`)
await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ fonte: 'Senado Federal, dados abertos (senador/lista/atual)', coletadoEm: new Date().toISOString().slice(0, 10), senadores }, null, 2),
)
console.log(`${senadores.length} senadores com mandato até ${fimMandato} -> ${out}`)
