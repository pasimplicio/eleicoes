// Visão do Congresso Nacional e dos governos estaduais a partir da apuração oficial:
// Câmara (513 cadeiras, soma da distribuição de vagas de cada UF), Senado (vagas em
// disputa no ciclo) e governadores (quem lidera, venceu ou vai ao 2º turno em cada UF).
import { Clock } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { Hemicycle } from '../components/proportional/Hemicycle'
import { CandidatePhoto, PartyChip } from '../components/results/Candidate'
import { Container, EmptyState, SectionHeading, Skeleton } from '../components/ui'
import { findOffice, type Cycle, type ElectionIds, type Turn } from '../config/elections'
import { partyColor } from '../config/parties'
import { UF_BY_IBGE, UFS } from '../config/ufs'
import { leaderColor } from '../lib/colors'
import { cn, fmtInt, fmtPct } from '../lib/format'
import { useFeaturedCycle } from '../lib/phase'
import type { ResultSummary } from '../lib/tse/model'
import { proportionalQuery, type ProportionalData } from '../lib/tse/proportionalData'
import { useUfResults } from '../lib/tse/queries'

const CAMARA = 513

/** Vagas de senador por UF: dois terços (2) e um terço (1) alternam a cada 4 anos. */
const senateSeatsPerUf = (year: number) => ((year - 2018) % 8 === 0 ? 2 : 1)

interface PartySeats {
  party: string
  seats: number
  color: string
}

function tally(parties: string[]): PartySeats[] {
  const count = new Map<string, number>()
  for (const p of parties) count.set(p, (count.get(p) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([party, seats], i) => ({ party, seats, color: partyColor(party, i) }))
}

export function CongressPage() {
  const { cycle, ids, turn } = useFeaturedCycle()

  if (cycle.kind !== 'geral') {
    return (
      <Container className="py-16">
        <EmptyState title="Sem eleição para o Congresso neste ano">
          Deputados federais, senadores e governadores são eleitos nas eleições gerais.
        </EmptyState>
      </Container>
    )
  }

  return (
    <Container className="py-10 sm:py-14">
      <header className="max-w-3xl">
        <p className="text-sm text-muted">Eleições gerais de {cycle.year}</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Congresso Nacional e governadores
        </h1>
        <p className="mt-4 leading-relaxed text-ink-2">
          Como ficam a Câmara dos Deputados, as vagas do Senado em disputa e os governos estaduais, com os números
          oficiais da apuração do TSE. Atualiza sozinho.
        </p>
      </header>

      <div className="mt-14 space-y-20">
        <Camara cycle={cycle} ids={ids} />
        <Senado cycle={cycle} ids={ids} />
        <Governadores cycle={cycle} ids={ids} turn={turn} />
      </div>
    </Container>
  )
}

// ------------------------------------------------------------------ Câmara

function Camara({ cycle, ids }: { cycle: Cycle; ids?: ElectionIds }) {
  const office = findOffice(cycle, 'deputado-federal')!
  const results = useQueries({
    queries: UFS.map((uf) => proportionalQuery(cycle, ids, office, uf.sigla)),
  })
  const loaded = results.map((r) => r.data).filter((d): d is ProportionalData => Boolean(d))
  const loading = results.some((r) => r.isLoading)

  const elected = loaded.flatMap((d) => d.candidates.filter((c) => c.outcome === 'qp' || c.outcome === 'media'))
  const parties = tally(elected.map((c) => c.party))
  const allocated = elected.length
  const official = loaded.length === UFS.length && loaded.every((d) => d.official)

  return (
    <section aria-labelledby="camara">
      <SectionHeading id="camara" title="Câmara dos Deputados" />
      {!loaded.length ? (
        loading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <NoData />
        )
      ) : (
        <>
          <Status
            text={
              official
                ? 'Resultado oficial: vagas declaradas pelo TSE em todos os estados.'
                : `Projeção pelas regras do Código Eleitoral com a apuração parcial de ${loaded.length} de ${UFS.length} estados. Muda a cada atualização até o TSE declarar os eleitos.`
            }
          />
          <Chamber
            total={CAMARA}
            parties={parties}
            label={`Distribuição das ${CAMARA} cadeiras da Câmara dos Deputados por partido`}
            footnote={
              allocated < CAMARA
                ? `${fmtInt(CAMARA - allocated)} cadeiras dependem de estados ainda sem dados.`
                : undefined
            }
          />
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ Senado

function Senado({ cycle, ids }: { cycle: Cycle; ids?: ElectionIds }) {
  const office = findOffice(cycle, 'senador')!
  const perUf = senateSeatsPerUf(cycle.year)
  const total = perUf * UFS.length
  const { byUf, loaded, loading } = useUfResults({ cycle, ids, office, turn: 1 })

  const rows = UFS.map((uf) => ({ uf, r: byUf[uf.sigla] }))
  const winners = rows.flatMap(({ r }) => r?.candidates.slice(0, perUf) ?? [])
  const parties = tally(winners.map((c) => c.party))
  const allFinal = rows.every(({ r }) => r?.final)

  return (
    <section aria-labelledby="senado">
      <SectionHeading id="senado" title="Senado Federal" />
      {!loaded ? (
        loading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <NoData />
        )
      ) : (
        <>
          <Status
            text={`${total} das 81 cadeiras estão em disputa em ${cycle.year}, ${perUf === 2 ? 'duas' : 'uma'} por estado. ${
              allFinal ? 'Resultado oficial.' : 'Os mais votados em cada estado até agora; muda a cada atualização.'
            } As outras ${81 - total} cadeiras seguem com os senadores eleitos em ${cycle.year - 4}.`}
          />
          <Chamber
            total={total}
            parties={parties}
            label={`Distribuição das ${total} vagas de senador em disputa por partido`}
            footnote={winners.length < total ? `${total - winners.length} vagas dependem de estados ainda sem dados.` : undefined}
          />
          <ul className="mt-10 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ uf, r }) => (
              <li key={uf.sigla} className="flex items-start gap-3 border-t border-line pt-3">
                <span className="w-8 shrink-0 pt-0.5 text-sm font-semibold text-muted">{uf.sigla}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {r ? (
                    r.candidates.slice(0, perUf).map((c, i) => (
                      <p key={c.id} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: partyColor(c.party, i) }} aria-hidden />
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-muted">{c.party}</span>
                        <span className="ml-auto text-xs tabular text-ink-2">{c.elected ? 'Eleito' : fmtPct(c.pct)}</span>
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-muted">Sem dados ainda</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ Governadores

function Governadores({ cycle, ids, turn }: { cycle: Cycle; ids?: ElectionIds; turn: Turn }) {
  const navigate = useNavigate()
  const office = findOffice(cycle, 'governador')!
  const { byUf, loaded, loading } = useUfResults({ cycle, ids, office, turn })
  const leaders = UFS.map((uf) => ({ uf, r: byUf[uf.sigla], lead: byUf[uf.sigla]?.candidates[0] }))
  const parties = tally(leaders.flatMap(({ lead }) => (lead ? [lead.party] : [])))
  const elected = leaders.filter(({ lead }) => lead?.elected).length
  const runoff = leaders.filter(({ r }) => r && r.turn === 1 && r.final && r.candidates.some((c) => c.runoff)).length

  return (
    <section aria-labelledby="governadores">
      <SectionHeading id="governadores" title="Governadores" />
      {!loaded ? (
        loading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <NoData />
        )
      ) : (
        <>
          <Status
            text={`${elected} ${elected === 1 ? 'governador eleito' : 'governadores eleitos'}${
              runoff ? `, ${runoff} ${runoff === 1 ? 'estado vai' : 'estados vão'} ao 2º turno` : ''
            }. Nos demais, quem está à frente na apuração.`}
          />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
            <figure>
              <ChoroplethMap
                src="/geo/br-uf.json"
                label="Mapa do Brasil com o partido à frente na disputa para governador em cada estado"
                fill={(code) => leaderColor(byUf[UF_BY_IBGE[code]?.sigla])}
                name={(code) => {
                  const uf = UF_BY_IBGE[code]
                  const lead = byUf[uf.sigla]?.candidates[0]
                  return lead ? `${uf.nome}: ${lead.name} (${lead.party}) com ${fmtPct(lead.pct)}` : uf.nome
                }}
                onSelect={(code) => navigate(`/${cycle.year}/governador/${UF_BY_IBGE[code].sigla.toLowerCase()}?turno=${turn}`)}
              />
              <figcaption className="mt-4">
                <PartyList parties={parties} unit={['estado', 'estados']} />
              </figcaption>
            </figure>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {leaders.map(({ uf, r, lead }) => (
                <li key={uf.sigla}>
                  <button
                    type="button"
                    onClick={() => navigate(`/${cycle.year}/governador/${uf.sigla.toLowerCase()}?turno=${turn}`)}
                    className="grid w-full cursor-pointer grid-cols-[2rem_auto_1fr_auto] items-center gap-x-3 px-4 py-2.5 text-left transition hover:bg-surface-2"
                  >
                    <span className="text-sm font-semibold text-muted">{uf.sigla}</span>
                    {lead ? (
                      <>
                        <CandidatePhoto src={lead.photo} name={lead.name} color={partyColor(lead.party)} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{lead.name}</span>
                          <PartyChip party={lead.party} className="mt-0.5" />
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold tabular">{fmtPct(lead.pct)}</span>
                          <GovStatus r={r!} />
                        </span>
                      </>
                    ) : (
                      <span className="col-span-3 text-sm text-muted">Sem dados ainda</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

function GovStatus({ r }: { r: ResultSummary }) {
  const lead = r.candidates[0]
  const [text, tone] = lead.elected
    ? ['Eleito', 'text-ok']
    : r.final && r.candidates.some((c) => c.runoff)
      ? ['2º turno', 'text-ink-2']
      : ['À frente', 'text-muted']
  return <span className={cn('block text-xs font-medium', tone)}>{text}</span>
}

// ------------------------------------------------------------------ partes comuns

function Status({ text }: { text: string }) {
  return <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted">{text}</p>
}

function NoData() {
  return (
    <EmptyState icon={<Clock className="h-7 w-7" />} title="Resultados ainda não divulgados">
      O TSE divulga a apuração a partir das 17h (Brasília) do dia da votação. Esta página se atualiza sozinha.
    </EmptyState>
  )
}

function Chamber({
  total,
  parties,
  label,
  footnote,
}: {
  total: number
  parties: PartySeats[]
  label: string
  footnote?: string
}) {
  const allocated = parties.reduce((s, p) => s + p.seats, 0)
  const groups = [
    ...parties.map((p) => ({ id: p.party, label: p.party, color: p.color, seats: p.seats })),
    ...(allocated < total ? [{ id: '-', label: 'Sem dados', color: 'var(--color-line)', seats: total - allocated }] : []),
  ]
  const max = Math.max(1, ...parties.map((p) => p.seats))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
      <figure>
        <Hemicycle total={total} groups={groups} label={label} />
        {footnote && <p className="mt-2 text-center text-sm text-muted">{footnote}</p>}
      </figure>
      <ol className="space-y-2" aria-label="Cadeiras por partido">
        {parties.map((p) => (
          <li key={p.party} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate font-medium" title={p.party}>
              {p.party}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${(p.seats / max) * 100}%`, background: p.color }} />
            </span>
            <strong className="text-right font-semibold tabular">{p.seats}</strong>
          </li>
        ))}
      </ol>
    </div>
  )
}

function PartyList({ parties, unit }: { parties: PartySeats[]; unit: [string, string] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {parties.map((p) => (
        <li key={p.party} className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden />
          <span>{p.party}</span>
          <strong className="font-semibold tabular">{p.seats}</strong>
          <span className="sr-only">{p.seats === 1 ? unit[0] : unit[1]}</span>
        </li>
      ))}
    </ul>
  )
}
