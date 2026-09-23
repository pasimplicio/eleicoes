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
      style={{ width: size, height: size, boxShadow: `0 0 0 2px var(--color-surface), 0 0 0 ${size > 44 ? 4 : 3}px ${color}` }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={`Foto de ${name}`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
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
      className={cn('inline-flex items-center rounded-full px-2 py-px text-xs font-semibold', className)}
      style={{
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
        color: `color-mix(in srgb, ${color} var(--chip-mix), var(--color-ink))`,
      }}
    >
      {party}
    </span>
  )
}

export function StatusBadge({ elected, runoff, final }: { elected: boolean; runoff: boolean; final: boolean }) {
  if (elected) return <span className="rounded-full bg-ok px-2 py-px text-xs font-semibold text-white">Eleito</span>
  if (runoff && final)
    return <span className="rounded-full bg-accent px-2 py-px text-xs font-semibold text-on-accent">2º turno</span>
  return null
}
