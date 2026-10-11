// Gráfico de linhas da evolução da apuração: o percentual de cada candidato ao longo da noite,
// na cor do partido. Passar o dedo ou o mouse mostra os números daquele horário.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Cycle, ElectionIds, Office, Turn } from '../../config/elections'
import { partyColor } from '../../config/parties'
import { cn, fmtPct } from '../../lib/format'
import { useEvolution, type EvolutionSeries } from '../../lib/tse/evolution'
import type { ResultSummary } from '../../lib/tse/model'

const H = 240
const M = { top: 12, right: 56, bottom: 26, left: 40 }

const hour = (ms: number) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(ms)
const hourShort = (ms: number) => `${hour(ms).slice(0, 2).replace(/^0/, '')}h`
const pct1 = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Passos "redondos" para o eixo de %: 1, 2, 5 ou 10 pontos. */
function yTicks(min: number, max: number) {
  const span = max - min
  const step = [1, 2, 5, 10, 20].find((s) => span / s <= 5) ?? 25
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v)
  return { lo, hi, ticks }
}

function Chart({ series, turn }: { series: EvolutionSeries; turn: Turn }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const { times, lines } = series
  const t0 = times[0]
  const t1 = times[times.length - 1]

  const geo = useMemo(() => {
    const all = lines.flatMap((l) => l.pct)
    let min = Math.min(...all)
    let max = Math.max(...all)
    if (turn === 2) {
      min = Math.min(min, 50)
      max = Math.max(max, 50)
    }
    const { lo, hi, ticks } = yTicks(Math.max(0, min - 1), Math.min(100, max + 1))
    const iw = Math.max(1, width - M.left - M.right)
    const ih = H - M.top - M.bottom
    const x = (t: number) => M.left + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * iw)
    const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo || 1)) * ih
    // Marcas de hora: de 1 em 1, ou mais espaçadas se a noite for longa ou a tela estreita.
    const hours = (t1 - t0) / 3_600_000
    const every = [1, 2, 3, 6, 12, 24].find((h) => hours / h <= Math.max(2, iw / 70)) ?? 24
    const xt: number[] = []
    const first = Math.ceil(t0 / 3_600_000) * 3_600_000
    for (let t = first; t <= t1; t += 3_600_000) {
      const h = Number(hourShort(t).replace('h', ''))
      if (h % every === 0) xt.push(t)
    }
    return { x, y, ticks, xt, lo, hi }
  }, [lines, width, t0, t1, turn])

  // Rótulos no fim das linhas, afastados se ficarem colados.
  const ends = useMemo(() => {
    const items = lines
      .map((l) => ({ l, y: geo.y(l.pct[l.pct.length - 1]) }))
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 14) items[i].y = items[i - 1].y + 14
    }
    return items
  }, [lines, geo])

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    let best = 0
    for (let i = 0; i < times.length; i++) {
      if (Math.abs(geo.x(times[i]) - px) < Math.abs(geo.x(times[best]) - px)) best = i
    }
    setHover(best)
  }

  const color = (l: (typeof lines)[number]) => ({ '--c': partyColor(l.party, l.index) }) as CSSProperties
  const hx = hover === null ? 0 : geo.x(times[hover])

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          className="block touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          aria-hidden
        >
          {geo.ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} className="stroke-line" strokeWidth={1} />
              <text x={M.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                {v}%
              </text>
            </g>
          ))}
          {turn === 2 && geo.lo < 50 && geo.hi > 50 && (
            <line
              x1={M.left}
              x2={width - M.right}
              y1={geo.y(50)}
              y2={geo.y(50)}
              className="stroke-ink-2"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          {geo.xt.map((t) => (
            <text key={t} x={geo.x(t)} y={H - 6} textAnchor="middle" className="fill-muted text-[11px] tabular">
              {hourShort(t)}
            </text>
          ))}

          {lines.map((l) => (
            <path
              key={l.number}
              d={l.pct.map((v, i) => `${i ? 'L' : 'M'}${geo.x(times[i]).toFixed(1)},${geo.y(v).toFixed(1)}`).join('')}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="evo-stroke"
              style={color(l)}
            />
          ))}

          {ends.map(({ l, y }) => (
            <text key={l.number} x={width - M.right + 6} y={y} dy="0.32em" className="fill-ink text-[12px] font-semibold tabular">
              {pct1(l.pct[l.pct.length - 1])}
            </text>
          ))}

          {hover !== null && (
            <g>
              <line x1={hx} x2={hx} y1={M.top} y2={H - M.bottom} className="stroke-ink-2" strokeWidth={1} />
              {lines.map((l) => (
                <circle
                  key={l.number}
                  cx={hx}
                  cy={geo.y(l.pct[hover])}
                  r={4}
                  className="evo-fill stroke-surface"
                  strokeWidth={2}
                  style={color(l)}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-md"
          style={hx > width / 2 ? { right: width - hx + 10 } : { left: hx + 10 }}
        >
          <p className="mb-1 font-semibold text-ink">
            {hour(times[hover])}
            <span className="font-normal text-muted"> · {fmtPct(series.sections[hover])} das {series.unit}</span>
          </p>
          {[...lines]
            .sort((a, b) => b.pct[hover] - a.pct[hover])
            .map((l) => (
              <p key={l.number} className="flex items-center justify-between gap-3 text-ink-2">
                <span className="flex items-center gap-1.5">
                  <span className="evo-fill h-2 w-2 rounded-full" style={color(l)} aria-hidden />
                  {l.name}
                </span>
                <span className="font-semibold text-ink tabular">{pct1(l.pct[hover])}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  )
}

/** Tabela com a mesma série, para leitores de tela e para quem prefere números. */
function DataTable({ series }: { series: EvolutionSeries }) {
  const { times, lines } = series
  const step = Math.max(1, Math.ceil(times.length / 20))
  const rows = times.map((_, i) => i).filter((i) => i % step === 0 || i === times.length - 1)
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted hover:text-ink">Ver os números em tabela</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-line">
        <table className="w-full text-left tabular">
          <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Horário</th>
              <th className="px-3 py-2 font-medium">{series.unit === 'urnas' ? 'Urnas' : 'Seções'}</th>
              {lines.map((l) => (
                <th key={l.number} className="px-3 py-2 font-medium">
                  {l.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-1.5">{hour(times[i])}</td>
                <td className="px-3 py-1.5">{fmtPct(series.sections[i])}</td>
                {lines.map((l) => (
                  <td key={l.number} className="px-3 py-1.5">
                    {pct1(l.pct[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function EvolutionSection({
  target,
  result,
  className,
}: {
  target: { cycle: Cycle; ids?: ElectionIds; office: Office; turn: Turn }
  result: ResultSummary | null | undefined
  className?: string
}) {
  const evo = useEvolution(target, result)
  if (evo.status !== 'ready') return null

  return (
    <section className={cn('rounded-lg border border-line bg-surface p-4 sm:p-5', className)} aria-labelledby="evolucao">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="evolucao" className="font-semibold">
          Evolução da apuração{target.turn === 2 ? ', 2º turno' : ', 1º turno'}
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legenda">
          {evo.series.lines.map((l) => (
            <li key={l.number} className="flex items-center gap-1.5 text-ink-2">
              <span
                className="evo-fill h-0.5 w-4 rounded-full"
                style={{ '--c': partyColor(l.party, l.index) } as CSSProperties}
                aria-hidden
              />
              {l.name}
            </li>
          ))}
        </ul>
      </div>

      <Chart series={evo.series} turn={target.turn} />
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {evo.series.source === 'gravada'
          ? 'Percentual dos votos válidos a cada atualização do TSE, gravado por este site durante a apuração.'
          : `Percentual dos votos válidos, minuto a minuto, na ordem em que o TSE recebeu os boletins de urna (dados abertos do TSE)${evo.series.exterior ? '' : ', sem os votos do exterior'}.`}
      </p>
      <DataTable series={evo.series} />
    </section>
  )
}
