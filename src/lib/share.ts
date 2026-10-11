// Mensagem do botão Compartilhar: apresenta o site e o que ele oferece, como um convite.
// Formato do WhatsApp: *negrito*. Os recursos seguem o tipo de eleição do ciclo.
import type { Cycle } from '../config/elections'
import { fmtDateLong } from './format'

interface Phase {
  cycle: Cycle
  started: boolean
  betweenRounds: boolean
}

export function siteMessage({ cycle, started, betweenRounds }: Phase) {
  const geral = cycle.kind === 'geral'
  const features = geral
    ? [
        '📊 Apuração ao vivo de presidente, governador e senador',
        '📍 A página do seu estado, com busca por cidade',
        '🗺️ Mapa de votos de cada deputado, município a município',
        '🔎 Mapa das seções: os votos de cada urna',
        '🏛️ Câmara e Senado eleitos, partido por partido',
        '📺 Modo telão para acompanhar na TV',
      ]
    : [
        '📊 Apuração ao vivo de prefeito e vereador',
        '🗺️ Mapas por estado e por município',
        '📺 Modo telão para acompanhar na TV',
      ]

  const when = betweenRounds
    ? `📅 2º turno em ${fmtDateLong(cycle.dates[2])}, resultados a partir das 17h`
    : !started
      ? `📅 1º turno em ${fmtDateLong(cycle.dates[1])}, resultados a partir das 17h`
      : null

  return [
    `🗳️ *Apuração Brasil · Eleições ${cycle.year}*`,
    'Os resultados oficiais do TSE, de graça e sem cadastro:',
    '',
    ...features,
    ...(when ? ['', when] : []),
  ].join('\n')
}
