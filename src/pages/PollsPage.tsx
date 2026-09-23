import { ArrowSquareOut, ChartLine } from '@phosphor-icons/react'
import { useId, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { PollChart, UltimaRodada } from '../components/polls/PollChart'
import { Container, EmptyState, Segmented, SectionHeading, Skeleton } from '../components/ui'
import { findUf, inUf, UF_BY_IBGE, UFS } from '../config/ufs'
import { shade } from '../lib/colors'
import { cn } from '../lib/format'
import {
  fmtDia,
  INSTITUTOS,
  serieColor,
  useGraficoPesquisa,
  useMapaPesquisa,
  usePaginaPesquisa,
  type CargoPesquisa,
  type Instituto,
  type LiderUf,
} from '../lib/polls'

const CARGOS: { value: CargoPesquisa; label: string }[] = [
  { value: 'presidente', label: 'Presidente' },
  { value: 'governador', label: 'Governador' },
  { value: 'senador', label: 'Senador' },
]

// Perguntas sobre avaliação de governo ficam de fora: o módulo trata de intenção de voto.
const PERGUNTA_ELEITORAL = (label: string) => !/aprova|avalia/i.test(label)

type Modo = 'Ambos' | Instituto

export function PollsPage() {
  const [search, setSearch] = useSearchParams()
  const cargo = (CARGOS.find((c) => c.value === search.get('cargo'))?.value ?? 'presidente') as CargoPesquisa
  const modo = (['Ambos', ...INSTITUTOS].includes(search.get('instituto') ?? '') ? search.get('instituto') : 'Ambos') as Modo
  const mapaInst = (INSTITUTOS.includes(search.get('mapa') as Instituto) ? search.get('mapa') : 'Quaest') as Instituto
  const mapa = useMapaPesquisa(cargo, mapaInst)

  const ufParam = (search.get('uf') ?? '').toLowerCase()
  const uf =
    cargo === 'presidente' && (!ufParam || ufParam === 'br')
      ? 'br'
      : findUf(ufParam)
        ? ufParam
        : (mapa.data?.[0]?.uf.toLowerCase() ?? 'sp')
  const ufObj = uf === 'br' ? undefined : findUf(uf)
  const pergunta = search.get('pergunta') ?? 'Estimulada'

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setSearch(next, { replace: true, preventScrollReset: true })
  }

  const paginas = {
    Quaest: usePaginaPesquisa(cargo, uf, 'Quaest'),
    Datafolha: usePaginaPesquisa(cargo, uf, 'Datafolha'),
  }
  const perguntas = useMemo(() => {
    const labels = new Set<string>()
    for (const inst of INSTITUTOS) for (const p of paginas[inst].data?.perguntas ?? []) labels.add(p.label)
    return [...labels].filter(PERGUNTA_ELEITORAL)
  }, [paginas.Quaest.data, paginas.Datafolha.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const perguntaAtual = perguntas.includes(pergunta) ? pergunta : (perguntas[0] ?? 'Estimulada')

  const local = ufObj ? ufObj.nome : 'Brasil'
  const titulo = `${CARGOS.find((c) => c.value === cargo)!.label}, ${local}`
  const mostrar: Instituto[] = modo === 'Ambos' ? INSTITUTOS : [modo]

  return (
    <Container className="pt-8 sm:pt-12">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="fade-up space-y-7">
          <div>
            <p className="text-sm font-medium text-muted">Pesquisas eleitorais 2026</p>
            <h1 className="mt-2 font-serif text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              Quaest e Datafolha, rodada a rodada
            </h1>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-ink-2">
              A evolução de cada candidato nas pesquisas registradas na Justiça Eleitoral, como publicadas pelo g1.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Segmented
              label="Cargo"
              value={cargo}
              onChange={(v) => set({ cargo: v, uf: v === 'presidente' ? undefined : search.get('uf') ?? undefined, pergunta: undefined })}
              options={CARGOS}
            />
            <LocalSelect cargo={cargo} value={uf} onChange={(v) => set({ uf: v })} comPesquisa={mapa.data ?? []} />
          </div>
          <Segmented<Modo>
            label="Instituto"
            value={modo}
            onChange={(v) => set({ instituto: v === 'Ambos' ? undefined : v })}
            options={[
              { value: 'Ambos', label: 'Quaest e Datafolha' },
              { value: 'Quaest', label: 'Só Quaest' },
              { value: 'Datafolha', label: 'Só Datafolha' },
            ]}
          />
        </div>

        <MapaLideres
          cargo={cargo}
          instituto={mapaInst}
          onInstituto={(v) => set({ mapa: v === 'Quaest' ? undefined : v })}
          dados={mapa.data}
          carregando={mapa.isLoading}
          selecionada={ufObj?.ibge}
          onUf={(sigla) => set({ uf: sigla.toLowerCase() })}
        />
      </div>

      <section aria-labelledby="serie" className="mt-16">
        <SectionHeading
          id="serie"
          title={titulo}
          action={
            perguntas.length > 1 && (
              <PerguntaSelect value={perguntaAtual} options={perguntas} onChange={(v) => set({ pergunta: v })} />
            )
          }
        />
        <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-6', mostrar.length > 1 && 'xl:grid-cols-2')}>
          {mostrar.map((inst) => (
            <PainelInstituto
              key={inst}
              instituto={inst}
              pagina={paginas[inst].data}
              carregandoPagina={paginas[inst].isLoading}
              pergunta={perguntaAtual}
              titulo={`${titulo}, ${inst}`}
              local={ufObj ? inUf(ufObj) : 'no Brasil'}
            />
          ))}
        </div>
      </section>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted">
        Fonte: g1, com pesquisas Quaest e Datafolha registradas no TSE (o número de registro de cada rodada aparece na
        ficha técnica). Percentuais sobre o total de entrevistados, incluindo brancos, nulos e indecisos. Dados
        reproduzidos para fins informativos; consulte a publicação original pelo link de cada painel.
      </p>
    </Container>
  )
}

function LocalSelect({
  cargo,
  value,
  onChange,
  comPesquisa,
}: {
  cargo: CargoPesquisa
  value: string
  onChange: (v: string) => void
  comPesquisa: LiderUf[]
}) {
  const id = useId()
  const tem = new Set(comPesquisa.map((c) => c.uf))
  return (
    <div className="min-w-52">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Local
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full cursor-pointer rounded-md border border-line bg-surface px-3 text-base sm:text-sm"
      >
        {cargo === 'presidente' && <option value="br">Brasil</option>}
        {UFS.map((u) => (
          <option key={u.sigla} value={u.sigla.toLowerCase()}>
            {u.nome}
            {tem.has(u.sigla) ? '' : ' (sem pesquisa no mapa)'}
          </option>
        ))}
      </select>
    </div>
  )
}

function PerguntaSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        Pergunta
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 cursor-pointer rounded-md border border-line bg-surface px-3 text-base sm:text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function MapaLideres({
  cargo,
  instituto,
  onInstituto,
  dados,
  carregando,
  selecionada,
  onUf,
}: {
  cargo: CargoPesquisa
  instituto: Instituto
  onInstituto: (v: Instituto) => void
  dados?: LiderUf[]
  carregando: boolean
  selecionada?: string
  onUf: (sigla: string) => void
}) {
  const porUf = useMemo(() => new Map((dados ?? []).map((d) => [d.uf, d])), [dados])
  const legenda = useMemo(() => {
    const m = new Map<string, { cor: string; n: number }>()
    for (const d of dados ?? []) {
      const k = d.lider.partido ?? d.lider.nome
      const cur = m.get(k) ?? { cor: serieColor(d.lider), n: 0 }
      cur.n++
      m.set(k, cur)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [dados])

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">
          Quem lidera a última rodada em cada estado
          {cargo === 'presidente' && ', na pesquisa estadual para presidente'}
        </p>
        <Segmented<Instituto>
          label="Instituto do mapa"
          value={instituto}
          onChange={onInstituto}
          options={INSTITUTOS.map((i) => ({ value: i, label: i }))}
        />
      </div>
      <div className="relative">
        <ChoroplethMap
          src="/geo/br-uf.json"
          label={`Mapa do Brasil com o líder da última pesquisa ${instituto} em cada estado`}
          selected={selecionada}
          fill={(code) => {
            const d = porUf.get(UF_BY_IBGE[code].sigla)
            if (!d) return undefined
            const vantagem = d.lider.valor - (d.segundo?.valor ?? 0)
            return shade(serieColor(d.lider), 35 + vantagem * 1.5)
          }}
          name={(code) => {
            const uf = UF_BY_IBGE[code]
            const d = porUf.get(uf.sigla)
            return d ? `${uf.nome}: ${d.lider.nome} lidera com ${d.lider.valor}%` : `${uf.nome}: sem pesquisa ${instituto} no g1`
          }}
          tooltip={(code) => {
            const uf = UF_BY_IBGE[code]
            const d = porUf.get(uf.sigla)
            return (
              <div>
                <p className="mb-1.5 font-semibold">{uf.nome}</p>
                {d ? (
                  <>
                    {[d.lider, d.segundo].filter(Boolean).map((c) => (
                      <p key={c!.nome} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: serieColor(c!) }} />
                          <span className="truncate">{c!.nome}</span>
                        </span>
                        <span className="font-semibold tabular">{c!.valor}%</span>
                      </p>
                    ))}
                    <p className="mt-1.5 text-xs text-muted">
                      {instituto}, {d.pergunta.toLowerCase()}, rodada de {fmtDia(d.data)}
                    </p>
                  </>
                ) : (
                  <p className="text-muted">Sem pesquisa {instituto} publicada no g1</p>
                )}
              </div>
            )
          }}
          onSelect={(code) => onUf(UF_BY_IBGE[code].sigla)}
        />
        {carregando && (
          <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            Buscando as pesquisas de cada estado
          </p>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
        {legenda.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: v.cor }} aria-hidden />
            <strong className="font-semibold text-ink">{k}</strong> à frente em {v.n} {v.n === 1 ? 'UF' : 'UFs'}
          </span>
        ))}
        {!carregando && <span className="text-muted">Cinza: sem pesquisa {instituto} no g1.</span>}
      </figcaption>
    </figure>
  )
}

function PainelInstituto({
  instituto,
  pagina,
  carregandoPagina,
  pergunta,
  titulo,
  local,
}: {
  instituto: Instituto
  pagina?: import('../lib/polls').PaginaPesquisa | null
  carregandoPagina: boolean
  pergunta: string
  titulo: string
  local: string
}) {
  const q = pagina?.perguntas.find((p) => p.label === pergunta)
  const grafico = useGraficoPesquisa(pagina?.pagina, q?.id, instituto)

  return (
    <article className="rounded-lg border border-line bg-surface p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-2xl font-semibold tracking-tight">{instituto}</h3>
        {pagina?.existe && (
          <a
            href={pagina.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink hover:underline"
          >
            Ver no g1 <ArrowSquareOut className="h-4 w-4" aria-hidden />
          </a>
        )}
      </header>

      {carregandoPagina || grafico.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !pagina?.existe ? (
        <EmptyState icon={<ChartLine className="h-7 w-7" />} title={`Sem pesquisa ${instituto} ${local}`}>
          O g1 não publicou pesquisa {instituto} para este cargo e local.
        </EmptyState>
      ) : !q || !grafico.data ? (
        <EmptyState icon={<ChartLine className="h-7 w-7" />} title="Pergunta não disponível">
          A {instituto} não tem a pergunta “{pergunta}” para este cargo e local.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <PollChart series={grafico.data.series} margem={grafico.data.margem} titulo={titulo} />
          <UltimaRodada series={grafico.data.series} />
          {pagina.metodologia && (
            <div className="rounded-md bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">
              <p className="mb-1 font-semibold text-ink">Ficha técnica da última rodada</p>
              {pagina.metodologia}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
