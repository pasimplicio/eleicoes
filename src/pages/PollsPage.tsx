import { ArrowSquareOut, ChartLineUp, FileMagnifyingGlass, Funnel, SealCheck } from '@phosphor-icons/react'
import { ButtonLink, Container, SectionHeading } from '../components/ui'

const COMING = [
  { icon: FileMagnifyingGlass, t: 'Catálogo completo', d: 'Todas as pesquisas registradas no PesqEle, por UF, cargo e instituto.' },
  { icon: SealCheck, t: 'Ficha do registro', d: 'Contratante, valor, amostra, margem de erro e período de campo.' },
  { icon: ChartLineUp, t: 'Evolução e média', d: 'Tendência por instituto e média das pesquisas ao longo da campanha.' },
  { icon: Funnel, t: 'Filtros rápidos', d: 'Encontre a pesquisa do seu estado em poucos toques.' },
]

export function PollsPage() {
  return (
    <Container className="pt-8 sm:pt-12">
      <div className="max-w-3xl">
        <h1 className="font-serif text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl">
          Pesquisas eleitorais
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">
          A Lei 9.504/97 exige que toda pesquisa divulgada seja registrada na Justiça Eleitoral até cinco dias antes
          da publicação. Aqui entram apenas pesquisas registradas, sempre com o número de registro.
        </p>
        <div className="mt-7">
          <ButtonLink href="https://pesqele-divulgacao.tse.jus.br/app/pesquisa/listar.xhtml" external>
            Consultar no PesqEle <ArrowSquareOut className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
      </div>

      <section className="mt-16">
        <SectionHeading title="Em construção nesta seção" />
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {COMING.map(({ icon: Icon, t, d }) => (
            <div key={t} className="grid grid-cols-[2.5rem_1fr] gap-x-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{d}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </Container>
  )
}
