import { useMemo } from 'react'

export interface HemicycleGroup {
  id: string
  label: string
  color: string
  seats: number
}

interface Seat {
  x: number
  y: number
  angle: number
}

/** Posições das cadeiras em fileiras concêntricas, da esquerda para a direita. */
function layout(total: number) {
  const rows = Math.max(1, Math.min(9, Math.round(Math.sqrt(total / 3.2))))
  const inner = 0.46
  const radii = Array.from({ length: rows }, (_, i) => inner + ((1 - inner) * (i + 0.5)) / rows)
  const sum = radii.reduce((s, r) => s + r, 0)
  const perRow = radii.map((r) => Math.floor((total * r) / sum))
  let rest = total - perRow.reduce((s, n) => s + n, 0)
  for (let i = rows - 1; rest > 0; i = (i - 1 + rows) % rows, rest--) perRow[i]++

  const seats: Seat[] = []
  radii.forEach((r, i) => {
    const k = perRow[i]
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1))
      seats.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), angle })
    }
  })
  seats.sort((a, b) => b.angle - a.angle)
  const dot = Math.min(((1 - inner) / rows) * 0.42, (Math.PI * radii[0]) / Math.max(1, perRow[0] - 1) * 0.42)
  return { seats, dot }
}

export function Hemicycle({ groups, total, label }: { groups: HemicycleGroup[]; total: number; label: string }) {
  const { seats, dot } = useMemo(() => layout(total), [total])
  const colors = useMemo(() => {
    const out: string[] = []
    for (const g of groups) for (let i = 0; i < g.seats; i++) out.push(g.color)
    return out
  }, [groups])

  const size = 200
  const pad = (dot * size) / 2 + 2
  return (
    <svg viewBox={`${-size / 2 - pad} ${-size / 2 - pad} ${size + 2 * pad} ${size / 2 + 2 * pad}`} role="img" aria-label={label} className="h-auto w-full">
      {seats.map((s, i) => (
        <circle
          key={i}
          cx={(s.x * size) / 2}
          cy={(-s.y * size) / 2}
          r={(dot * size) / 2}
          fill={colors[i] ?? 'var(--color-map-empty)'}
          className="transition-[fill] duration-500"
        />
      ))}
      <text x={0} y={-14} textAnchor="middle" className="fill-ink font-sans text-[22px] font-semibold tabular">
        {total}
      </text>
      <text x={0} y={-2} textAnchor="middle" className="fill-muted font-sans text-[8px]">
        cadeiras
      </text>
    </svg>
  )
}
