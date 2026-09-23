import { currentYear, getCycle, previousCycleOfKind, todayBrasilia, type Cycle, type Turn } from '../config/elections'
import { useClock } from './live'
import { useElectionIds } from './tse/queries'

/** Instante de início da divulgação: fim da votação, 17h de Brasília. */
export const resultsStart = (date: string) => `${date}T17:00:00-03:00`

export function defaultTurn(cycle: Cycle, hasTurn2: boolean, today = todayBrasilia()): Turn {
  return today >= cycle.dates[2] && hasTurn2 ? 2 : 1
}

/**
 * Decide o que a capa mostra: o ciclo corrente, quando a apuração já começou,
 * ou o último ciclo do mesmo tipo como referência.
 */
export function useFeaturedCycle() {
  useClock(60_000)
  const today = todayBrasilia()
  const year = currentYear()
  const cycle = getCycle(year)!
  const { ids, loading } = useElectionIds(year)
  const started = Boolean(ids?.[1]) && today >= cycle.dates[1]

  const refYear = previousCycleOfKind(year)
  const display = started ? cycle : getCycle(refYear)!
  const { ids: refIds } = useElectionIds(refYear)
  const displayIds = started ? ids : refIds

  return {
    cycle,
    ids,
    loading,
    started,
    live: started && today <= cycle.dates[2],
    display,
    displayIds,
    turn: started ? defaultTurn(cycle, Boolean(ids?.[2])) : (2 as Turn),
  }
}
