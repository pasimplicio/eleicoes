// Regras de atualização automática durante a apuração.
// Todas as consultas de resultado usam livePolling: o site volta a consultar o TSE
// sozinho enquanto houver algo para mudar, sem o visitante recarregar a página.
import { useEffect, useState } from 'react'
import { currentYear, todayBrasilia, type Cycle } from '../config/elections'

export const LIVE_INTERVAL = 30_000

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Do dia do 1º turno até o dia seguinte ao 2º turno, no ciclo corrente. */
export function inLiveWindow(cycle: Cycle, today = todayBrasilia()): boolean {
  if (cycle.year !== currentYear()) return false
  return today >= cycle.dates[1] && today <= nextDay(cycle.dates[2])
}

interface Polled {
  final: boolean
  turn?: number
}

/**
 * Intervalo de nova consulta:
 *  - totalização em andamento: a cada 30 s (em qualquer ciclo);
 *  - na janela da eleição, arquivo ainda não publicado (antes das 17h): a cada 30 s;
 *  - no dia do 2º turno, enquanto só há o resultado do 1º: a cada 60 s;
 *  - resultado final: para.
 */
export function livePolling(cycle: Cycle, requestedTurn = 1, interval = LIVE_INTERVAL) {
  return (q: { state: { data?: Polled | null } }): number | false => {
    const d = q.state.data
    if (d && !d.final) return interval
    if (!inLiveWindow(cycle)) return false
    if (!d) return interval
    if (requestedTurn === 2 && d.turn === 1 && todayBrasilia() >= cycle.dates[2]) return interval * 2
    return false
  }
}

/** Força nova renderização periódica (virada do dia, início da divulgação). */
export function useClock(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
