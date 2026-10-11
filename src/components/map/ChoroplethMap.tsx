import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { cn } from '../../lib/format'
import { useStatic } from '../../lib/tse/queries'

type Props = { codarea: string }

export interface MapLabel {
  text: string
  sub?: string
}

export interface ChoroplethMapProps {
  /** TopoJSON estático em /public/geo. */
  src: string
  /** TopoJSON desenhado por cima só com as divisas (ex.: estados sobre municípios). */
  overlay?: string
  /** Rótulo acessível do mapa. */
  label: string
  fill: (code: string) => string | undefined
  name: (code: string) => string
  tooltip?: (code: string) => ReactNode
  onSelect?: (code: string) => void
  selected?: string
  /** Códigos em destaque: o mapa aproxima neles e esmaece o restante. */
  focus?: string[]
  /** Texto sobre cada área (ex.: sigla e %). Áreas pequenas ganham rótulo ao lado, com linha. */
  labels?: (code: string) => MapLabel | null
  className?: string
}

const WIDTH = 800
/** Espaço à direita para os rótulos das áreas pequenas. */
const CALLOUT_W = 64
/** Mapas com muitas áreas (municípios): sem esmaecer ao passar o mouse e sem foco por teclado. */
const MANY = 200

export function ChoroplethMap({
  src,
  overlay,
  label,
  fill,
  name,
  tooltip,
  onSelect,
  selected,
  focus,
  labels,
  className,
}: ChoroplethMapProps) {
  const { data: topo, isLoading } = useStatic<Topology>(src)
  const { data: overlayTopo } = useStatic<Topology>(overlay)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ code: string; x: number; y: number; w: number } | null>(null)
  const withCallouts = Boolean(labels)

  const geo = useMemo(() => {
    if (!topo) return null
    const key = Object.keys(topo.objects)[0]
    const fc = feature(topo, topo.objects[key]) as unknown as FeatureCollection<Geometry, Props>
    const mapW = WIDTH - (withCallouts ? CALLOUT_W : 0)
    const probe = geoMercator().fitWidth(mapW, fc)
    const [[, y0], [, y1]] = geoPath(probe).bounds(fc)
    const height = Math.ceil(y1 - y0)
    const projection = geoMercator().fitSize([mapW, height], fc)
    const path = geoPath(projection)
    return {
      height,
      path,
      shapes: fc.features.map((f: Feature<Geometry, Props>) => ({
        code: String(f.properties.codarea),
        d: path(f) ?? '',
        bounds: path.bounds(f),
        centroid: path.centroid(f),
      })),
    }
  }, [topo, withCallouts])

  // Divisas do overlay (só as internas), na mesma projeção do mapa de baixo.
  const overlayD = useMemo(() => {
    if (!geo || !overlayTopo) return null
    const key = Object.keys(overlayTopo.objects)[0]
    const obj = overlayTopo.objects[key] as GeometryCollection
    return geo.path(mesh(overlayTopo, obj, (a, b) => a !== b)) ?? null
  }, [geo, overlayTopo])

  // Zoom na região em foco via transform do grupo (animável e sem recalcular os caminhos).
  const zoom = useMemo(() => {
    const none = { css: 'translate(0px, 0px) scale(1)', k: 1 }
    if (!geo || !focus?.length) return none
    const set = new Set(focus)
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const sh of geo.shapes) {
      if (!set.has(sh.code)) continue
      x0 = Math.min(x0, sh.bounds[0][0])
      y0 = Math.min(y0, sh.bounds[0][1])
      x1 = Math.max(x1, sh.bounds[1][0])
      y1 = Math.max(y1, sh.bounds[1][1])
    }
    if (!Number.isFinite(x0)) return none
    const k = Math.min(4, 0.9 * Math.min(WIDTH / (x1 - x0), geo.height / (y1 - y0)))
    const tx = WIDTH / 2 - k * ((x0 + x1) / 2)
    const ty = geo.height / 2 - k * ((y0 + y1) / 2)
    return { css: `translate(${tx}px, ${ty}px) scale(${k})`, k }
  }, [geo, focus])
  const focusKey = focus?.join(',') ?? ''
  const focusSet = useMemo(() => (focusKey ? new Set(focusKey.split(',')) : null), [focusKey])

  const many = (geo?.shapes.length ?? 0) > MANY
  const dimCode = many ? null : (hover?.code ?? null)

  // Os caminhos só são refeitos quando os dados mudam (no mapa de municípios, passar o mouse
  // não redesenha as 5.570 áreas; o contorno do destaque vai numa camada própria).
  const paths = useMemo(() => {
    if (!geo) return null
    const ordered = selected
      ? [...geo.shapes.filter((s) => s.code !== selected), ...geo.shapes.filter((s) => s.code === selected)]
      : geo.shapes
    return ordered.map((s) => {
      const isSel = s.code === selected
      const muted = focusSet !== null && !focusSet.has(s.code)
      const interactive = Boolean(onSelect) && !muted
      const keyboard = interactive && !many
      return (
        <path
          key={s.code}
          data-code={s.code}
          d={s.d}
          role={keyboard ? 'button' : 'img'}
          tabIndex={keyboard ? 0 : undefined}
          aria-hidden={muted || many || undefined}
          aria-label={many ? undefined : name(s.code)}
          aria-pressed={keyboard ? isSel : undefined}
          fill={muted ? 'var(--color-map-empty)' : (fill(s.code) ?? 'var(--color-map-empty)')}
          stroke={isSel ? 'var(--color-ink)' : 'var(--color-map-stroke)'}
          strokeWidth={isSel ? 2.5 : many ? 0.25 : 0.75}
          vectorEffect="non-scaling-stroke"
          className={cn(
            'map-shape',
            interactive && 'cursor-pointer',
            muted ? 'pointer-events-none opacity-30' : dimCode && dimCode !== s.code && 'opacity-70',
          )}
          onClick={() => interactive && onSelect?.(s.code)}
          onKeyDown={(e) => {
            if (keyboard && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onSelect?.(s.code)
            }
          }}
        >
          {!many && <title>{name(s.code)}</title>}
        </path>
      )
    })
  }, [geo, selected, focusSet, onSelect, many, name, fill, dimCode])

  // Rótulos: dentro da área quando cabem; nas pequenas, à direita do mapa, com linha-guia.
  const labelEls = useMemo(() => {
    if (!geo || !labels) return null
    const k = zoom.k
    const inside: ReactNode[] = []
    const small: { code: string; l: MapLabel; cx: number; cy: number }[] = []
    for (const s of geo.shapes) {
      if (focusSet && !focusSet.has(s.code)) continue
      const l = labels(s.code)
      if (!l) continue
      const [[x0, y0], [x1, y1]] = s.bounds
      const [cx, cy] = s.centroid
      if (Math.min(x1 - x0, y1 - y0) * k >= 46) {
        inside.push(
          <text key={s.code} x={cx} y={cy} textAnchor="middle" className="map-label" style={{ fontSize: 13 / k, strokeWidth: 3 / k }}>
            <tspan x={cx} dy={l.sub ? '-0.15em' : '0.35em'} className="font-semibold">
              {l.text}
            </tspan>
            {l.sub && (
              <tspan x={cx} dy="1.15em" style={{ fontSize: 11 / k }}>
                {l.sub}
              </tspan>
            )}
          </text>,
        )
      } else if (!focusSet) {
        small.push({ code: s.code, l, cx, cy })
      }
    }
    // Rótulos laterais em coluna, na altura de cada área, sem se sobreporem.
    small.sort((a, b) => a.cy - b.cy)
    const xText = WIDTH - CALLOUT_W + 14
    let lastY = -Infinity
    const callouts = small.map(({ code, l, cx, cy }) => {
      const y = Math.max(cy, lastY + 22)
      lastY = y
      return (
        <g key={code} className="map-callout">
          <polyline points={`${cx},${cy} ${xText - 6},${y}`} fill="none" strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
          <text x={xText} y={y} dy="0.35em" className="text-[12px]">
            <tspan className="font-semibold">{l.text}</tspan>
            {l.sub && <tspan dx="4">{l.sub}</tspan>}
          </text>
        </g>
      )
    })
    return { inside, callouts }
  }, [geo, labels, zoom.k, focusSet])

  const hoverShape = many && hover ? geo?.shapes.find((s) => s.code === hover.code) : undefined

  if (isLoading || !geo) {
    return <div className={cn('skeleton aspect-[1/1] w-full rounded-lg', className)} aria-busy="true" />
  }

  const move = (e: React.PointerEvent) => {
    const code = (e.target as Element).getAttribute?.('data-code')
    const box = wrapRef.current?.getBoundingClientRect()
    if (!code || !box || e.pointerType === 'touch') return setHover(null)
    setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width })
  }

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${geo.height}`}
        role="group"
        aria-label={label}
        className="h-auto w-full overflow-hidden select-none"
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        <g className="map-zoom" style={{ transform: zoom.css }}>
          {paths}
          {overlayD && (
            <path
              d={overlayD}
              fill="none"
              stroke="var(--color-map-stroke)"
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-none"
            />
          )}
          {hoverShape && (
            <path
              d={hoverShape.d}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-none"
            />
          )}
          {labelEls && <g className="pointer-events-none">{labelEls.inside}</g>}
        </g>
        {labelEls && labelEls.callouts.length > 0 && <g className="pointer-events-none">{labelEls.callouts}</g>}
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
