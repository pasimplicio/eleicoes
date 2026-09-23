import { ArrowSquareOut } from '@phosphor-icons/react'
import { Container, SectionHeading } from '../components/ui'

const SOURCES = [
  {
    name: 'Divulgação de resultados do TSE',
    url: 'https://resultados.tse.jus.br',
    use: 'Apuração por país, estado e município; candidatos, fotos e comparecimento.',
  },
  {
    name: 'PesqEle, do TSE',
    url: 'https://pesqele-divulgacao.tse.jus.br',
    use: 'Registro oficial de pesquisas: instituto, contratante, metodologia e número de registro.',
  },
  {
    name: 'Portal de Dados Abertos do TSE',
    url: 'https://dadosabertos.tse.jus.br',
    use: 'Séries históricas de votação e candidaturas para comparar eleições.',
  },
  {
    name: 'Malhas territoriais do IBGE',
    url: 'https://servicodados.ibge.gov.br/api/docs/malhas',
    use: 'Contornos de estados e municípios usados nos mapas.',
  },
]

const STEPS = [
  {
    t: 'O TSE publica',
    d: 'Os arquivos de apuração saem à medida que as seções são totalizadas, a partir das 17h (Brasília).',
  },
  {
    t: 'Guardamos por segundos',
    d: 'Nossos servidores leem os arquivos e os mantêm por até 30 segundos, sem sobrecarregar a Justiça Eleitoral.',
  },
  {
    t: 'A página se atualiza',
    d: 'Enquanto a totalização não termina, os números são renovados a cada 30 segundos, sem recarregar.',
  },
  {
    t: 'Como ler os números',
    d: 'Percentuais sobre votos válidos, como na divulgação oficial. A cor indica quem está à frente; tom mais forte, vantagem maior.',
  },
]

export function AboutPage() {
  return (
    <Container className="pt-8 sm:pt-12">
      <div className="max-w-3xl">
        <h1 className="font-serif text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl">
          Metodologia e fontes
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">
          O Apuração Brasil é independente e não é um canal oficial da Justiça Eleitoral. Exibimos os dados públicos
          que ela divulga, sem alterar nenhum número.
        </p>
      </div>

      <section className="mt-16">
        <SectionHeading title="Do TSE até a sua tela" />
        <ol className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.t} className="border-l-2 border-accent pl-4">
              <p className="font-semibold">{s.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <SectionHeading title="Fontes oficiais" />
        <ul className="grid gap-4 md:grid-cols-2">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full items-start justify-between gap-4 rounded-lg border border-line bg-surface p-5 transition hover:border-ink/30"
              >
                <span>
                  <span className="font-semibold group-hover:underline">{s.name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{s.use}</span>
                </span>
                <ArrowSquareOut className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  )
}
