import { useEffect, useState } from 'react'

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Contagem regressiva compacta ("11d 03h 08m"), atualizada a cada minuto. */
export function CountdownInline({ to }: { to: string }) {
  const p = parts(new Date(to).getTime() - useNow(30_000))
  return (
    <time dateTime={to} className="tabular">
      {p.d > 0 && `${p.d}d `}
      {pad(p.h)}h {pad(p.m)}min
    </time>
  )
}

/** Contagem regressiva em blocos, com segundos. */
export function Countdown({ to }: { to: string }) {
  const p = parts(new Date(to).getTime() - useNow(1000))
  const items = [
    { v: p.d, l: 'dias' },
    { v: p.h, l: 'horas' },
    { v: p.m, l: 'min' },
    { v: p.s, l: 'seg' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-live="off">
      {items.map(({ v, l }) => (
        <div key={l} className="rounded-md border border-line bg-surface px-2 py-2.5 text-center">
          <div className="text-3xl font-semibold tracking-tight tabular">{pad(v)}</div>
          <div className="text-xs text-muted">{l}</div>
        </div>
      ))}
    </div>
  )
}
