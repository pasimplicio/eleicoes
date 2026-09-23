import type { ReactNode } from 'react'
import { cn } from '../lib/format'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-line bg-surface p-5 sm:p-6', className)}>{children}</section>
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{kicker}</p>}
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  disabled?: boolean
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition',
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            o.disabled && 'cursor-not-allowed opacity-40 hover:text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[11px] font-bold tracking-wider text-white uppercase">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
      Ao vivo
    </span>
  )
}
