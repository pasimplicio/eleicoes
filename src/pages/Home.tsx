import { ArrowRight, ChartLineUp, SealCheck, Scales } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CandidatesExplorer } from '../components/candidates/CandidatesExplorer'
import { Countdown } from '../components/Countdown'
import { MoreLink, NationalExplorer } from '../components/results/NationalExplorer'
import { Container, LiveBadge, Segmented, SectionHeading } from '../components/ui'
import { getCycle, KNOWN_IDS, type Turn } from '../config/elections'
import { useSnapshot } from '../lib/candidates'
import { fmtDateLong } from '../lib/format'
import { defaultTurn, resultsStart, useFeaturedCycle } from '../lib/phase'
import { useElectionIds } from '../lib/tse/queries'

const UPCOMING_TITLE: Record<string, string> = {
  presidente: 'Quem disputa a Presidência',
  governador: 'Quem disputa os governos estaduais',
  senador: 'Quem disputa o Senado',
  prefeito: 'Quem disputa as prefeituras',
}

export function Home() {
  const f = useFeaturedCycle()
  const [search, setSearch] = useSearchParams()
  const snapshot = useSnapshot(f.cycle.year)

  // Anos do mesmo tipo de eleição (geral ou municipal) com dados, mais o ciclo corrente.
  const years = [...new Set([f.cycle.year, ...Object.keys(KNOWN_IDS).map(Number)])]
    .filter((y) => getCycle(y)?.kind === f.cycle.kind)
    .sort((a, b) => b - a)
  const hasCandidates = Boolean(f.ids?.[1]) || Boolean(snapshot.data)
  const defaultYear = f.started || hasCandidates ? f.cycle.year : f.display.year
  const yearParam = Number(search.get('ano'))
  const year = years.includes(yearParam) ? yearParam : defaultYear
  const cycle = getCycle(year)!
  const { ids } = useElectionIds(year)
  const upcoming = year === f.cycle.year && !f.started

  const offices = cycle.offices.filter((o) => o.system === 'majoritario')
  const [officeSlug, setOfficeSlug] = useState(offices[0].slug)
  const office = offices.find((o) => o.slug === officeSlug) ?? offices[0]
  const [turnChoice, setTurn] = useState<Turn | null>(null)
  const baseTurn: Turn = year === f.cycle.year ? f.turn : defaultTurn(cycle, Boolean(ids?.[2]))
  const turn: Turn = office.hasRunoff ? (turnChoice ?? baseTurn) : 1

  const setYear = (y: string) => {
    const next = new URLSearchParams()
    next.set('ano', y)
    setTurn(null)
    setSearch(next, { replace: true, preventScrollReset: true })
  }

  const kicker = upcoming
    ? `Eleições ${cycle.year}, candidaturas registradas`
    : year === f.cycle.year && f.live
      ? null
      : `Resultado final, eleições de ${year}`

  const header = (
    <div>
      {kicker === null ? <LiveBadge /> : <p className="text-sm font-medium text-muted">{kicker}</p>}
      <h1 className="mt-2 font-serif text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        {upcoming
          ? (UPCOMING_TITLE[office.slug] ?? `Candidatos a ${office.name.toLowerCase()}`)
          : year === f.cycle.year
            ? `Apuração para ${office.name.toLowerCase()}`
            : `O voto para ${office.name.toLowerCase()} em ${year}`}
      </h1>
      {upcoming && (
        <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-2">
          O 1º turno é em {fmtDateLong(cycle.dates[1])}. Conheça as candidaturas registradas na Justiça Eleitoral.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {years.length > 1 && (
          <Segmented
            label="Ano da eleição"
            value={String(year)}
            onChange={setYear}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        )}
        <Segmented
          label="Cargo"
          value={office.slug}
          onChange={setOfficeSlug}
          options={offices.map((o) => ({ value: o.slug, label: o.name }))}
        />
        {office.hasRunoff && !upcoming && (
          <Segmented<Turn>
            label="Turno"
            value={turn}
            onChange={setTurn}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno', disabled: !ids?.[2], hint: 'Ainda não houve 2º turno' },
            ]}
          />
        )}
      </div>
    </div>
  )

  return (
    <>
      <Container className="pt-8 sm:pt-12">
        {upcoming ? (
          <CandidatesExplorer cycle={cycle} ids={ids} office={office} header={header} />
        ) : (
          <NationalExplorer cycle={cycle} ids={ids} office={office} turn={turn} header={header} />
        )}
        <div className="mt-6">
          <MoreLink to={`/${year}/${office.slug}${upcoming ? '' : `?turno=${turn}`}`}>
            Página completa de {office.name.toLowerCase()}
          </MoreLink>
        </div>
      </Container>

      {!f.started && !upcoming && (
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
