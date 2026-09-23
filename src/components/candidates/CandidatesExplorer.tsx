import { ArrowSquareOut, UsersThree } from '@phosphor-icons/react'
import { useId, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Cycle, ElectionIds, Office } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { findUf, UF_BY_IBGE, UFS } from '../../config/ufs'
import { statusTone, useCandidates, type Candidate } from '../../lib/candidates'
import { cn, fmtDateLong } from '../../lib/format'
import { resultsStart } from '../../lib/phase'
import { Countdown } from '../Countdown'
import { ChoroplethMap } from '../map/ChoroplethMap'
import { ButtonLink, EmptyState, SectionHeading, Skeleton } from '../ui'
import { CandidatePhoto, PartyChip } from '../results/Candidate'

interface Props {
  cycle: Cycle
  ids?: ElectionIds
  office: Office
  header?: ReactNode
}

const OFFICE_TITLE: Record<string, (uf?: string) => string> = {
  presidente: () => 'Candidatos a presidente',
  governador: (uf) => `Candidatos a governador${uf ? ` em ${uf}` : ''}`,
  senador: (uf) => `Candidatos ao Senado${uf ? ` em ${uf}` : ''}`,
  prefeito: (uf) => `Candidatos a prefeito${uf ? ` em ${uf}` : ''}`,
}

export function CandidatesExplorer({ cycle, ids, office, header }: Props) {
  const [search, setSearch] = useSearchParams()
  const needsUf = office.scope !== 'br'
  const uf = needsUf ? (findUf(search.get('uf') ?? '') ?? findUf('SP')!) : undefined
  const abr = needsUf ? uf!.sigla.toLowerCase() : 'br'
  const list = useCandidates(cycle, ids, office, abr)

  const pickUf = (sigla: string) => {
    const next = new URLSearchParams(search)
    next.set('uf', sigla.toLowerCase())
    setSearch(next, { replace: true, preventScrollReset: true })
  }

  const title = (OFFICE_TITLE[office.slug] ?? (() => `Candidatos a ${office.name.toLowerCase()}`))(uf?.nome)
  const candidates = list.data?.candidates ?? []

  return (
    <div className="space-y-14">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="fade-up space-y-7">
          {header}
          {needsUf && <UfSelect value={uf!.sigla} onChange={pickUf} />}
          {list.data && (
            <p className="text-ink-2">
              <span className="text-4xl font-semibold tracking-tight text-ink tabular">{candidates.length}</span>{' '}
              {candidates.length === 1 ? 'candidatura registrada' : 'candidaturas registradas'}
              {uf ? ` em ${uf.nome}` : ' para presidente'}.
            </p>
          )}
        </div>

        {needsUf ? (
          <figure>
            <ChoroplethMap
              src="/geo/br-uf.json"
              label="Mapa do Brasil: escolha um estado para ver os candidatos"
              selected={uf!.ibge}
              fill={(code) =>
                code === uf!.ibge ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-ink) 12%, var(--color-surface))'
              }
              name={(code) => `Ver candidatos em ${UF_BY_IBGE[code].nome}`}
              tooltip={(code) => (
                <div>
                  <p className="font-semibold">{UF_BY_IBGE[code].nome}</p>
                  <p className="mt-0.5 text-muted">Clique para ver os candidatos</p>
                </div>
              )}
              onSelect={(code) => pickUf(UF_BY_IBGE[code].sigla)}
            />
            <figcaption className="mt-3 text-sm text-muted">Toque ou clique em um estado para trocar a lista.</figcaption>
          </figure>
        ) : (
          <aside className="rounded-lg border border-line bg-surface p-6 sm:p-8">
            <p className="text-sm text-muted">1º turno</p>
            <p className="mt-1 font-serif text-3xl font-semibold tracking-tight">{fmtDateLong(cycle.dates[1])}</p>
            <p className="mt-6 mb-2 text-sm text-muted">Início da divulgação dos resultados</p>
            <Countdown to={resultsStart(cycle.dates[1])} />
            <p className="mt-6 text-sm text-muted">
              2º turno, se necessário, em {fmtDateLong(cycle.dates[2])}.
            </p>
          </aside>
        )}
      </div>

      <section aria-labelledby="candidatos">
        <SectionHeading
          id="candidatos"
          title={title}
          action={list.data && <SourceNote source={list.data.source} collectedAt={list.data.collectedAt} />}
        />
        {list.isLoading ? (
          <CardsSkeleton />
        ) : candidates.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {candidates.map((c, i) => (
              <li key={c.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                <CandidateCard c={c} office={office} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<UsersThree className="h-7 w-7" />} title="Lista de candidatos ainda não disponível">
            <p>
              O TSE publica as candidaturas no servidor de resultados poucos dias antes da votação, e esta página passa
              a mostrá-las sozinha. Enquanto isso, a lista oficial pode ser consultada no DivulgaCandContas.
            </p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="https://divulgacandcontas.tse.jus.br/divulga/" external variant="ghost">
                Abrir DivulgaCandContas <ArrowSquareOut className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </div>
          </EmptyState>
        )}
      </section>
    </div>
  )
}

function SourceNote({ source, collectedAt }: { source: 'resultados' | 'divulgacand'; collectedAt?: string }) {
  return (
    <span className="text-right text-xs text-muted">
      {source === 'resultados'
        ? 'Fonte: TSE, divulgação de resultados'
        : `Fonte: TSE, DivulgaCandContas${collectedAt ? `, coletado em ${new Date(collectedAt).toLocaleDateString('pt-BR')}` : ''}`}
    </span>
  )
}

function UfSelect({ value, onChange }: { value: string; onChange: (sigla: string) => void }) {
  const id = useId()
  return (
    <div className="max-w-xs">
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

const TONE: Record<ReturnType<typeof statusTone>, string> = {
  ok: 'border-ok/40 text-ok',
  warn: 'border-accent text-ink-2 bg-accent/15',
  off: 'border-line text-muted',
  none: 'border-line text-muted',
}

function CandidateCard({ c, office }: { c: Candidate; office: Office }) {
  const color = partyColor(c.party)
  const tone = statusTone(c.status)
  const viceLabel = office.slug === 'senador' ? '1º suplente' : 'Vice'
  return (
    <article
      className={cn('flex h-full flex-col rounded-lg border border-line bg-surface p-5', tone === 'off' && 'opacity-60')}
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-4">
        <CandidatePhoto src={c.photo} name={c.name} color={color} size={64} />
        <div className="min-w-0 pt-1">
          <h3 className="leading-snug font-semibold">{c.name}</h3>
          <PartyChip party={c.party} className="mt-1.5" />
        </div>
        <span className="pt-0.5 text-3xl font-semibold tracking-tight tabular" aria-label={`Número ${c.number}`}>
          {c.number}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        {c.vice && (
          <p>
            <span className="text-muted">{viceLabel}: </span>
            {c.vice}
          </p>
        )}
        {c.coalition && c.coalition !== c.party && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">Coligação {c.coalition}</p>
        )}
      </div>

      {c.status && (
        <p className="mt-auto pt-4">
          <span className={cn('inline-block rounded-full border px-2 py-px text-xs font-medium', TONE[tone])}>
            {c.status}
          </span>
        </p>
      )}
    </article>
  )
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="mt-5 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}
