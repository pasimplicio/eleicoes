import { CaretRight, House } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
  onClick?: () => void
}

/** Trilha "Início › ... › página atual". O último item é a página corrente. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const link = 'rounded-sm hover:text-ink hover:underline underline-offset-2'
  return (
    <nav aria-label="Trilha" className={`text-sm text-muted ${className ?? ''}`}>
      <ol className="flex flex-wrap items-center gap-1">
        <li className="flex items-center">
          <Link to="/" className={`${link} flex items-center gap-1`}>
            <House className="h-4 w-4" aria-hidden />
            Início
          </Link>
        </li>
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={c.label} className="flex items-center gap-1">
              <CaretRight className="h-3.5 w-3.5" aria-hidden />
              {last ? (
                <span aria-current="page" className="font-medium text-ink">
                  {c.label}
                </span>
              ) : c.to ? (
                <Link to={c.to} className={link}>
                  {c.label}
                </Link>
              ) : c.onClick ? (
                <button type="button" onClick={c.onClick} className={`${link} cursor-pointer`}>
                  {c.label}
                </button>
              ) : (
                <span>{c.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
