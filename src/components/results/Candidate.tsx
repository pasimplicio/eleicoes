import { useState } from 'react'
import { partyColor } from '../../config/parties'
import { cn } from '../../lib/format'

export function CandidatePhoto({
  src,
  name,
  color,
  size = 56,
}: {
  src?: string
  name: string
  color: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-surface-2"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px var(--color-surface), 0 0 0 4px ${color}` }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ background: color, fontSize: size * 0.34 }}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  )
}

export function PartyChip({ party, className }: { party: string; className?: string }) {
  if (!party) return null
  const color = partyColor(party)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold', className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color: `color-mix(in srgb, ${color} 80%, var(--color-ink))` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {party}
    </span>
  )
}

export function StatusBadge({ elected, runoff, final }: { elected: boolean; runoff: boolean; final: boolean }) {
  if (elected)
    return <span className="rounded-md bg-ok px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Eleito</span>
  if (runoff && final)
    return (
      <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand uppercase">2º turno</span>
    )
  return null
}
