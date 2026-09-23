import { ArrowSquareOut, Info, MagnifyingGlass, UsersThree } from '@phosphor-icons/react'
import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Cycle, ElectionIds, Office } from '../../config/elections'
import { todayBrasilia } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { findUf, inUf, ofUf, UF_BY_IBGE, UFS, type Uf } from '../../config/ufs'
import { statusTone } from '../../lib/candidates'
import { cn, fmtInt, fmtPct, fmtUpdated } from '../../lib/format'
import type { CandidateOutcome } from '../../lib/proportional'
import {
  proportionalName,
  useProportional,
  useProportionalCandidates,
  type PropCandidate,
  type PropParty,
  type ProportionalData,
} from '../../lib/tse/proportionalData'
import { ChoroplethMap } from '../map/ChoroplethMap'
import { CandidatePhoto, PartyChip } from '../results/Candidate'
import { ButtonLink, EmptyState, Segmented, SectionHeading, Skeleton } from '../ui'
import { Hemicycle } from './Hemicycle'

interface Props {
  cycle: Cycle
  ids?: ElectionIds
  office: Office
  header: ReactNode
}

const PAGE = 50

export function ProportionalExplorer({ cycle, ids, office, header }: Props) {
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const uf = findUf(search.get('uf') ?? '') ?? findUf('SP')!
  const upcoming = todayBrasilia() < cycle.dates[1]

  const pickUf = (sigla: string) => {
    const next = new URLSearchParams(search)
    next.set('uf', sigla.toLowerCase())
    setSearch(next, { replace: true, preventScrollReset: true })
  }

  const controls = (
    <div className="flex flex-wrap items-end gap-3">
      <Segmented
        label="Cargo"
        value={office.slug}
        onChange={(slug) => navigate(`/${cycle.year}/${slug}?uf=${uf.sigla.toLowerCase()}`)}
        options={[
          { value: 'deputado-federal', label: 'Federal' },
          { value: 'deputado-estadual', label: uf.sigla === 'DF' ? 'Distrital' : 'Estadual' },
        ]}
      />
      <UfSelect value={uf.sigla} onChange={pickUf} />
    </div>
  )

  return upcoming ? (
    <UpcomingView cycle={cycle} office={office} uf={uf} header={header} controls={controls} onUf={pickUf} />
  ) : (
    <ResultsView cycle={cycle} ids={ids} office={office} uf={uf} header={header} controls={controls} onUf={pickUf} />
  )
}

interface ViewProps {
  cycle: Cycle
  office: Office
  uf: Uf
  header: ReactNode
  controls: ReactNode
  onUf: (sigla: string) => void
}

function UfPickerMap({ uf, onUf }: { uf: Uf; onUf: (s: string) => void }) {
  return (
    <figure>
      <ChoroplethMap
        src="/geo/br-uf.json"
        label="Mapa do Brasil: escolha um estado"
        selected={uf.ibge}
        fill={(code) =>
          code === uf.ibge ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-ink) 12%, var(--color-surface))'
        }
        name={(code) => `Ver ${UF_BY_IBGE[code].nome}`}
        tooltip={(code) => <p className="font-semibold">{UF_BY_IBGE[code].nome}</p>}
        onSelect={(code) => onUf(UF_BY_IBGE[code].sigla)}
      />
      <figcaption className="mt-3 text-sm text-muted">Toque ou clique em um estado para trocar.</figcaption>
    </figure>
  )
}

// ------------------------------------------------------------------ resultados

function ResultsView({ cycle, ids, office, uf, header, controls, onUf }: ViewProps & { ids?: ElectionIds }) {
  const q = useProportional(cycle, ids, office, uf.sigla)
  const d = q.data
  const plural = proportionalName(office, uf.sigla, true)

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="fade-up space-y-7">
          {header}
          {controls}
          {d && <StatusLine d={d} />}
          {d && <KeyFigures d={d} />}
          {q.isLoading && <Skeleton className="h-32 w-full" />}
        </div>
        <UfPickerMap uf={uf} onUf={onUf} />
      </div>

      {q.isLoading ? null : !d ? (
        <EmptyState icon={<UsersThree className="h-7 w-7" />} title="Apuração ainda não divulgada">
          Os votos de {plural.toLowerCase()} {inUf(uf)} aparecem aqui assim que o TSE publicar a apuração.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="bancada">
            <SectionHeading id="bancada" title={`Bancada ${ofUf(uf)}`} />
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
              <div>
                <Hemicycle
                  total={d.seats}
                  label={`Distribuição das ${d.seats} cadeiras de ${plural.toLowerCase()} ${inUf(uf)}`}
                  groups={d.parties.filter((p) => p.seats > 0).map((p) => ({ id: p.id, label: p.label, color: p.color, seats: p.seats }))}
                />
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {d.parties
                    .filter((p) => p.seats > 0)
                    .map((p) => (
                      <li key={p.id} className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden />
                        <span title={p.name}>{p.label}</span>
                        <strong className="font-semibold tabular">{p.seats}</strong>
                      </li>
                    ))}
                </ul>
              </div>
              <PartyTable parties={d.parties} />
            </div>
          </section>

          <section aria-labelledby="eleitos">
            <SectionHeading id="eleitos" title={d.official ? 'Eleitos' : 'Eleitos na projeção'} />
            <ElectedList d={d} />
          </section>

          <section aria-labelledby="todos">
            <SectionHeading id="todos" title="Todos os candidatos" />
            <CandidateTable d={d} />
          </section>

          <Rules d={d} year={cycle.year} />
        </>
      )}
    </div>
  )
}

function StatusLine({ d }: { d: ProportionalData }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {d.official ? (
          <span className="rounded-full bg-ok px-2.5 py-0.5 text-xs font-semibold text-white">Resultado oficial do TSE</span>
        ) : (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">
            Projeção pelas regras do TSE
          </span>
        )}
        <span className="font-medium">
          {d.sectionsPct >= 100 ? 'Seções 100% totalizadas' : `${fmtPct(d.sectionsPct)} das seções totalizadas`}
        </span>
      </div>
      <p className="text-sm text-muted tabular">Atualizado em {fmtUpdated(d.updatedAt)}</p>
    </div>
  )
}

function KeyFigures({ d }: { d: ProportionalData }) {
  const items = [
    { label: 'Cadeiras', value: fmtInt(d.seats) },
    { label: 'Votos válidos', value: fmtInt(d.validVotes), hint: `${fmtInt(d.nominal)} nominais e ${fmtInt(d.legenda)} de legenda` },
    { label: 'Quociente eleitoral', value: fmtInt(d.qe), hint: 'Votos válidos divididos pelas cadeiras' },
    { label: 'Mínimo do candidato', value: fmtInt(Math.ceil(d.min10)), hint: '10% do quociente, para vagas do QP' },
    { label: 'Sobras: partido', value: fmtInt(Math.ceil(d.min80)), hint: '80% do quociente' },
    { label: 'Sobras: candidato', value: fmtInt(Math.ceil(d.min20)), hint: '20% do quociente' },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} title={it.hint}>
          <dt className="text-xs text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-base font-semibold tabular">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PartyTable({ parties }: { parties: PropParty[] }) {
  const [all, setAll] = useState(false)
  const rows = all ? parties : parties.filter((p) => p.seats > 0)
  const hidden = parties.length - parties.filter((p) => p.seats > 0).length
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Distribuição das cadeiras por partido ou federação</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">Partido ou federação</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Votos</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell" title="Votos divididos pelo quociente eleitoral">
                QP
              </th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Por QP</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Por média</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Cadeiras</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold">{p.label}</span>
                      {p.isFederation && <span className="block truncate text-xs text-muted">{p.name}</span>}
                    </span>
                  </span>
                </th>
                <td className="hidden px-3 py-2.5 text-right tabular sm:table-cell">{fmtInt(p.votes)}</td>
                <td className={cn('hidden px-3 py-2.5 text-right tabular sm:table-cell', !p.reaches80 && 'text-muted')}>
                  {p.quotient.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular md:table-cell">{p.qpSeats}</td>
                <td className="hidden px-3 py-2.5 text-right tabular md:table-cell">{p.averageSeats}</td>
                <td className="px-4 py-2.5 text-right text-base font-semibold tabular">{p.seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 min-h-11 cursor-pointer text-sm font-semibold hover:underline"
        >
          {all ? 'Mostrar só quem elegeu' : `Mostrar os outros ${hidden} partidos sem cadeira`}
        </button>
      )}
    </div>
  )
}

const OUTCOME_LABEL: Record<CandidateOutcome, string> = {
  qp: 'Eleito por QP',
  media: 'Eleito por média',
  suplente: 'Suplente',
  'nao-eleito': 'Não eleito',
}

function OutcomeBadge({ outcome, short }: { outcome: CandidateOutcome; short?: boolean }) {
  const elected = outcome === 'qp' || outcome === 'media'
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-px text-xs font-medium whitespace-nowrap',
        elected ? 'bg-ok text-white' : outcome === 'suplente' ? 'border border-line text-ink-2' : 'text-muted',
      )}
    >
      {short && elected ? (outcome === 'qp' ? 'QP' : 'Média') : OUTCOME_LABEL[outcome]}
    </span>
  )
}

function ElectedList({ d }: { d: ProportionalData }) {
  const groups = d.parties
    .filter((p) => p.seats > 0)
    .map((p) => ({
      party: p,
      members: d.candidates.filter((c) => c.partyId === p.id && (c.outcome === 'qp' || c.outcome === 'media')),
    }))
  return (
    <div className="gap-x-10 md:columns-2 xl:columns-3">
      {groups.map(({ party, members }) => (
        <div key={party.id} className="mb-8 break-inside-avoid">
          <h3 className="mb-2 flex items-center justify-between gap-2 border-b border-line pb-2">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: party.color }} aria-hidden />
              {party.label}
            </span>
            <span className="text-sm text-muted tabular">
              {party.seats} {party.seats === 1 ? 'cadeira' : 'cadeiras'}
            </span>
          </h3>
          <ul>
            {members.map((c) => (
              <li key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 py-1.5">
                <CandidatePhoto src={c.photo} name={c.name} color={party.color} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted tabular">
                    {c.party}, {c.number}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular">{fmtInt(c.votes)}</span>
                  <OutcomeBadge outcome={c.outcome} short />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Filters({
  q,
  setQ,
  party,
  setParty,
  parties,
  extra,
}: {
  q: string
  setQ: (v: string) => void
  party: string
  setParty: (v: string) => void
  parties: { value: string; label: string }[]
  extra?: ReactNode
}) {
  const id = useId()
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end">
      <div>
        <label htmlFor={`${id}-q`} className="mb-1.5 block text-sm font-medium">
          Buscar por nome ou número
        </label>
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-ink/50">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: Maria ou 1234"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-p`} className="mb-1.5 block text-sm font-medium">
          Partido
        </label>
        <select
          id={`${id}-p`}
          value={party}
          onChange={(e) => setParty(e.target.value)}
          className="min-h-11 w-full cursor-pointer rounded-md border border-line bg-surface px-3 text-base sm:text-sm"
        >
          <option value="">Todos</option>
          {parties.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {extra}
    </div>
  )
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function CandidateTable({ d }: { d: ProportionalData }) {
  const [q, setQ] = useState('')
  const [party, setParty] = useState('')
  const [status, setStatus] = useState<'todos' | 'eleitos' | 'suplente' | 'nao-eleito'>('todos')
  const [limit, setLimit] = useState(PAGE)
  const dq = useDeferredValue(q)

  const rank = useMemo(() => new Map(d.candidates.map((c, i) => [c.id, i + 1])), [d.candidates])
  const rows = useMemo(() => {
    const nq = norm(dq.trim())
    return d.candidates.filter(
      (c) =>
        (!nq || norm(c.name).includes(nq) || c.number.startsWith(nq)) &&
        (!party || c.partyId === party) &&
        (status === 'todos' ||
          (status === 'eleitos' ? c.outcome === 'qp' || c.outcome === 'media' : c.outcome === status)),
    )
  }, [d.candidates, dq, party, status])

  const partyColors = useMemo(() => new Map(d.parties.map((p) => [p.id, p.color])), [d.parties])

  return (
    <div>
      <Filters
        q={q}
        setQ={(v) => (setQ(v), setLimit(PAGE))}
        party={party}
        setParty={(v) => (setParty(v), setLimit(PAGE))}
        parties={d.parties.map((p) => ({ value: p.id, label: p.label }))}
        extra={
          <Segmented
            label="Situação"
            value={status}
            onChange={(v) => (setStatus(v), setLimit(PAGE))}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'eleitos', label: 'Eleitos' },
              { value: 'suplente', label: 'Suplentes' },
            ]}
          />
        }
      />
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {fmtInt(rows.length)} {rows.length === 1 ? 'candidato' : 'candidatos'}
      </p>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Candidatos por votação</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="w-12 px-4 py-2.5 text-right font-medium">#</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Candidato</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Partido</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Votos</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">% válidos</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((c) => (
              <CandidateRow key={c.id} c={c} rank={rank.get(c.id)!} color={partyColors.get(c.partyId)!} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-4 min-h-11 w-full cursor-pointer rounded-md border border-line bg-surface text-sm font-semibold hover:bg-surface-2"
        >
          Mostrar mais {Math.min(PAGE, rows.length - limit)} de {fmtInt(rows.length - limit)}
        </button>
      )}
    </div>
  )
}

function CandidateRow({ c, rank, color }: { c: PropCandidate; rank: number; color: string }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 text-right text-muted tabular">{rank}</td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2.5">
          <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          <span className="min-w-0">
            <span className="block font-medium">{c.name}</span>
            <span className="block text-xs text-muted tabular">
              <span className="sm:hidden">{c.party}, </span>
              {c.number}
              {c.registration !== 'Válido' && `, ${c.registration.toLowerCase()}`}
            </span>
          </span>
        </span>
      </td>
      <td className="hidden px-3 py-2 sm:table-cell">{c.party}</td>
      <td className="px-3 py-2 text-right font-semibold tabular">{fmtInt(c.votes)}</td>
      <td className="hidden px-3 py-2 text-right text-ink-2 tabular md:table-cell">{fmtPct(c.pct)}</td>
      <td className="px-4 py-2 text-right">
        <OutcomeBadge outcome={c.outcome} />
      </td>
    </tr>
  )
}

function Rules({ d, year }: { d: ProportionalData; year: number }) {
  return (
    <section aria-labelledby="regras" className="rounded-lg border border-line bg-surface p-6 sm:p-8">
      <h2 id="regras" className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
        <Info className="h-6 w-6" aria-hidden /> Como as cadeiras são distribuídas
      </h2>
      <ol className="mt-5 grid gap-x-10 gap-y-5 text-sm leading-relaxed text-ink-2 md:grid-cols-2">
        <li>
          <strong className="text-ink">Quociente eleitoral.</strong> Os votos válidos ({fmtInt(d.validVotes)}) divididos
          pelas {d.seats} cadeiras dão {fmtInt(d.qe)} votos. Fração até meio é desprezada; acima, arredonda para cima.
        </li>
        <li>
          <strong className="text-ink">Quociente partidário.</strong> Os votos de cada partido ou federação (nominais
          mais legenda) divididos pelo quociente eleitoral, sem a fração, dão as cadeiras da primeira fase. Elas vão aos
          mais votados que tenham ao menos 10% do quociente.
        </li>
        <li>
          <strong className="text-ink">Sobras.</strong> As cadeiras restantes vão, uma a uma, à maior média (votos
          divididos pelas cadeiras já obtidas mais um), entre partidos com 80% do quociente e candidatos com 20%.
        </li>
        <li>
          <strong className="text-ink">Última fase.</strong>{' '}
          {year >= 2024
            ? 'Sem partido e candidato que cumpram as duas exigências, as cadeiras seguem pela maior média entre todos os partidos, conforme decisão do STF de 2024 (ADIs 7228, 7263 e 7325).'
            : 'Sem partido e candidato que cumpram as duas exigências, as cadeiras seguiram pela maior média entre os partidos com 80% do quociente, como o TSE aplicou em 2022.'}{' '}
          Federações contam como um único partido.
        </li>
      </ol>
      <p className="mt-6 text-xs text-muted">
        {d.official
          ? 'Cadeiras e situação dos candidatos conforme declarado pelo TSE.'
          : 'Durante a apuração, a distribuição é calculada por este portal com as regras acima e pode mudar a cada atualização. O resultado oficial é o declarado pelo TSE.'}
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ antes da eleição

function UpcomingView({ cycle, office, uf, header, controls, onUf }: ViewProps) {
  const list = useProportionalCandidates(cycle.year, office, uf.sigla)
  const [q, setQ] = useState('')
  const [party, setParty] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const dq = useDeferredValue(q)
  const candidates = useMemo(() => list.data?.candidates ?? [], [list.data])

  const parties = useMemo(() => {
    const count = new Map<string, number>()
    for (const c of candidates) count.set(c.party, (count.get(c.party) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }, [candidates])

  const rows = useMemo(() => {
    const nq = norm(dq.trim())
    return candidates.filter(
      (c) => (!nq || norm(c.name).includes(nq) || c.number.startsWith(nq)) && (!party || c.party === party),
    )
  }, [candidates, dq, party])

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="fade-up space-y-7">
          {header}
          {controls}
          {list.data && (
            <p className="text-ink-2">
              <span className="text-4xl font-semibold tracking-tight text-ink tabular">{fmtInt(candidates.length)}</span>{' '}
              candidaturas a {proportionalName(office, uf.sigla).toLowerCase()} {inUf(uf)}, de {parties.length}{' '}
              partidos.
            </p>
          )}
        </div>
        <UfPickerMap uf={uf} onUf={onUf} />
      </div>

      <section aria-labelledby="candidatos-prop">
        <SectionHeading
          id="candidatos-prop"
          title={`Candidatos a ${proportionalName(office, uf.sigla).toLowerCase()} ${inUf(uf)}`}
          action={
            list.data && (
              <span className="text-right text-xs text-muted">
                Fonte: TSE, DivulgaCandContas, coletado em {new Date(list.data.collectedAt).toLocaleDateString('pt-BR')}
              </span>
            )
          }
        />
        {list.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !list.data ? (
          <EmptyState icon={<UsersThree className="h-7 w-7" />} title="Lista de candidaturas ainda não disponível">
            <p>A lista oficial desta UF pode ser consultada no DivulgaCandContas, do TSE.</p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="https://divulgacandcontas.tse.jus.br/divulga/" external variant="ghost">
                Abrir DivulgaCandContas <ArrowSquareOut className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </div>
          </EmptyState>
        ) : (
          <>
            <Filters
              q={q}
              setQ={(v) => (setQ(v), setLimit(PAGE))}
              party={party}
              setParty={(v) => (setParty(v), setLimit(PAGE))}
              parties={parties.map(([p, n]) => ({ value: p, label: `${p} (${n})` }))}
            />
            <p className="mb-3 text-sm text-muted" aria-live="polite">
              {fmtInt(rows.length)} {rows.length === 1 ? 'candidatura' : 'candidaturas'}
            </p>
            <ul className="grid gap-x-8 rounded-lg border border-line bg-surface px-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.slice(0, limit).map((c) => {
                const tone = statusTone(c.status)
                return (
                  <li
                    key={c.id}
                    className={cn(
                      'grid grid-cols-[auto_1fr_auto] items-center gap-x-3 border-b border-line py-2.5',
                      tone === 'off' && 'opacity-55',
                    )}
                  >
                    <CandidatePhoto src={c.photo} name={c.name} color={partyColor(c.party)} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <PartyChip party={c.party} />
                        {c.status && c.status !== 'Deferido' && (
                          <span className="truncate text-xs text-muted">{c.status}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-lg font-semibold tracking-tight tabular" aria-label={`Número ${c.number}`}>
                      {c.number}
                    </span>
                  </li>
                )
              })}
            </ul>
            {rows.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mt-4 min-h-11 w-full cursor-pointer rounded-md border border-line bg-surface text-sm font-semibold hover:bg-surface-2"
              >
                Mostrar mais {Math.min(PAGE, rows.length - limit)} de {fmtInt(rows.length - limit)}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function UfSelect({ value, onChange }: { value: string; onChange: (sigla: string) => void }) {
  const id = useId()
  return (
    <div className="min-w-48">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Estado
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full cursor-pointer rounded-md border border-line bg-surface px-3 text-base sm:text-sm"
      >
        {UFS.map((u) => (
          <option key={u.sigla} value={u.sigla}>
            {u.nome}
          </option>
        ))}
      </select>
    </div>
  )
}
