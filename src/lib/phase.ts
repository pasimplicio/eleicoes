import { currentYear, getCycle, previousCycleOfKind, todayBrasilia, type Cycle, type Turn } from '../config/elections'
import { nextDay, useClock } from './live'
import { useElectionIds } from './tse/queries'

/** Instante de início da divulgação: fim da votação, 17h de Brasília. */
export const resultsStart = (date: string) => `${date}T17:00:00-03:00`

/**
 * Turno em destaque: o 2º a partir de dois dias após o 1º (apuração encerrada), quando
 * o TSE já marcou a eleição de 2º turno. Até o resultado sair, a página do 2º turno
 * mostra os finalistas; onde a eleição foi decidida no 1º turno, esse resultado.
 */
export function defaultTurn(cycle: Cycle, hasTurn2: boolean, today = todayBrasilia()): Turn {
  return hasTurn2 && today > nextDay(cycle.dates[1]) ? 2 : 1
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
    // Ao vivo só nos dias de apuração (dia da votação e a madrugada seguinte).
    live:
      started &&
      (today === cycle.dates[1] ||
        today === nextDay(cycle.dates[1]) ||
        (Boolean(ids?.[2]) && (today === cycle.dates[2] || today === nextDay(cycle.dates[2])))),
    /** Entre os turnos: 1º turno apurado, 2º turno marcado e ainda por vir. */
    betweenRounds: started && Boolean(ids?.[2]) && today > cycle.dates[1] && today < cycle.dates[2],
    display,
    displayIds,
    turn: started ? defaultTurn(cycle, Boolean(ids?.[2])) : (2 as Turn),
  }
}
