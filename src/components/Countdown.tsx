import { useEffect, useState } from 'react'

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 }
}

/** Contagem regressiva até um instante (ISO com fuso). */
export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const p = parts(target - now)

  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-live="off">
      {Object.entries(p).map(([k, v]) => (
        <div key={k} className="min-w-16 rounded-xl bg-white/8 px-3 py-2 text-center ring-1 ring-white/10 sm:min-w-20">
          <div className="text-3xl font-bold text-white tabular sm:text-4xl">{String(v).padStart(2, '0')}</div>
          <div className="text-[11px] font-semibold tracking-widest text-white/55 uppercase">{k}</div>
        </div>
      ))}
    </div>
  )
}
