import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { cn } from '../../lib/format'
import { useStatic } from '../../lib/tse/queries'

type Props = { codarea: string }

export interface ChoroplethMapProps {
  /** TopoJSON estático em /public/geo. */
  src: string
  /** Rótulo acessível do mapa. */
  label: string
  fill: (code: string) => string | undefined
  name: (code: string) => string
  tooltip?: (code: string) => ReactNode
  onSelect?: (code: string) => void
  selected?: string
  className?: string
}

const WIDTH = 800

export function ChoroplethMap({ src, label, fill, name, tooltip, onSelect, selected, className }: ChoroplethMapProps) {
  const { data: topo, isLoading } = useStatic<Topology>(src)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ code: string; x: number; y: number; w: number } | null>(null)

  const geo = useMemo(() => {
    if (!topo) return null
    const key = Object.keys(topo.objects)[0]
    const fc = feature(topo, topo.objects[key]) as unknown as FeatureCollection<Geometry, Props>
    const probe = geoMercator().fitWidth(WIDTH, fc)
    const [[, y0], [, y1]] = geoPath(probe).bounds(fc)
    const height = Math.ceil(y1 - y0)
    const projection = geoMercator().fitSize([WIDTH, height], fc)
    const path = geoPath(projection)
    return {
      height,
      shapes: fc.features.map((f: Feature<Geometry, Props>) => ({
        code: String(f.properties.codarea),
        d: path(f) ?? '',
      })),
    }
  }, [topo])

  if (isLoading || !geo) {
    return <div className={cn('skeleton aspect-square w-full rounded-2xl', className)} aria-busy="true" />
  }

  const move = (code: string, e: React.PointerEvent) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || e.pointerType === 'touch') return
    setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width })
  }

  // O selecionado é desenhado por último para o contorno ficar por cima dos vizinhos.
  const ordered = selected
    ? [...geo.shapes.filter((s) => s.code !== selected), ...geo.shapes.filter((s) => s.code === selected)]
    : geo.shapes

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${geo.height}`}
        role="group"
        aria-label={label}
        className="h-auto w-full select-none"
        onPointerLeave={() => setHover(null)}
      >
        {ordered.map((s) => {
          const isSel = s.code === selected
          return (
            <path
              key={s.code}
              d={s.d}
              role={onSelect ? 'button' : 'img'}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={name(s.code)}
              aria-pressed={onSelect ? isSel : undefined}
              fill={fill(s.code) ?? 'var(--color-map-empty)'}
              stroke={isSel ? 'var(--color-ink)' : 'var(--color-map-stroke)'}
              strokeWidth={isSel ? 2.5 : 0.8}
              vectorEffect="non-scaling-stroke"
              className={cn(
                'transition-[filter,opacity] duration-150 outline-none',
                onSelect && 'cursor-pointer hover:brightness-110 focus-visible:brightness-110',
                hover && hover.code !== s.code && 'opacity-85',
              )}
              onPointerMove={(e) => move(s.code, e)}
              onClick={() => onSelect?.(s.code)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(s.code)
                }
              }}
            >
              <title>{name(s.code)}</title>
            </path>
          )
        })}
      </svg>

      {hover && tooltip && (
        <div
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-line bg-surface p-3 text-sm shadow-xl"
          style={{
            left: Math.min(Math.max(hover.x, 128), hover.w - 128),
            top: hover.y,
          }}
        >
          {tooltip(hover.code)}
        </div>
      )}
    </div>
  )
}

