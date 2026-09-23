const intFmt = new Intl.NumberFormat('pt-BR')
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export const fmtInt = (n: number) => intFmt.format(n)
export const fmtPct = (n: number) => `${pctFmt.format(n)}%`
export const fmtCompact = (n: number) => compactFmt.format(n)

/** "02/10/2022 23:00:58" -> "02/10/2022 às 23:00" */
export function fmtUpdated(tse: string): string {
  const [d, t] = tse.split(' ')
  return t ? `${d} às ${t.slice(0, 5)}` : d
}

export function fmtDateLong(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** "SÃO JOSÉ DOS CAMPOS" -> "São José dos Campos" (nomes publicados em caixa alta pelo TSE). */
export function titleCase(name: string): string {
  return decodeEntities(name)
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('pt-BR'))
    .replace(/(?<=\s)(Da|De|Do|Das|Dos|E)(?=\s)/gu, (w) => w.toLowerCase())
    .replace(/(?<=\s)D'(?=\p{L})/gu, "d'")
}

/** O TSE publica alguns textos com entidades HTML ("D&apos;AVILA", "1&#186;"). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(apos|quot|amp|lt|gt);/g, (_, e: string) => ({ apos: "'", quot: '"', amp: '&', lt: '<', gt: '>' })[e]!)
}
