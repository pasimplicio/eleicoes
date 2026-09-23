import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { NationalExplorer } from '../components/results/NationalExplorer'
import { Card, EmptyState, Segmented } from '../components/ui'
import { findOffice, getCycle, KNOWN_IDS, type Turn } from '../config/elections'
import { fmtDateLong } from '../lib/format'
import { defaultTurn } from '../lib/phase'
import { useElectionIds } from '../lib/tse/queries'
import { NotFound } from './NotFound'

export function OfficePage() {
  const params = useParams()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const cycle = getCycle(Number(params.ano))
  const office = cycle && findOffice(cycle, params.cargo)
  const { ids, loading } = useElectionIds(cycle?.year ?? 0)

  if (!cycle || !office) return <NotFound />

  const q = Number(search.get('turno'))
  const turn: Turn = !office.hasRunoff ? 1 : q === 1 || q === 2 ? q : defaultTurn(cycle, Boolean(ids?.[2]))
  const years = [...new Set([...Object.keys(KNOWN_IDS).map(Number), cycle.year])]
    .filter((y) => getCycle(y)?.kind === cycle.kind)
    .sort((a, b) => b - a)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">
        Eleições {cycle.kind === 'geral' ? 'Gerais' : 'Municipais'} {cycle.year}
      </p>
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{office.name}</h1>

      <div className="mt-6 mb-8 flex flex-wrap gap-3">
        {years.length > 1 && (
          <Segmented
            label="Ano"
            value={String(cycle.year)}
            onChange={(y) => navigate(`/${y}/${office.slug}`)}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        )}
        {office.hasRunoff && (
          <Segmented<Turn>
            label="Turno"
            value={turn}
            onChange={(t) => setSearch({ turno: String(t) }, { replace: true })}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno', disabled: !ids?.[2] },
            ]}
          />
        )}
      </div>

      <Card>
        {office.system === 'proporcional' ? (
          <EmptyState title="Resultados proporcionais em breve">
            Bancadas, quociente eleitoral e lista de eleitos para {office.name.toLowerCase()} entram na próxima fase
            do portal.
          </EmptyState>
        ) : !ids?.[1] && !loading ? (
          <EmptyState title={`Apuração de ${cycle.year} ainda não começou`}>
            O 1º turno será em {fmtDateLong(cycle.dates[1])}. A divulgação começa às 17h (Brasília) e esta página
            passa a mostrar os resultados automaticamente.
          </EmptyState>
        ) : (
          <NationalExplorer cycle={cycle} ids={ids} office={office} turn={turn} />
        )}
      </Card>
    </div>
  )
}
