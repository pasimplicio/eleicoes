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
  /** Códigos em destaque: o mapa aproxima neles e esmaece o restante. */
  focus?: string[]
  className?: string
}

const WIDTH = 800

export function ChoroplethMap({
  src,
  label,
  fill,
  name,
  tooltip,
  onSelect,
  selected,
  focus,
  className,
}: ChoroplethMapProps) {
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
        bounds: path.bounds(f),
      })),
    }
  }, [topo])

  // Zoom na região em foco via transform do grupo (animável e sem recalcular os caminhos).
  const zoom = useMemo(() => {
    if (!geo || !focus?.length) return 'translate(0px, 0px) scale(1)'
    const set = new Set(focus)
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const sh of geo.shapes) {
      if (!set.has(sh.code)) continue
      x0 = Math.min(x0, sh.bounds[0][0])
      y0 = Math.min(y0, sh.bounds[0][1])
      x1 = Math.max(x1, sh.bounds[1][0])
      y1 = Math.max(y1, sh.bounds[1][1])
    }
    if (!Number.isFinite(x0)) return 'translate(0px, 0px) scale(1)'
    const k = Math.min(4, 0.9 * Math.min(WIDTH / (x1 - x0), geo.height / (y1 - y0)))
    const tx = WIDTH / 2 - k * ((x0 + x1) / 2)
    const ty = geo.height / 2 - k * ((y0 + y1) / 2)
    return `translate(${tx}px, ${ty}px) scale(${k})`
  }, [geo, focus])
  const focusSet = focus?.length ? new Set(focus) : null

  if (isLoading || !geo) {
    return <div className={cn('skeleton aspect-[1/1] w-full rounded-lg', className)} aria-busy="true" />
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
        className="h-auto w-full overflow-hidden select-none"
        onPointerLeave={() => setHover(null)}
      >
        <g className="map-zoom" style={{ transform: zoom }}>
        {ordered.map((s) => {
          const isSel = s.code === selected
          const muted = focusSet !== null && !focusSet.has(s.code)
          const interactive = Boolean(onSelect) && !muted
          return (
            <path
              key={s.code}
              d={s.d}
              role={interactive ? 'button' : 'img'}
              tabIndex={interactive ? 0 : undefined}
              aria-hidden={muted || undefined}
              aria-label={name(s.code)}
              aria-pressed={interactive ? isSel : undefined}
              fill={muted ? 'var(--color-map-empty)' : (fill(s.code) ?? 'var(--color-map-empty)')}
              stroke={isSel ? 'var(--color-ink)' : 'var(--color-map-stroke)'}
              strokeWidth={isSel ? 2.5 : 0.75}
              vectorEffect="non-scaling-stroke"
              className={cn(
                'map-shape',
                interactive && 'cursor-pointer',
                muted ? 'pointer-events-none opacity-30' : hover && hover.code !== s.code && 'opacity-70',
              )}
              onPointerMove={(e) => move(s.code, e)}
              onClick={() => interactive && onSelect?.(s.code)}
              onKeyDown={(e) => {
                if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onSelect?.(s.code)
                }
              }}
            >
              <title>{name(s.code)}</title>
            </path>
          )
        })}
        </g>
      </svg>

      {hover && tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-line bg-surface p-3 text-sm shadow-[0_12px_32px_rgb(17_20_24/0.16)]"
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

