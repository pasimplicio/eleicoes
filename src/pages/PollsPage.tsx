import { ExternalLink, FileSearch } from 'lucide-react'
import { Card, SectionTitle } from '../components/ui'
import { currentYear } from '../config/elections'

export function PollsPage() {
  const year = currentYear()
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Eleições {year}</p>
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Pesquisas eleitorais</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        Pela Lei 9.504/97 (art. 33), toda pesquisa eleitoral divulgada precisa estar registrada na Justiça Eleitoral
        até cinco dias antes da publicação. Este portal mostra apenas pesquisas registradas, sempre com o número de
        registro para conferência.
      </p>

      <Card className="mt-10">
        <SectionTitle kicker="Em construção" title="Catálogo e agregador de pesquisas" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="font-semibold">O que vem nesta seção</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
              <li>Todas as pesquisas registradas no PesqEle, filtráveis por UF, cargo e instituto</li>
              <li>Ficha de cada registro: contratante, valor, amostra, margem de erro e período de campo</li>
              <li>Resultados publicados, vinculados ao número de registro</li>
              <li>Evolução por instituto e média das pesquisas ao longo da campanha</li>
            </ul>
          </div>
          <div className="rounded-xl bg-surface-2 p-5">
            <FileSearch className="h-6 w-6 text-brand-2 dark:text-accent" />
            <p className="mt-3 font-semibold">Consulte agora na fonte oficial</p>
            <p className="mt-1 text-sm text-muted">
              Enquanto esta seção é finalizada, os registros podem ser consultados diretamente no sistema do TSE.
            </p>
            <a
              href="https://pesqele-divulgacao.tse.jus.br/app/pesquisa/listar.xhtml"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-2"
            >
              Abrir PesqEle (TSE) <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  )
}
