import { Card } from '../components/ui'

const SOURCES = [
  {
    name: 'Divulgação de resultados — TSE',
    url: 'https://resultados.tse.jus.br',
    use: 'Apuração em tempo real por país, UF e município; candidatos, fotos e totais de comparecimento.',
  },
  {
    name: 'PesqEle — TSE',
    url: 'https://pesqele-divulgacao.tse.jus.br',
    use: 'Registro oficial de pesquisas eleitorais: instituto, contratante, metodologia e número de registro.',
  },
  {
    name: 'Portal de Dados Abertos — TSE',
    url: 'https://dadosabertos.tse.jus.br',
    use: 'Séries históricas de votação e candidaturas para comparações entre eleições.',
  },
  {
    name: 'Malhas territoriais — IBGE',
    url: 'https://servicodados.ibge.gov.br/api/docs/malhas',
    use: 'Contornos de estados e municípios usados nos mapas.',
  },
]

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Fontes e metodologia</h1>
      <p className="mt-4 text-lg text-ink-2">
        O Apuração Brasil é um portal independente. Não somos um canal oficial da Justiça Eleitoral: exibimos os
        dados públicos que ela divulga, sem alterar nenhum número.
      </p>

      <Card className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Fontes</h2>
        <ul className="mt-4 divide-y divide-line">
          {SOURCES.map((s) => (
            <li key={s.url} className="py-4">
              <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                {s.name}
              </a>
              <p className="mt-1 text-sm text-muted">{s.use}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6">
        <h2 className="font-serif text-2xl font-semibold">Como os dados chegam até você</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-ink-2">
          <li>
            O TSE publica os arquivos de apuração à medida que as seções são totalizadas, a partir das 17h (Brasília)
            do dia da votação.
          </li>
          <li>
            Nossos servidores leem esses arquivos e os guardam por no máximo 30 segundos. Assim, milhões de acessos
            não sobrecarregam os sistemas da Justiça Eleitoral.
          </li>
          <li>Enquanto a totalização não termina, a página se atualiza automaticamente a cada 30 segundos.</li>
          <li>
            Percentuais são sobre votos válidos (excluídos brancos e nulos), como na divulgação oficial. A cor de cada
            estado ou município indica o candidato à frente; tons mais fortes indicam vantagem maior.
          </li>
        </ol>
      </Card>
    </div>
  )
}
