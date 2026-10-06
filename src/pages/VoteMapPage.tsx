// Mapa de votos de um deputado: escolhe-se o cargo, o estado e o candidato, e o mapa
// mostra onde ele foi votado, município a município, com os números oficiais do TSE.
import { Clock, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useId, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { OutcomeBadge } from '../components/proportional/ProportionalExplorer'
import { CandidatePhoto, PartyChip } from '../components/results/Candidate'
import { Container, EmptyState, Segmented, Skeleton } from '../components/ui'
import { findOffice } from '../config/elections'
import { partyColor } from '../config/parties'
import { findUf, ofUf, UFS } from '../config/ufs'
import { cn, fmtInt, fmtPct, fmtUpdated } from '../lib/format'
import { useFeaturedCycle } from '../lib/phase'
import {
  proportionalName,
  useMunicipalVotes,
  useProportional,
  type PropCandidate,
} from '../lib/tse/proportionalData'
import { useMunicipalities, type Municipality } from '../lib/tse/queries'

type Cargo = 'deputado-federal' | 'deputado-estadual'
type Medida = 'pct' | 'votos'

interface CityVotes {
  mun: Municipality
  votes: number
  /** % dos votos válidos do município para o cargo. */
  pct: number
  /** % do total de votos do candidato que veio do município. */
  share: number
}

const CLASSES = 5

/** Limites de 5 faixas por quantis dos municípios com voto, arredondados e sem repetição. */
function breaks(values: number[], medida: Medida): number[] {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (!sorted.length) return []
  const round = (v: number) => {
    if (medida === 'pct') return v < 1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10
    const mag = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1)
    return Math.max(1, Math.round(v / mag) * mag)
  }
  const out: number[] = []
  for (let k = 1; k < CLASSES; k++) {
    const b = round(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * k) / CLASSES))])
    if (!out.length || b > out[out.length - 1]) out.push(b)
  }
  return out
}

/** Faixa 1..5 do valor (0 = sem voto). */
function classOf(v: number, bs: number[]) {
  if (v <= 0) return 0
  let i = 0
  while (i < bs.length && v >= bs[i]) i++
  return i + 1 + (CLASSES - 1 - bs.length)
}

const fmtMedida = (v: number, m: Medida) => (m === 'pct' ? fmtPct(v) : fmtInt(Math.round(v)))

export function VoteMapPage() {
  const { cycle, ids } = useFeaturedCycle()
  const [params, setParams] = useSearchParams()
  const cargo: Cargo = params.get('cargo') === 'deputado-estadual' ? 'deputado-estadual' : 'deputado-federal'
  const uf = findUf(params.get('uf') ?? '') ?? findUf('SP')!
  const medida: Medida = params.get('medida') === 'votos' ? 'votos' : 'pct'
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const office = findOffice(cycle, cargo)
  if (!office) {
    return (
      <Container className="py-16">
        <EmptyState title="Sem eleição para deputados neste ano">
          Deputados federais e estaduais são eleitos nas eleições gerais.
        </EmptyState>
      </Container>
    )
  }

  return (
    <Container className="py-10 sm:py-14">
      <header className="max-w-3xl">
        <p className="text-sm text-muted">Eleições gerais de {cycle.year}</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Mapa de votos</h1>
        <p className="mt-4 leading-relaxed text-ink-2">
          Escolha um deputado e veja onde ele foi votado, município a município, com os números oficiais da apuração do
          TSE.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-end gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Cargo</p>
          <Segmented<Cargo>
            label="Cargo"
            value={cargo}
            onChange={(v) => set({ cargo: v, n: undefined })}
            options={[
              { value: 'deputado-federal', label: 'Deputado federal' },
              { value: 'deputado-estadual', label: uf.sigla === 'DF' ? 'Deputado distrital' : 'Deputado estadual' },
            ]}
          />
        </div>
        <UfSelect value={uf.sigla} onChange={(s) => set({ uf: s.toLowerCase(), n: undefined })} />
      </div>

      <VoteMap
        key={`${cargo}-${uf.sigla}`}
        cycle={cycle}
        ids={ids}
        office={office}
        uf={uf.sigla}
        number={params.get('n') ?? undefined}
        onNumber={(n) => set({ n })}
        medida={medida}
        onMedida={(m) => set({ medida: m === 'pct' ? undefined : m })}
      />
    </Container>
  )
}

function VoteMap({
  cycle,
  ids,
  office,
  uf: sigla,
  number,
  onNumber,
  medida,
  onMedida,
}: {
  cycle: ReturnType<typeof useFeaturedCycle>['cycle']
  ids: ReturnType<typeof useFeaturedCycle>['ids']
  office: NonNullable<ReturnType<typeof findOffice>>
  uf: string
  number?: string
  onNumber: (n: string) => void
  medida: Medida
  onMedida: (m: Medida) => void
}) {
  const uf = findUf(sigla)!
  const prop = useProportional(cycle, ids, office, sigla)
  const votes = useMunicipalVotes(cycle, ids, office, sigla)
  const muns = useMunicipalities(sigla)
  const cand = prop.data?.candidates.find((c) => c.number === number) ?? prop.data?.candidates[0]
  const role = proportionalName(office, sigla)

  const cities = useMemo<CityVotes[]>(() => {
    if (!cand || !votes.data || !muns.data) return []
    const n = Number(cand.number)
    const out: CityVotes[] = []
    let total = 0
    for (const mun of muns.data) {
      const row = votes.data.mun[mun.tse]
      if (!row) continue
      let v = 0
      for (let i = 2; i < row.length; i += 2) {
        if (row[i] === n) {
          v = row[i + 1]
          break
        }
      }
      total += v
      out.push({ mun, votes: v, pct: row[0] ? (v / row[0]) * 100 : 0, share: 0 })
    }
    for (const c of out) c.share = total ? (c.votes / total) * 100 : 0
    return out.sort((a, b) => b.votes - a.votes)
  }, [cand, votes.data, muns.data])

  const byIbge = useMemo(() => Object.fromEntries(cities.map((c) => [c.mun.ibge, c])), [cities])
  const value = (c: CityVotes) => (medida === 'pct' ? c.pct : c.votes)
  const bs = useMemo(() => breaks(cities.map(value), medida), [cities, medida]) // eslint-disable-line react-hooks/exhaustive-deps

  if (prop.isLoading || votes.isLoading) return <Skeleton className="mt-10 h-[32rem] w-full" />
  if (!prop.data || !votes.data || !cand) {
    return (
      <div className="mt-10">
        <EmptyState icon={<Clock className="h-7 w-7" />} title="Votos por município ainda não divulgados">
          O TSE divulga a apuração a partir das 17h (Brasília) do dia da votação. Esta página se atualiza sozinha.
        </EmptyState>
      </div>
    )
  }

  const withVotes = cities.filter((c) => c.votes > 0)
  const totalVotes = withVotes.reduce((s, c) => s + c.votes, 0)

  return (
    <div className="mt-8 space-y-10">
      <CandidatePicker candidates={prop.data.candidates} selected={cand} onSelect={(c) => onNumber(c.number)} role={role} />

      <section
        aria-label={`Resumo de ${cand.name}`}
        className="grid gap-6 rounded-lg border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:p-6"
      >
        <CandidatePhoto src={cand.photo} name={cand.name} color={partyColor(cand.party)} size={84} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">{cand.name}</h2>
            <PartyChip party={cand.party} />
            <OutcomeBadge outcome={cand.outcome} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {role} {ofUf(uf)}, número {cand.number}
            {!prop.data.official && !prop.data.final && ' · situação projetada pela apuração parcial'}
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
            <Fig label="Votos" value={fmtInt(cand.votes)} />
            <Fig label="Dos votos válidos" value={fmtPct(cand.pct)} />
            <Fig label="Municípios com voto" value={`${fmtInt(withVotes.length)} de ${fmtInt(cities.length)}`} />
            {withVotes[0] && (
              <Fig label="Onde mais votou" value={`${withVotes[0].mun.nome} (${fmtPct(withVotes[0].share)})`} />
            )}
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <figure>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented<Medida>
              label="Medida do mapa"
              value={medida}
              onChange={onMedida}
              options={[
                { value: 'pct', label: '% no município' },
                { value: 'votos', label: 'Votos' },
              ]}
            />
            <span className="text-xs text-muted tabular">Atualizado em {fmtUpdated(votes.data.updatedAt)}</span>
          </div>
          <ChoroplethMap
            src={`/geo/uf/${sigla.toLowerCase()}.json`}
            label={`Mapa ${ofUf(uf)} com os votos de ${cand.name} em cada município`}
            fill={(code) => {
              const c = byIbge[code]
              if (!c) return undefined
              const k = classOf(value(c), bs)
              return k ? `var(--seq-${k})` : undefined
            }}
            name={(code) => {
              const c = byIbge[code]
              return c ? `${c.mun.nome}: ${fmtInt(c.votes)} votos, ${fmtPct(c.pct)} dos votos válidos` : code
            }}
            tooltip={(code) => {
              const c = byIbge[code]
              if (!c) return null
              return (
                <div className="min-w-44">
                  <p className="mb-1.5 font-semibold">{c.mun.nome}</p>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-sm">
                    <dt className="text-muted">Votos</dt>
                    <dd className="text-right font-semibold tabular">{fmtInt(c.votes)}</dd>
                    <dt className="text-muted">No município</dt>
                    <dd className="text-right tabular">{fmtPct(c.pct)}</dd>
                    <dt className="text-muted">Do total dele</dt>
                    <dd className="text-right tabular">{fmtPct(c.share)}</dd>
                  </dl>
                </div>
              )
            }}
          />
          <figcaption className="mt-4">
            <Legend bs={bs} medida={medida} />
          </figcaption>
        </figure>

        <CityTable cities={withVotes} total={totalVotes} name={cand.name} />
      </div>
    </div>
  )
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-semibold tabular">{value}</dd>
    </div>
  )
}

function Legend({ bs, medida }: { bs: number[]; medida: Medida }) {
  if (!bs.length) return null
  const first = CLASSES - bs.length
  const items = [...bs.map((_, i) => i), bs.length].map((i) => {
    const lo = i === 0 ? undefined : bs[i - 1]
    const hi = bs[i]
    const text =
      lo === undefined ? `até ${fmtMedida(hi, medida)}` : hi === undefined ? `${fmtMedida(lo, medida)} ou mais` : `${fmtMedida(lo, medida)} a ${fmtMedida(hi, medida)}`
    return { k: first + i, text }
  })
  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        {medida === 'pct' ? 'Votos do candidato em % dos votos válidos do município' : 'Votos do candidato no município'}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <li className="inline-flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm bg-[var(--color-map-empty)]" aria-hidden />
          Sem voto
        </li>
        {items.map((it) => (
          <li key={it.k} className="inline-flex items-center gap-2 tabular">
            <span className="h-3 w-5 rounded-sm" style={{ background: `var(--seq-${it.k})` }} aria-hidden />
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CityTable({ cities, total, name }: { cities: CityVotes[]; total: number; name: string }) {
  const [all, setAll] = useState(false)
  const rows = all ? cities : cities.slice(0, 15)
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="mb-3 text-left font-semibold">Municípios onde {name} teve mais votos</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-2 font-medium">Município</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">Votos</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">No município</th>
            <th scope="col" className="py-2 text-right font-medium">Do total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.mun.tse} className="border-b border-line/70">
              <th scope="row" className="py-2 pr-2 text-left font-medium">{c.mun.nome}</th>
              <td className="py-2 pr-2 text-right tabular">{fmtInt(c.votes)}</td>
              <td className="py-2 pr-2 text-right tabular text-ink-2">{fmtPct(c.pct)}</td>
              <td className="py-2 text-right tabular text-ink-2">{fmtPct(c.share)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs text-muted">
            <td className="pt-2">{fmtInt(cities.length)} municípios</td>
            <td className="pt-2 text-right tabular">{fmtInt(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      {cities.length > 15 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-4 min-h-11 cursor-pointer text-sm font-semibold text-ink hover:underline"
        >
          {all ? 'Mostrar só os 15 primeiros' : `Ver todos os ${fmtInt(cities.length)} municípios`}
        </button>
      )}
    </div>
  )
}

/** Busca por nome, número ou partido; lista os mais votados enquanto nada é digitado. */
function CandidatePicker({
  candidates,
  selected,
  onSelect,
  role,
}: {
  candidates: PropCandidate[]
  selected: PropCandidate
  onSelect: (c: PropCandidate) => void
  role: string
}) {
  const id = useId()
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const nq = norm(q.trim())
  const matches = nq
    ? candidates.filter((c) => norm(c.name).includes(nq) || c.number.startsWith(nq) || norm(c.party).includes(nq)).slice(0, 8)
    : candidates.slice(0, 8)

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {role}: busque por nome, número ou partido
      </label>
      <div className="relative max-w-xl">
        <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex.: Silva, 1234 ou PT"
          autoComplete="off"
          className="min-h-12 w-full rounded-md border border-line bg-surface pr-11 pl-10 text-base"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:text-ink"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">{nq ? `${matches.length ? 'Resultados' : 'Nenhum candidato encontrado'}` : 'Mais votados'}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {matches.map((c) => {
          const active = c.number === selected.number
          return (
            <li key={c.number}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c)
                  setQ('')
                }}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition',
                  active ? 'border-ink bg-ink text-page' : 'border-line bg-surface hover:border-ink/40',
                )}
              >
                <span className="font-medium">{c.name}</span>
                <span className={cn('text-xs', active ? 'text-page/75' : 'text-muted')}>
                  {c.party} {c.number}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
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
