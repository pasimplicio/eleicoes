import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CandidatesExplorer } from '../components/candidates/CandidatesExplorer'
import { ProportionalExplorer } from '../components/proportional/ProportionalExplorer'
import { NationalExplorer } from '../components/results/NationalExplorer'
import { Container, Segmented } from '../components/ui'
import { findOffice, getCycle, KNOWN_IDS, todayBrasilia, type Turn } from '../config/elections'
import { defaultTurn } from '../lib/phase'
import { useElectionIds } from '../lib/tse/queries'
import { NotFound } from './NotFound'

export function OfficePage() {
  const params = useParams()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const cycle = getCycle(Number(params.ano))
  const office = cycle && findOffice(cycle, params.cargo)
  const { ids } = useElectionIds(cycle?.year ?? 0)

  if (!cycle || !office) return <NotFound />

  const q = Number(search.get('turno'))
  const turn: Turn = !office.hasRunoff ? 1 : q === 1 || q === 2 ? q : defaultTurn(cycle, Boolean(ids?.[2]))
  const years = [...new Set([...Object.keys(KNOWN_IDS).map(Number), cycle.year])]
    .filter((y) => getCycle(y)?.kind === cycle.kind)
    .sort((a, b) => b - a)

  const header = (
    <div>
      <p className="text-sm font-medium text-muted">
        Eleições {cycle.kind === 'geral' ? 'gerais' : 'municipais'} de {cycle.year}
      </p>
      <h1 className="mt-2 font-serif text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        {office.system === 'proporcional'
          ? office.slug === 'deputado-federal'
            ? 'Deputados federais'
            : 'Deputados estaduais e distritais'
          : office.name}
      </h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {years.length > 1 && (
          <Segmented
            label="Ano"
            value={String(cycle.year)}
            onChange={(y) => navigate(`/${y}/${office.slug}`)}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        )}
        {office.hasRunoff && office.system === 'majoritario' && !(todayBrasilia() < cycle.dates[1]) && (
          <Segmented<Turn>
            label="Turno"
            value={turn}
            onChange={(t) => setSearch({ turno: String(t) }, { replace: true })}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno', disabled: !ids?.[2], hint: 'Ainda não houve 2º turno' },
            ]}
          />
        )}
      </div>
    </div>
  )

  const upcoming = todayBrasilia() < cycle.dates[1]

  return (
    <Container className="pt-8 sm:pt-12">
      {office.system === 'proporcional' ? (
        <ProportionalExplorer cycle={cycle} ids={ids} office={office} header={header} />
      ) : upcoming ? (
        <CandidatesExplorer cycle={cycle} ids={ids} office={office} header={header} />
      ) : (
        <NationalExplorer cycle={cycle} ids={ids} office={office} turn={turn} header={header} />
      )}
    </Container>
  )
}
