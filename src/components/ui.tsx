import type { ReactNode } from 'react'
import { cn } from '../lib/format'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-lg border border-line bg-surface', className)}>{children}</section>
}

/** Título de seção editorial: filete superior e título serifado, sem rótulo acima. */
export function SectionHeading({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-t-2 border-ink pt-3">
      <h2 id={id} className="font-serif text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
        {title}
      </h2>
      {action}
    </div>
  )
}

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  disabled?: boolean
  hint?: string
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
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            type="button"
            aria-checked={active}
            disabled={o.disabled}
            title={o.disabled ? o.hint : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-10 cursor-pointer rounded-[5px] px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 sm:min-h-9',
              active ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(17_20_24/0.08)]' : 'text-muted hover:text-ink',
              o.disabled && 'cursor-not-allowed opacity-45 hover:text-muted',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  )
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-0.5 text-xs font-semibold text-white',
        className,
      )}
    >
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      Ao vivo
    </span>
  )
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  external,
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'ghost'
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold whitespace-nowrap transition active:translate-y-px',
        variant === 'primary'
          ? 'bg-ink text-page hover:bg-ink-2'
          : 'border border-line text-ink hover:border-ink/40 hover:bg-surface-2',
      )}
    >
      {children}
    </a>
  )
}
