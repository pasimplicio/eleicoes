/** Mapa de votos já aberto num candidato proporcional. */
export function voteMapHref(cargo: string, uf: string, number: string) {
  return `/mapa-de-votos?${new URLSearchParams({ cargo, uf: uf.toLowerCase(), n: number })}`
}
