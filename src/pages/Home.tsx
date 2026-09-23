import { ArrowRight, ChartLineUp, SealCheck, Scales } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Countdown } from '../components/Countdown'
import { MoreLink, NationalExplorer } from '../components/results/NationalExplorer'
import { Container, LiveBadge, Segmented, SectionHeading } from '../components/ui'
import type { Turn } from '../config/elections'
import { fmtDateLong } from '../lib/format'
import { resultsStart, useFeaturedCycle } from '../lib/phase'

export function Home() {
  const f = useFeaturedCycle()
  const offices = f.display.offices.filter((o) => o.system === 'majoritario')
  const [officeSlug, setOfficeSlug] = useState(offices[0].slug)
  const office = offices.find((o) => o.slug === officeSlug) ?? offices[0]
  const [turnChoice, setTurn] = useState<Turn | null>(null)
  const turn: Turn = office.hasRunoff ? (turnChoice ?? f.turn) : 1

  const header = (
    <div>
      {f.live ? (
        <LiveBadge />
      ) : (
        <p className="text-sm font-medium text-muted">
          {f.started ? `Resultado final, ${f.display.year}` : `Referência: eleição de ${f.display.year}`}
        </p>
      )}
      <h1 className="mt-2 font-serif text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        {f.started ? `Apuração para ${office.name.toLowerCase()}` : `O voto para ${office.name.toLowerCase()} em ${f.display.year}`}
      </h1>
      {!f.started && (
        <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-2">
          A apuração de {f.cycle.year} começa em {fmtDateLong(f.cycle.dates[1])}. Até lá, veja o resultado final da
          última eleição {f.display.kind === 'geral' ? 'geral' : 'municipal'}.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Segmented
          label="Cargo"
          value={office.slug}
          onChange={setOfficeSlug}
          options={offices.map((o) => ({ value: o.slug, label: o.name }))}
        />
        {office.hasRunoff && (
          <Segmented<Turn>
            label="Turno"
            value={turn}
            onChange={setTurn}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno', disabled: !f.displayIds?.[2], hint: 'Ainda não houve 2º turno' },
            ]}
          />
        )}
      </div>
    </div>
  )

  return (
    <>
      <Container className="pt-8 sm:pt-12">
        <NationalExplorer cycle={f.display} ids={f.displayIds} office={office} turn={turn} header={header} />
        <div className="mt-6">
          <MoreLink to={`/${f.display.year}/${office.slug}?turno=${turn}`}>
            Página completa de {office.name.toLowerCase()}
          </MoreLink>
        </div>
      </Container>

      {!f.started && (
        <Container className="mt-20">
          <SectionHeading title={`Calendário de ${f.cycle.year}`} />
          <div className="grid gap-8 md:grid-cols-[1fr_1fr_minmax(0,1.3fr)] md:items-start">
            {([1, 2] as const).map((t) => (
              <div key={t}>
                <p className="text-sm text-muted">{t}º turno</p>
                <p className="mt-1 font-serif text-3xl font-semibold tracking-tight">{fmtDateLong(f.cycle.dates[t])}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {t === 1
                    ? 'Todos os cargos. Resultados a partir das 17h.'
                    : f.cycle.kind === 'geral'
                      ? 'Presidente e governador, onde ninguém passar de 50% dos votos válidos.'
                      : 'Prefeito, nas cidades com mais de 200 mil eleitores sem maioria absoluta.'}
                </p>
              </div>
            ))}
            <div>
              <p className="mb-2 text-sm text-muted">Início da divulgação dos resultados</p>
              <Countdown to={resultsStart(f.cycle.dates[1])} />
            </div>
          </div>
        </Container>
      )}

      <Container className="mt-20">
        <div className="grid gap-10 rounded-lg border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="font-serif text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Pesquisas com registro na Justiça Eleitoral
            </h2>
            <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-2">
              Toda pesquisa divulgada precisa de registro prévio no TSE. Esta seção reúne cada uma com o número de
              registro ao lado dos resultados.
            </p>
            <Link
              to="/pesquisas"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-semibold text-page transition hover:bg-ink-2 active:translate-y-px"
            >
              Ver pesquisas <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <dl className="grid content-start gap-7">
            {[
              {
                icon: SealCheck,
                t: 'Registro conferível',
                d: 'Número de registro no TSE e link para o documento original em cada pesquisa.',
              },
              {
                icon: ChartLineUp,
                t: 'Evolução por instituto',
                d: 'A tendência de cada instituto ao longo da campanha, com a margem de erro declarada.',
              },
              {
                icon: Scales,
                t: 'Sem enquetes',
                d: 'Consultas sem método científico não são pesquisas e ficam de fora.',
              },
            ].map(({ icon: Icon, t, d }) => (
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
        </div>
      </Container>
    </>
  )
}
