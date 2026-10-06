// Visão do Congresso Nacional e dos governos estaduais a partir da apuração oficial:
// Câmara (513 deputados eleitos, bancada a bancada), Senado (senadores eleitos no
// ciclo) e governadores (eleitos e estados com 2º turno). A correlação de forças agrupa os partidos pela
// aliança presidencial que registraram no TSE no 1º turno (lib/tse/alliances.ts).
import { Clock } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { Hemicycle } from '../components/proportional/Hemicycle'
import { CandidatePhoto, PartyChip } from '../components/results/Candidate'
import { Container, EmptyState, Segmented, SectionHeading, Skeleton } from '../components/ui'
import { findOffice, type Cycle, type ElectionIds, type Turn } from '../config/elections'
import { partyColor } from '../config/parties'
import { findUf, ofUf, UF_BY_IBGE, UFS } from '../config/ufs'
import { leaderColor } from '../lib/colors'
import { cn, fmtDateLong, fmtInt, fmtPct } from '../lib/format'
import { useFeaturedCycle } from '../lib/phase'
import { NONE_ID, OTHER_ID, useAlliances, type Alliances, type Bloc } from '../lib/tse/alliances'
import type { ResultSummary } from '../lib/tse/model'
import { proportionalQuery, type ProportionalData } from '../lib/tse/proportionalData'
import { useUfResults } from '../lib/tse/queries'

const CAMARA = 513
/** Estados em que o governo é decidido no 2º turno. */
const RUNOFF_ID = '2t'

/** Faixas em cinza: número em tinta escura, não em branco. */
const NEUTRAL = new Set([NONE_ID, OTHER_ID, RUNOFF_ID, '-'])

/** Governo decidido no 2º turno: 1º turno encerrado, sem eleito e com finalistas. */
const isRunoff = (r?: ResultSummary) => Boolean(r && !r.candidates[0]?.elected && r.candidates.some((c) => c.runoff))
const SENADO = 81
const GOVERNOS = 27

/** Quóruns da Câmara: maioria absoluta, três quintos (PEC) e dois terços. */
const CAMARA_QUORUNS = [
  { seats: 257, label: 'Maioria absoluta' },
  { seats: 308, label: '3/5, emenda constitucional' },
  { seats: 342, label: '2/3' },
]

/** Vagas de senador por UF: dois terços (2) e um terço (1) alternam a cada 4 anos. */
const senateSeatsPerUf = (year: number) => ((year - 2018) % 8 === 0 ? 2 : 1)

type Modo = 'partidos' | 'aliancas'

interface Seat {
  party: string
  uf: string
}

interface Group {
  id: string
  label: string
  color: string
  seats: number
  detail?: string
}

/** Agrupa cadeiras por partido (maior primeiro) ou por aliança (ordem fixa dos blocos). */
function groupSeats(seats: Seat[], modo: Modo, alliances?: Alliances | null): Group[] {
  if (modo === 'aliancas' && alliances) {
    const count = new Map<string, number>()
    for (const s of seats) {
      const b = alliances.blocOf(s.party)
      count.set(b.id, (count.get(b.id) ?? 0) + 1)
    }
    return alliances.blocs
      .filter((b) => count.get(b.id))
      .map((b) => ({ id: b.id, label: b.short, color: b.color, seats: count.get(b.id)!, detail: b.label }))
  }
  const count = new Map<string, number>()
  for (const s of seats) count.set(s.party, (count.get(s.party) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([party, n], i) => ({ id: party, label: party, color: partyColor(party, i), seats: n }))
}

/** Número que conta até o valor novo (sem animação para quem reduz movimento). */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || from.current === value) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const eased = 1 - (1 - k) ** 3
      setShown(Math.round(a + (value - a) * eased))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

function Count({ value, className }: { value: number; className?: string }) {
  const n = useCountUp(value)
  return <span className={cn('tabular', className)}>{fmtInt(n)}</span>
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
  return <Congress cycle={cycle} ids={ids} turn={turn} />
}

function Congress({ cycle, ids, turn }: { cycle: Cycle; ids?: ElectionIds; turn: Turn }) {
  const [modo, setModo] = useState<Modo>('aliancas')
  const alliances = useAlliances(cycle, ids, findOffice(cycle, 'presidente')).data

  // Câmara: as 27 bancadas, com a distribuição de vagas de cada UF.
  const depOffice = findOffice(cycle, 'deputado-federal')!
  const depResults = useQueries({ queries: UFS.map((uf) => proportionalQuery(cycle, ids, depOffice, uf.sigla)) })
  const delegations = UFS.map((uf, i) => ({ uf: uf.sigla, d: depResults[i].data ?? undefined }))
  const depLoaded = delegations.filter((x): x is { uf: string; d: ProportionalData } => Boolean(x.d))
  const deputies: Seat[] = depLoaded.flatMap(({ uf, d }) =>
    d.candidates.filter((c) => c.outcome === 'qp' || c.outcome === 'media').map((c) => ({ party: c.party, uf })),
  )
  const depOfficial = depLoaded.length === UFS.length && depLoaded.every(({ d }) => d.official)
  /** UFs cuja bancada ainda é projeção (TSE não declarou os eleitos ou sem dados). */
  const depPending = delegations.filter(({ d }) => !d?.official).map(({ uf }) => uf)

  // Senado: os eleitos de cada UF nas vagas renovadas no ciclo.
  const perUf = senateSeatsPerUf(cycle.year)
  const senTotal = perUf * UFS.length
  const sen = useUfResults({ cycle, ids, office: findOffice(cycle, 'senador')!, turn: 1 })
  const senators: (Seat & { name: string; elected: boolean; pct: number })[] = UFS.flatMap((uf) =>
    (sen.byUf[uf.sigla]?.candidates.slice(0, perUf) ?? []).map((c) => ({
      party: c.party,
      uf: uf.sigla,
      name: c.name,
      elected: c.elected,
      pct: c.pct,
    })),
  )
  const senFinal = UFS.every((uf) => sen.byUf[uf.sigla]?.final)

  // Governadores: só os eleitos contam para as forças; estados com 2º turno ficam à parte,
  // sem serem atribuídos a quem liderou o 1º turno.
  const govOffice = findOffice(cycle, 'governador')!
  const gov = useUfResults({ cycle, ids, office: govOffice, turn })
  // No 2º turno, antes do arquivo sair, o estado segue como "2º turno" pelo resultado do 1º.
  const gov1 = useUfResults({ cycle, ids, office: govOffice, turn: 1 })
  const govBy = Object.fromEntries(UFS.map((u) => [u.sigla, gov.byUf[u.sigla] ?? gov1.byUf[u.sigla]])) as Record<string, ResultSummary | undefined>
  const governors: Seat[] = UFS.flatMap((uf) => {
    const lead = govBy[uf.sigla]?.candidates[0]
    return lead?.elected ? [{ party: lead.party, uf: uf.sigla }] : []
  })
  const govRunoff = UFS.filter((uf) => isRunoff(govBy[uf.sigla])).length

  const nothing = !depLoaded.length && !sen.loaded && !gov.loaded && !gov1.loaded
  const loading = depResults.some((r) => r.isLoading) || sen.loading || gov.loading

  return (
    <div>
      <Container className="pt-10 sm:pt-14">
        <header className="max-w-3xl">
          <p className="text-sm text-muted">Eleições gerais de {cycle.year}</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            O Congresso eleito e os governadores
          </h1>
          <p className="mt-4 leading-relaxed text-ink-2">
            A correlação de forças que saiu das urnas: os deputados federais e senadores eleitos em {cycle.year} e os
            governadores, com os resultados oficiais do TSE.
          </p>
        </header>
      </Container>

      <div className="sticky top-16 z-20 mt-8 border-y border-line bg-page/92 backdrop-blur-md [@media(max-height:480px)]:static">
        <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
          <nav aria-label="Seções da página" className="-mx-1 flex gap-1 overflow-x-auto">
            {[
              ['forcas', 'Correlação de forças'],
              ['camara', 'Câmara'],
              ['senado', 'Senado'],
              ['governadores', 'Governadores'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-ink-2 transition hover:bg-surface-2 hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">Ver por</span>
            <Segmented<Modo>
              label="Agrupar cadeiras por"
              value={modo}
              onChange={setModo}
              options={[
                { value: 'aliancas', label: 'Alianças' },
                { value: 'partidos', label: 'Partidos' },
              ]}
            />
          </div>
        </Container>
      </div>

      <Container className="pb-10">
        {nothing ? (
          <div className="mt-12">{loading ? <Skeleton className="h-96 w-full" /> : <NoData />}</div>
        ) : (
          <div className="mt-12 space-y-24">
            <Forcas
              alliances={alliances}
              deputies={deputies}
              senators={senators}
              governors={governors}
              govRunoff={govRunoff}
              senTotal={senTotal}
              year={cycle.year}
              depOfficial={depOfficial}
              depPending={depPending}
            />
            <Camara
              modo={modo}
              alliances={alliances}
              delegations={delegations}
              deputies={deputies}
              official={depOfficial}
              pending={depPending}
            />
            <Senado
              modo={modo}
              alliances={alliances}
              senators={senators}
              total={senTotal}
              perUf={perUf}
              year={cycle.year}
              final={senFinal}
            />
            <Governadores modo={modo} alliances={alliances} cycle={cycle} turn={turn} byUf={govBy} governors={governors} />
          </div>
        )}
      </Container>
    </div>
  )
}

// ------------------------------------------------------------ correlação de forças

function Forcas({
  alliances,
  deputies,
  senators,
  governors,
  govRunoff,
  senTotal,
  year,
  depOfficial,
  depPending,
}: {
  alliances?: Alliances | null
  deputies: Seat[]
  senators: Seat[]
  governors: Seat[]
  govRunoff: number
  senTotal: number
  year: number
  depOfficial: boolean
  depPending: string[]
}) {
  if (!alliances) return null
  const count = (seats: Seat[]) => {
    const m = new Map<string, number>()
    for (const s of seats) {
      const id = alliances.blocOf(s.party).id
      m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }
  const dep = count(deputies)
  const sen = count(senators)
  const gov = count(governors)
  const seg = (m: Map<string, number>) =>
    alliances.blocs.map((b) => ({ id: b.id, label: b.short, color: b.color, value: m.get(b.id) ?? 0 }))

  return (
    <section aria-labelledby="forcas" className="scroll-mt-36">
      <SectionHeading id="forcas" title="Correlação de forças" />
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        Partidos agrupados pela aliança que registraram no TSE para a eleição presidencial do 1º turno: a coligação ou
        federação de cada candidatura. Quem não apoiou nenhuma candidatura a presidente fica em "Sem aliança". O apoio
        no 2º turno e a formação de base no Congresso podem ser diferentes.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {alliances.blocs.map((b) => (
          <BlocCard key={b.id} bloc={b} dep={dep.get(b.id) ?? 0} sen={sen.get(b.id) ?? 0} gov={gov.get(b.id) ?? 0} />
        ))}
      </div>

      <div className="mt-12 space-y-10">
        <ForceBar
          title={`Câmara dos Deputados, ${CAMARA} deputados eleitos`}
          caption={
            depOfficial
              ? 'Resultado oficial do TSE'
              : `Oficial em ${UFS.length - depPending.length} de ${UFS.length} estados; ${depPending.map((p) => findUf(p)!.nome).join(', ')} com totalização a concluir`
          }
          total={CAMARA}
          segments={seg(dep)}
          thresholds={CAMARA_QUORUNS}
        />
        <ForceBar
          title={`Senado Federal, ${senTotal} senadores eleitos em ${year}`}
          caption={`As outras ${SENADO - senTotal} cadeiras são dos senadores eleitos em ${year - 4}`}
          total={senTotal}
          segments={seg(sen)}
        />
        <ForceBar
          title="Governos estaduais"
          caption={govRunoff ? `${GOVERNOS - govRunoff} eleitos no 1º turno; ${govRunoff} a decidir no 2º turno` : 'Governadores eleitos'}
          total={GOVERNOS}
          segments={[...seg(gov), { id: RUNOFF_ID, label: '2º turno', color: 'var(--runoff)', value: govRunoff }]}
        />
      </div>
    </section>
  )
}

function BlocCard({ bloc, dep, sen, gov }: { bloc: Bloc; dep: number; sen: number; gov: number }) {
  return (
    <article
      className="fade-up flex flex-col rounded-lg border border-line bg-surface p-5"
      style={{ borderTop: `4px solid ${bloc.color}` }}
    >
      <h3 className="font-semibold">{bloc.label}</h3>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted">
        {bloc.parties.length ? bloc.parties.join(', ') : 'Partidos sem candidatura nem coligação para presidente'}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
        <div>
          <dt className="text-xs text-muted">Deputados</dt>
          <dd className="mt-0.5 text-2xl font-semibold">
            <Count value={dep} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Senadores</dt>
          <dd className="mt-0.5 text-2xl font-semibold">
            <Count value={sen} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Governos</dt>
          <dd className="mt-0.5 text-2xl font-semibold">
            <Count value={gov} />
          </dd>
        </div>
      </dl>
    </article>
  )
}

/** Barra empilhada por bloco, com marcas de quórum. */
function ForceBar({
  title,
  caption,
  total,
  segments,
  thresholds = [],
}: {
  title: string
  caption: string
  total: number
  segments: { id: string; label: string; color: string; value: number }[]
  thresholds?: { seats: number; label: string }[]
}) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(t)
  }, [])
  const used = segments.reduce((s, x) => s + x.value, 0)
  const parts = [...segments.filter((s) => s.value > 0), ...(used < total ? [{ id: '-', label: 'Sem dados', color: 'var(--color-map-empty)', value: total - used }] : [])]
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted">{caption}</span>
      </figcaption>
      <div className={cn('relative', thresholds.length > 0 && 'pb-9')}>
        <div className="flex h-9 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={`${title}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
          {parts.map((p) => {
            const w = (p.value / total) * 100
            return (
              <div
                key={p.id}
                title={`${p.label}: ${p.value}`}
                className={cn(
                  'flex items-center justify-center overflow-hidden text-xs font-semibold whitespace-nowrap transition-[flex-grow] duration-700 ease-out',
                  NEUTRAL.has(p.id) ? 'text-ink' : 'text-white',
                )}
                style={{ flexGrow: grown ? w : 0, flexBasis: 0, background: p.color }}
              >
                {w >= 7 && (
                  <span className={cn('px-1 tabular', !NEUTRAL.has(p.id) && 'drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]')}>{p.value}</span>
                )}
              </div>
            )
          })}
        </div>
        {thresholds.map((t) => (
          <div
            key={t.seats}
            className="pointer-events-none absolute top-[-4px] h-[calc(2.25rem+8px)] border-l-2 border-dashed border-ink/70"
            style={{ left: `${(t.seats / total) * 100}%` }}
          >
            <span className="absolute top-full mt-1 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ink-2 tabular">
              {t.seats}
            </span>
          </div>
        ))}
      </div>
      {thresholds.length > 0 && (
        <p className="-mt-3 mb-1 text-xs text-muted">
          Linhas tracejadas: {thresholds.map((t) => `${t.seats}, ${t.label.toLowerCase()}`).join('; ')}.
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.id} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.label}
            <strong className="font-semibold tabular">{p.value}</strong>
          </li>
        ))}
      </ul>
    </figure>
  )
}

// ------------------------------------------------------------------ Câmara

function Camara({
  modo,
  alliances,
  delegations,
  deputies,
  official,
  pending,
}: {
  modo: Modo
  alliances?: Alliances | null
  delegations: { uf: string; d?: ProportionalData }[]
  deputies: Seat[]
  official: boolean
  pending: string[]
}) {
  const [uf, setUf] = useState('BR')
  const one = uf === 'BR' ? undefined : delegations.find((x) => x.uf === uf)
  const seats = one ? deputies.filter((s) => s.uf === uf) : deputies
  const total = one ? (one.d?.seats ?? 0) : CAMARA
  const groups = useMemo(() => groupSeats(seats, modo, alliances), [seats, modo, alliances])
  const ufObj = one ? findUf(uf) : undefined

  return (
    <section aria-labelledby="camara" className="scroll-mt-36">
      <SectionHeading
        id="camara"
        title="Câmara dos Deputados"
        action={<UfFilter value={uf} onChange={setUf} />}
      />
      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted">
        {official
          ? `Os ${CAMARA} deputados federais eleitos, como declarados pelo TSE.`
          : pending.length < UFS.length
            ? `Os ${CAMARA} deputados federais eleitos. Eleitos declarados pelo TSE em ${UFS.length - pending.length} de ${UFS.length} estados; em ${pending.map((p) => findUf(p)!.nome).join(', ')}, o TSE ainda não publicou a totalização final, e as vagas de lá são calculadas pelas regras do Código Eleitoral com os votos apurados.`
            : 'Vagas calculadas pelas regras do Código Eleitoral com os votos apurados, até o TSE declarar os eleitos.'}
        {ufObj && ` Bancada ${ofUf(ufObj)}: ${total} deputados.`}
      </p>
      <Chamber
        key={uf}
        total={total}
        groups={groups}
        label={`Distribuição dos ${total} deputados eleitos ${ufObj ? `na bancada ${ofUf(ufObj)}` : 'para a Câmara dos Deputados'}`}
        caption="deputados"
        thresholds={ufObj ? [] : CAMARA_QUORUNS}
      />
    </section>
  )
}

function UfFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        Bancada
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 cursor-pointer rounded-md border border-line bg-surface px-3 text-base sm:text-sm"
      >
        <option value="BR">Brasil, 513</option>
        {UFS.map((u) => (
          <option key={u.sigla} value={u.sigla}>
            {u.nome}
          </option>
        ))}
      </select>
    </div>
  )
}

// ------------------------------------------------------------------ Senado

function Senado({
  modo,
  alliances,
  senators,
  total,
  perUf,
  year,
  final,
}: {
  modo: Modo
  alliances?: Alliances | null
  senators: (Seat & { name: string; elected: boolean; pct: number })[]
  total: number
  perUf: number
  year: number
  final: boolean
}) {
  const groups = useMemo(() => groupSeats(senators, modo, alliances), [senators, modo, alliances])
  const [hover, setHover] = useState<string>()
  const keyOf = (party: string) => (modo === 'aliancas' && alliances ? alliances.blocOf(party).id : party)
  return (
    <section aria-labelledby="senado" className="scroll-mt-36">
      <SectionHeading id="senado" title="Senado Federal" />
      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted">
        Os {total} senadores eleitos em {year}, {perUf === 2 ? 'dois' : 'um'} por estado, renovam{' '}
        {perUf === 2 ? 'dois terços' : 'um terço'} do Senado.{final ? '' : ' Totalização ainda não concluída em todos os estados.'}{' '}
        As outras {SENADO - total} cadeiras seguem com os senadores eleitos em {year - 4}, que não entram nesta conta.
      </p>
      <Chamber
        total={total}
        groups={groups}
        label={`Distribuição dos ${total} senadores eleitos em ${year}`}
        caption="eleitos"
        highlight={hover}
        onHighlight={setHover}
      />
      <ul className="mt-12 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {UFS.map((uf) => {
          const list = senators.filter((s) => s.uf === uf.sigla)
          const dim = hover !== undefined && !list.some((s) => keyOf(s.party) === hover)
          return (
            <li key={uf.sigla} className={cn('flex items-start gap-3 border-t border-line pt-3 transition-opacity', dim && 'opacity-30')}>
              <span className="w-8 shrink-0 pt-0.5 text-sm font-semibold text-muted">{uf.sigla}</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                {list.length ? (
                  list.map((s, i) => (
                    <p key={s.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groups.find((g) => g.id === keyOf(s.party))?.color ?? partyColor(s.party, i) }} aria-hidden />
                      <span className="truncate">{s.name}</span>
                      <span className="text-xs text-muted">{s.party}</span>
                      <span className="ml-auto text-xs text-ink-2 tabular">{s.elected ? 'Eleito' : fmtPct(s.pct)}</span>
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted">Sem dados ainda</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ------------------------------------------------------------------ Governadores

function Governadores({
  modo,
  alliances,
  cycle,
  turn,
  byUf,
  governors,
}: {
  modo: Modo
  alliances?: Alliances | null
  cycle: Cycle
  turn: Turn
  byUf: Record<string, ResultSummary | undefined>
  governors: Seat[]
}) {
  const navigate = useNavigate()
  const leaders = UFS.map((uf) => ({ uf, r: byUf[uf.sigla], lead: byUf[uf.sigla]?.candidates[0] }))
  const runoffUfs = leaders.filter(({ r }) => isRunoff(r))
  const groups = useMemo(() => {
    const g = groupSeats(governors, modo, alliances)
    return runoffUfs.length
      ? [...g, { id: RUNOFF_ID, label: '2º turno', color: 'var(--runoff)', seats: runoffUfs.length }]
      : g
  }, [governors, modo, alliances, runoffUfs.length])
  const [hover, setHover] = useState<string>()
  /** Grupo de um estado: o do eleito, ou "2º turno". */
  const groupOf = (r?: ResultSummary) => {
    const lead = r?.candidates[0]
    if (!lead) return undefined
    if (isRunoff(r)) return RUNOFF_ID
    return modo === 'aliancas' && alliances ? alliances.blocOf(lead.party).id : lead.party
  }
  const colorOf = (r?: ResultSummary) => {
    const lead = r?.candidates[0]
    if (!lead) return undefined
    if (isRunoff(r)) return 'var(--runoff)'
    if (!lead.elected) return undefined
    if (modo === 'aliancas' && alliances) return alliances.blocOf(lead.party).color
    return leaderColor(r)
  }
  const elected = governors.length
  const href = (sigla: string) => `/${cycle.year}/governador/${sigla.toLowerCase()}?turno=${turn}`

  return (
    <section aria-labelledby="governadores" className="scroll-mt-36">
      <SectionHeading id="governadores" title="Governadores" />
      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted">
        {elected} {elected === 1 ? 'governador eleito' : 'governadores eleitos'}
        {turn === 1 ? ' no 1º turno' : ''}.
        {runoffUfs.length > 0 &&
          ` Em ${runoffUfs.length} ${runoffUfs.length === 1 ? 'estado' : 'estados'} o governo é decidido no 2º turno, em ${fmtDateLong(cycle.dates[2])}, entre os dois mais votados.`}{' '}
        Toque num estado para ver o resultado.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <figure>
          <ChoroplethMap
            src="/geo/br-uf.json"
            label={`Mapa do Brasil com ${modo === 'aliancas' ? 'a aliança presidencial' : 'o partido'} do governador eleito em cada estado; em cinza, estados com 2º turno`}
            focus={hover ? leaders.filter(({ r }) => groupOf(r) === hover).map(({ uf }) => uf.ibge) : undefined}
            fill={(code) => colorOf(byUf[UF_BY_IBGE[code]?.sigla])}
            name={(code) => {
              const uf = UF_BY_IBGE[code]
              const r = byUf[uf.sigla]
              if (isRunoff(r)) {
                const [a, b] = r!.candidates
                return `${uf.nome}: 2º turno entre ${a.name} (${a.party}) e ${b.name} (${b.party})`
              }
              const lead = r?.candidates[0]
              return lead ? `${uf.nome}: ${lead.name} (${lead.party}) eleito com ${fmtPct(lead.pct)}` : uf.nome
            }}
            onSelect={(code) => navigate(href(UF_BY_IBGE[code].sigla))}
          />
          <figcaption className="mt-4">
            <Legend groups={groups} highlight={hover} onHighlight={setHover} unit={['estado', 'estados']} />
          </figcaption>
        </figure>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {leaders.map(({ uf, r, lead }) => (
            <li key={uf.sigla} className={cn('transition-opacity', hover && lead && groupOf(r) !== hover && 'opacity-30')}>
              <button
                type="button"
                onClick={() => navigate(href(uf.sigla))}
                className="grid w-full cursor-pointer grid-cols-[2rem_auto_1fr_auto] items-center gap-x-3 px-4 py-2.5 text-left transition hover:bg-surface-2"
              >
                <span className="text-sm font-semibold text-muted">{uf.sigla}</span>
                {isRunoff(r) ? (
                  <RunoffPair r={r!} />
                ) : lead ? (
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
    </section>
  )
}

function GovStatus({ r }: { r: ResultSummary }) {
  const lead = r.candidates[0]
  const [text, tone] = lead.elected ? ['Eleito', 'text-ok'] : r.final ? ['Resultado final', 'text-muted'] : ['Em apuração', 'text-muted']
  return <span className={cn('block text-xs font-medium', tone)}>{text}</span>
}

/** Estado com 2º turno: os dois finalistas, lado a lado, sem apontar vencedor. */
function RunoffPair({ r }: { r: ResultSummary }) {
  const finalists = r.candidates.filter((c) => c.runoff).slice(0, 2)
  return (
    <>
      <span className="flex -space-x-2">
        {finalists.map((c) => (
          <CandidatePhoto key={c.id} src={c.photo} name={c.name} color={partyColor(c.party)} size={32} />
        ))}
      </span>
      <span className="min-w-0 text-sm">
        {finalists.map((c, i) => (
          <span key={c.id} className="block truncate">
            <span className={cn(i === 0 && 'font-semibold')}>{c.name}</span>{' '}
            <span className="text-xs text-muted">
              {c.party} {fmtPct(c.pct)}
            </span>
          </span>
        ))}
      </span>
      <span className="text-right text-xs font-medium text-ink-2">2º turno</span>
    </>
  )
}

// ------------------------------------------------------------------ partes comuns

function NoData() {
  return (
    <EmptyState icon={<Clock className="h-7 w-7" />} title="Resultados ainda não divulgados">
      O TSE divulga a apuração a partir das 17h (Brasília) do dia da votação. Esta página se atualiza sozinha.
    </EmptyState>
  )
}

/** Hemiciclo + lista de grupos; passar o mouse (ou tocar) num grupo destaca as cadeiras dele. */
function Chamber({
  total,
  groups,
  label,
  thresholds = [],
  highlight: controlled,
  onHighlight,
  caption = 'cadeiras',
}: {
  total: number
  groups: Group[]
  label: string
  /** Legenda do número central (ex.: "eleitos"). */
  caption?: string
  thresholds?: { seats: number; label: string }[]
  highlight?: string
  onHighlight?: (id?: string) => void
}) {
  const [own, setOwn] = useState<string>()
  const highlight = onHighlight ? controlled : own
  const set = onHighlight ?? setOwn
  const allocated = groups.reduce((s, g) => s + g.seats, 0)
  const hemi = [
    ...groups,
    ...(allocated < total ? [{ id: '-', label: 'Sem dados', color: 'var(--color-line)', seats: total - allocated }] : []),
  ]
  const focused = groups.find((g) => g.id === highlight)
  const max = Math.max(1, ...groups.map((g) => g.seats))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
      <figure>
        <Hemicycle
          animate
          total={total}
          groups={hemi}
          label={label}
          highlight={highlight}
          center={focused ? { value: String(focused.seats), caption: focused.label } : { value: String(total), caption }}
        />
        {thresholds.length > 0 && (
          <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
            {thresholds.map((t) => {
              const reach = groups.filter((g) => g.seats >= t.seats)
              return (
                <li key={t.seats}>
                  <strong className="font-semibold text-ink-2 tabular">{t.seats}</strong> {t.label}
                  {reach.length ? `: alcançado por ${reach.map((g) => g.label).join(', ')}` : ': nenhum grupo alcança sozinho'}
                </li>
              )
            })}
          </ul>
        )}
        {allocated < total && (
          <p className="mt-2 text-center text-sm text-muted">{fmtInt(total - allocated)} cadeiras sem dados do TSE.</p>
        )}
      </figure>
      <ol className="space-y-1" aria-label="Cadeiras por grupo" onMouseLeave={() => set(undefined)}>
        {groups.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onMouseEnter={() => set(g.id)}
              onFocus={() => set(g.id)}
              onBlur={() => set(undefined)}
              onClick={() => set(highlight === g.id ? undefined : g.id)}
              aria-pressed={highlight === g.id}
              title={g.detail}
              className={cn(
                'grid w-full cursor-pointer grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition',
                highlight === g.id ? 'bg-surface-2' : 'hover:bg-surface-2',
                highlight && highlight !== g.id && 'opacity-45',
              )}
            >
              <span className="truncate font-medium">{g.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span
                  className="block h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${(g.seats / max) * 100}%`, background: g.color }}
                />
              </span>
              <Count value={g.seats} className="text-right font-semibold" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Legend({
  groups,
  highlight,
  onHighlight,
  unit,
}: {
  groups: Group[]
  highlight?: string
  onHighlight: (id?: string) => void
  unit: [string, string]
}) {
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm" onMouseLeave={() => onHighlight(undefined)}>
      {groups.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            onMouseEnter={() => onHighlight(g.id)}
            onFocus={() => onHighlight(g.id)}
            onBlur={() => onHighlight(undefined)}
            onClick={() => onHighlight(highlight === g.id ? undefined : g.id)}
            aria-pressed={highlight === g.id}
            className={cn(
              'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 transition hover:bg-surface-2',
              highlight && highlight !== g.id && 'opacity-45',
            )}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: g.color }} aria-hidden />
            <span>{g.label}</span>
            <strong className="font-semibold tabular">{g.seats}</strong>
            <span className="sr-only">{g.seats === 1 ? unit[0] : unit[1]}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
