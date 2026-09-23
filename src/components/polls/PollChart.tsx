// Série de uma pergunta de pesquisa: uma linha por candidato ao longo das rodadas.
// Especificação (skill de visualização): linhas de 2px, marcadores com anel na cor da
// superfície, um único eixo, grade recessiva, legenda sempre presente, rótulo só no
// fim de cada linha (com linha-guia quando se aproximam), dica com linha vertical ao
// passar o mouse/tocar e visão em tabela. Texto nunca usa a cor da série.
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/format'
import { fmtDia, NAO_CANDIDATO, nomeCurto, serieColor, type SeriePesquisa } from '../../lib/polls'

const H = 300
const MARGEM = { top: 14, right: 150, bottom: 30, left: 36 }
const DEFAULT_VISIBLE = 4

interface Props {
  series: SeriePesquisa[]
  margem?: number
  titulo: string
}

interface Linha extends SeriePesquisa {
  cor: string
  ultimo: number
  candidato: boolean
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export function PollChart({ series, margem, titulo }: Props) {
  const [ref, width] = useWidth()
  // Em telas estreitas, menos espaço para os rótulos finais.
  const M = width < 480 ? { ...MARGEM, right: 112 } : MARGEM
  const datas = useMemo(() => [...new Set(series.flatMap((s) => s.pontos.map((p) => p.data)))].sort(), [series])
  const ultimaData = datas.at(-1)

  const linhas: Linha[] = useMemo(
    () =>
      series
        .map((s, i) => ({
          ...s,
          cor: serieColor(s, i),
          ultimo: s.pontos.find((p) => p.data === ultimaData)?.valor ?? s.pontos.at(-1)?.valor ?? 0,
          candidato: !NAO_CANDIDATO.test(s.nome),
        }))
        .sort((a, b) => Number(b.candidato) - Number(a.candidato) || b.ultimo - a.ultimo),
    [series, ultimaData],
  )

  // Por padrão: os 4 candidatos à frente. Cor segue o candidato, nunca a posição.
  const [ocultas, setOcultas] = useState<Set<string> | null>(null)
  const padraoOcultas = useMemo(
    () => new Set(linhas.filter((l, i) => !l.candidato || i >= DEFAULT_VISIBLE).map((l) => l.nome)),
    [linhas],
  )
  const hidden = ocultas ?? padraoOcultas
  const visiveis = linhas.filter((l) => !hidden.has(l.nome))
  const toggle = (nome: string) => {
    const next = new Set(hidden)
    if (next.has(nome)) next.delete(nome)
    else next.add(nome)
    setOcultas(next)
  }

  // Escalas
  const iw = Math.max(80, width - M.left - M.right)
  const ih = H - M.top - M.bottom
  const t = (d: string) => new Date(`${d}T12:00:00Z`).getTime()
  const t0 = datas.length ? t(datas[0]) : 0
  const t1 = datas.length ? t(datas.at(-1)!) : 1
  const x = (d: string) => (datas.length < 2 ? iw / 2 : ((t(d) - t0) / (t1 - t0)) * iw)
  const maxV = Math.max(10, ...visiveis.flatMap((l) => l.pontos.map((p) => p.valor)))
  const top = Math.ceil((maxV + 4) / 10) * 10
  const y = (v: number) => ih - (v / top) * ih
  const ticks = Array.from({ length: top / 10 + 1 }, (_, i) => i * 10).filter((v) => top <= 60 || v % 20 === 0)

  // Rótulos finais sem sobreposição: afastados verticalmente com linha-guia até o ponto.
  const rotulos = useMemo(() => {
    const items = visiveis
      .map((l) => {
        const p = l.pontos.at(-1)
        return p ? { nome: l.nome, cor: l.cor, valor: p.valor, x: x(p.data), y0: y(p.valor), y: y(p.valor) } : null
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .sort((a, b) => a.y0 - b.y0)
    const gap = 16
    for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + gap)
    const overflow = (items.at(-1)?.y ?? 0) - ih
    if (overflow > 0) items.forEach((it) => (it.y -= overflow))
    for (let i = items.length - 2; i >= 0; i--) items[i].y = Math.min(items[i].y, items[i + 1].y - gap)
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis.map((v) => v.nome).join(), width, top])

  // Hover: rodada mais próxima do ponteiro.
  const [legendaAberta, setLegendaAberta] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    let best = datas[0]
    for (const d of datas) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d
    setHover(best)
  }
  const hoverVals = hover
    ? visiveis
        .map((l) => ({ l, v: l.pontos.find((p) => p.data === hover)?.valor }))
        .filter((a): a is { l: Linha; v: number } => a.v !== undefined)
        .sort((a, b) => b.v - a.v)
    : []

  if (!datas.length) return null

  return (
    <figure>
      <div ref={ref} className="relative">
        <svg width={width} height={H} role="img" aria-label={`${titulo}: evolução por rodada`} className="block overflow-visible">
          <g transform={`translate(${M.left},${M.top})`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={0} x2={iw} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                  {v}%
                </text>
              </g>
            ))}
            {datas.map((d, i) => {
              const every = Math.ceil(datas.length / Math.max(2, Math.floor(iw / 70)))
              if (i % every && i !== datas.length - 1) return null
              return (
                <text key={d} x={x(d)} y={ih + 20} textAnchor="middle" className="fill-muted text-[11px]">
                  {fmtDia(d)}
                </text>
              )
            })}

            {hover && <line x1={x(hover)} x2={x(hover)} y1={0} y2={ih} className="stroke-ink/30" strokeWidth={1} />}

            {visiveis.map((l) => {
              const pts = l.pontos.map((p) => `${x(p.data)},${y(p.valor)}`).join(' ')
              return (
                <g key={l.nome} style={{ ['--c' as string]: l.cor }} className="poll-series">
                  <polyline points={pts} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {l.pontos.map((p) => (
                    <circle
                      key={p.data}
                      cx={x(p.data)}
                      cy={y(p.valor)}
                      r={hover === p.data ? 5.5 : 4}
                      strokeWidth={2}
                      className="poll-dot"
                    />
                  ))}
                </g>
              )
            })}

            {rotulos.map((r) => (
              <g key={r.nome}>
                {Math.abs(r.y - r.y0) > 2 && (
                  <line x1={r.x + 6} y1={r.y0} x2={iw + 10} y2={r.y} className="stroke-muted/60" strokeWidth={1} />
                )}
                <text x={iw + 12} y={r.y} dy="0.32em" className="fill-ink text-[12px]">
                  <tspan className="font-semibold tabular">{pct(r.valor)}</tspan>
                  <tspan className="fill-ink-2"> {nomeCurto(r.nome)}</tspan>
                </text>
              </g>
            ))}

            <rect
              width={iw}
              height={ih}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
              className="cursor-crosshair"
            />
          </g>
        </svg>

        {hover && hoverVals.length > 0 && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line bg-surface p-3 text-sm shadow-[0_12px_32px_rgb(17_20_24/0.16)]"
            style={{
              left: Math.min(Math.max(M.left + x(hover) + 12, 0), width - 230),
              top: M.top,
            }}
          >
            <p className="mb-2 font-semibold">Rodada de {fmtDia(hover)}</p>
            <ul className="space-y-1">
              {hoverVals.map(({ l, v }) => (
                <li key={l.nome} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.cor }} />
                    <span className="truncate">{l.nome}</span>
                  </span>
                  <span className="font-semibold tabular">{pct(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <figcaption className="mt-4">
        <ul className="flex flex-wrap gap-2" aria-label="Legenda: toque para mostrar ou ocultar">
          {(legendaAberta ? linhas : linhas.filter((l, i) => i < 6 || !hidden.has(l.nome))).map((l) => {
            const on = !hidden.has(l.nome)
            return (
              <li key={l.nome}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(l.nome)}
                  className={cn(
                    'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition',
                    on ? 'border-line bg-surface text-ink' : 'border-dashed border-line text-muted',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: on ? l.cor : 'transparent', boxShadow: `inset 0 0 0 1.5px ${l.cor}` }}
                  />
                  {l.nome}
                  {l.partido && <span className="text-muted">{l.partido}</span>}
                </button>
              </li>
            )
          })}
          {!legendaAberta && linhas.length > 6 && (
            <li>
              <button
                type="button"
                onClick={() => setLegendaAberta(true)}
                className="inline-flex min-h-9 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium text-ink-2 hover:text-ink hover:underline"
              >
                + {linhas.filter((l, i) => !(i < 6 || !hidden.has(l.nome))).length} opções
              </button>
            </li>
          )}
        </ul>
        {margem !== undefined && (
          <p className="mt-3 text-xs text-muted">Margem de erro de {margem} pontos percentuais, para mais ou para menos.</p>
        )}

        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink">Ver os números em tabela</summary>
          <div className="mt-2 overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">{titulo}, por rodada</caption>
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Candidato
                  </th>
                  {datas.map((d) => (
                    <th key={d} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {fmtDia(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.nome} className="border-b border-line last:border-0">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal whitespace-nowrap">
                      {l.nome} {l.partido && <span className="text-muted">{l.partido}</span>}
                    </th>
                    {datas.map((d) => {
                      const v = l.pontos.find((p) => p.data === d)?.valor
                      return (
                        <td key={d} className="px-3 py-1.5 text-right tabular">
                          {v === undefined ? '-' : pct(v)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figcaption>
    </figure>
  )
}

/** Última rodada: barras finas com a variação sobre a rodada anterior. */
export function UltimaRodada({ series }: { series: SeriePesquisa[] }) {
  const datas = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.data)))].sort()
  const ultima = datas.at(-1)
  const anterior = datas.at(-2)
  const [todos, setTodos] = useState(false)
  if (!ultima) return null
  const rows = series
    .map((s, i) => ({
      s,
      cor: serieColor(s, i),
      v: s.pontos.find((p) => p.data === ultima)?.valor,
      prev: anterior ? s.pontos.find((p) => p.data === anterior)?.valor : undefined,
    }))
    .filter((r): r is typeof r & { v: number } => r.v !== undefined)
    .sort((a, b) => Number(!NAO_CANDIDATO.test(b.s.nome)) - Number(!NAO_CANDIDATO.test(a.s.nome)) || b.v - a.v)
  const max = Math.max(...rows.map((r) => r.v), 1)
  const pequenos = rows.filter((r) => r.v < 1 && !NAO_CANDIDATO.test(r.s.nome))
  const visiveis = todos ? rows : rows.filter((r) => !pequenos.includes(r))

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Rodada de {fmtDia(ultima)}
        {anterior && `, comparada com ${fmtDia(anterior)}`}
      </p>
      <ul className="space-y-2.5">
        {visiveis.map(({ s, cor, v, prev }) => {
          const delta = prev === undefined ? undefined : Math.round((v - prev) * 10) / 10
          return (
            <li key={s.nome} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem_3rem] items-center gap-x-3 text-sm">
              <span className="truncate" title={s.nome}>
                {s.nome}
              </span>
              <span className="h-2.5">
                <span
                  className="block h-full rounded-r-full"
                  style={{ width: `${(v / max) * 100}%`, background: cor }}
                />
              </span>
              <span className="text-right font-semibold tabular">{pct(v)}</span>
              <span className="text-right text-xs text-muted tabular" aria-label={delta === undefined ? undefined : `variação de ${delta} pontos`}>
                {delta === undefined ? '' : delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR')}`}
              </span>
            </li>
          )
        })}
      </ul>
      {pequenos.length > 0 && !todos && (
        <button
          type="button"
          onClick={() => setTodos(true)}
          className="mt-3 min-h-9 cursor-pointer text-sm font-medium text-ink-2 hover:text-ink hover:underline"
        >
          Mais {pequenos.length} {pequenos.length === 1 ? 'candidato' : 'candidatos'} com menos de 1%
        </button>
      )}
    </div>
  )
}
