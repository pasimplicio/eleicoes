// Modo telão (TV), no padrão visual do app Resultados do TSE: palco de 1280x720 que
// escala para a tela, telas em rodízio (acompanhamento geral e resultado por cargo e
// localidade), barra de totalização amarelo-azul e cartões com anel de votos.
import { ArrowsClockwise, ArrowsIn, ArrowsOut, GearSix, MapPin } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChoroplethMap } from '../components/map/ChoroplethMap'
import { findOffice, getCycle, todayBrasilia, type Cycle, type ElectionIds, type Office, type Turn } from '../config/elections'
import { UF_BY_IBGE, UFS, findUf } from '../config/ufs'
import { useCandidates } from '../lib/candidates'
import { cn, fmtInt, fmtPct, fmtUpdated } from '../lib/format'
import { defaultTurn } from '../lib/phase'
import { loadTelaoConfig, roteiro, type TelaoModulo } from '../lib/telao'
import type { CandidateResult, ResultSummary } from '../lib/tse/model'
import { useElectionIds, useResult, useUfResults } from '../lib/tse/queries'

const STAGE_W = 1280
const STAGE_H = 720

function useStageScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return scale
}

function useFullscreen() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const h = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  const toggle = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()
  return [on, toggle] as const
}

export function Telao() {
  const [search] = useSearchParams()
  const anoParam = Number(search.get('ano'))
  const turnoParam = Number(search.get('turno'))
  const telasParam = search.get('telas')
  const geralParam = search.get('geral')
  const config = useMemo(() => {
    const c = loadTelaoConfig()
    if (getCycle(anoParam)?.kind === 'geral') c.ano = anoParam
    if (turnoParam === 1 || turnoParam === 2) c.turno = turnoParam
    // ?telas=presidente-br,governador-sp  |  ?geral=0 desliga o acompanhamento geral
    const telas = (telasParam ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase().match(/^(presidente|governador|senador)-([a-z]{2})$/))
      .filter((m): m is RegExpMatchArray => Boolean(m) && (m![2] === 'br' ? m![1] === 'presidente' : Boolean(findUf(m![2]))))
      .map((m) => ({ cargo: m[1], uf: m[2].toUpperCase() }))
    if (telas.length) c.abrangencias = telas
    if (geralParam === '0') c.mostrarAcompanhamentoGeral = false
    return c
  }, [anoParam, turnoParam, telasParam, geralParam])
  const modulos = useMemo(() => roteiro(config), [config])
  const cycle = getCycle(config.ano) ?? getCycle(2022)!
  const { ids } = useElectionIds(cycle.year)
  const turn: Turn = config.turno === 'auto' ? defaultTurn(cycle, Boolean(ids?.[2])) : config.turno
  const scale = useStageScale()
  const [fullscreen, toggleFullscreen] = useFullscreen()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (modulos.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % modulos.length), Math.max(5, config.segundos) * 1000)
    return () => clearInterval(id)
  }, [modulos.length, config.segundos])

  const modulo = modulos[i % modulos.length]

  return (
    <div className="telao fixed inset-0 overflow-hidden">
      <main
        className="absolute top-1/2 left-1/2 overflow-hidden"
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {modulo.tipo === 'acompanhamento-geral' ? (
          <AcompanhamentoGeral key={`g${i}`} cycle={cycle} ids={ids} turn={turn} cargo={modulo.cargo} />
        ) : (
          <Abrangencia key={`a${i}`} cycle={cycle} ids={ids} turn={turn} modulo={modulo} />
        )}
      </main>

      <div
        className={cn(
          'fixed right-4 bottom-4 flex gap-4 transition-opacity',
          fullscreen && 'opacity-0 hover:opacity-100 focus-within:opacity-100',
        )}
      >
        <Link to="/telao/configurar" className="telao-fab" aria-label="Configurar telão">
          <GearSix weight="fill" className="h-6 w-6" />
        </Link>
        <button type="button" onClick={toggleFullscreen} className="telao-fab" aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
          {fullscreen ? <ArrowsIn weight="bold" className="h-6 w-6" /> : <ArrowsOut weight="bold" className="h-6 w-6" />}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ cabeçalho

function Cabecalho({ local, cargo, turno, cycle }: { local: string; cargo: string; turno?: Turn; cycle: Cycle }) {
  return (
    <header className="relative flex h-[88px] shrink-0 items-center overflow-hidden bg-[var(--tse-secundary)] px-10">
      <span className="flex items-center gap-2 text-[28px] font-bold text-[var(--tse-primary)]">
        <MapPin weight="fill" className="h-7 w-7" />
        {local}
      </span>
      <span className="ml-5 text-[20px] font-semibold text-[var(--tse-primary)]/80">{cargo}</span>
      <div className="ml-auto flex items-center gap-4">
        {turno && (
          <span className="rounded-md border-2 border-[var(--tse-tertiary)] px-4 py-1.5 text-[14px] font-bold text-[var(--tse-tertiary)] uppercase">
            {turno}º turno
          </span>
        )}
        <span className="text-right leading-tight text-[var(--tse-primary)]">
          <span className="block text-[15px] font-bold">Eleições {cycle.year}</span>
          <span className="block text-[12px] font-semibold opacity-75">Apuração Brasil, dados do TSE</span>
        </span>
      </div>
    </header>
  )
}

// ------------------------------------------------------------------ totalização

function BarraTotalizacao({ pct }: { pct: number }) {
  return (
    <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#e3e5ea]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, pct)}%`, background: 'linear-gradient(to right, #ffdb05, var(--tse-primary-alt) 93%)' }}
      />
    </div>
  )
}

function CartaoTotalizacao({
  result,
  aguardando,
  atualizando,
  onAtualizar,
  inicio,
}: {
  result?: ResultSummary | null
  aguardando: boolean
  atualizando: boolean
  onAtualizar: () => void
  inicio: string
}) {
  const pct = result?.sectionsPct ?? 0
  return (
    <section className="rounded-2xl bg-white px-5 pt-3 pb-2.5 shadow-[0_1px_3px_rgb(0_0_0/0.06)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[20px] font-bold text-[#222]">{fmtPct(pct)} das seções totalizadas</p>
          <p className="text-[13px] font-bold text-[var(--tse-primary)]">(Horário de Brasília)</p>
        </div>
        <button
          type="button"
          onClick={onAtualizar}
          className="flex items-center gap-1.5 rounded-md bg-[#eef0f4] px-3 py-1.5 text-[12px] font-semibold text-[#444]"
        >
          <ArrowsClockwise weight="bold" className={cn('h-4 w-4 text-[#fdb035]', atualizando && 'animate-spin')} />
          Atualizar
        </button>
      </div>
      <div className="mt-3">
        <BarraTotalizacao pct={pct} />
      </div>
      <p className="mt-2 text-[13px] font-bold text-[var(--tse-primary)]">
        {aguardando
          ? `Divulgação a partir das 17h de ${inicio} (horário de Brasília)`
          : `Última atualização ${fmtUpdated(result!.updatedAt).replace(' às ', ' ')}`}
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ abrangência

function Abrangencia({
  cycle,
  ids,
  turn,
  modulo,
}: {
  cycle: Cycle
  ids?: ElectionIds
  turn: Turn
  modulo: Extract<TelaoModulo, { tipo: 'abrangencia' }>
}) {
  const office = findOffice(cycle, modulo.cargo) ?? cycle.offices[0]
  const uf = modulo.uf === 'BR' ? undefined : findUf(modulo.uf)
  const abr = uf ? uf.sigla.toLowerCase() : 'br'
  const effectiveTurn: Turn = office.hasRunoff ? turn : 1
  const result = useResult({ cycle, ids, office, turn: effectiveTurn }, abr)
  const aguardando = !result.data
  const registered = useCandidates(cycle, ids, office, aguardando ? abr : undefined)

  const cards: CandidateCard[] = result.data
    ? result.data.candidates.map((c) => ({ ...c, status: statusOf(c, result.data!, office, Boolean(uf)) }))
    : (registered.data?.candidates ?? []).map((c) => ({
        id: c.id,
        number: c.number,
        name: c.name,
        party: c.party,
        votes: 0,
        pct: 0,
        photo: c.photo,
        status: undefined,
      }))

  return (
    <div className="flex h-full flex-col">
      <Cabecalho
        cycle={cycle}
        local={uf ? uf.nome : 'Brasil'}
        cargo={office.name}
        turno={office.hasRunoff ? (result.data?.turn as Turn | undefined) ?? effectiveTurn : undefined}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-10 pt-4 pb-4">
        <CartaoTotalizacao
          result={result.data}
          aguardando={aguardando}
          atualizando={result.isFetching}
          onAtualizar={() => result.refetch()}
          inicio={cycle.dates[effectiveTurn].split('-').reverse().join('/')}
        />
        <h2 className="text-[22px] leading-none font-extrabold text-[#111]">{office.name}</h2>
        <GradeCandidatos cards={cards} />
      </div>
    </div>
  )
}

interface CandidateCard {
  id: string
  number: string
  name: string
  party: string
  votes: number
  pct: number
  photo?: string
  status?: 'Eleito' | 'Não eleito' | '2º turno'
}

function statusOf(c: CandidateResult, r: ResultSummary, office: Office, inUf: boolean): CandidateCard['status'] {
  // Presidente dentro de uma UF: o TSE repete o status nacional; não se aplica à UF.
  if (office.scope === 'br' && inUf) return undefined
  if (c.elected) return 'Eleito'
  if (c.runoff && r.final) return '2º turno'
  return r.final ? 'Não eleito' : undefined
}

function GradeCandidatos({ cards }: { cards: CandidateCard[] }) {
  if (!cards.length) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl bg-white text-[18px] font-semibold text-[#666]">
        Aguardando os dados do TSE
      </div>
    )
  }
  // Sem votos (antes da divulgação) nenhum cartão fica em destaque: grade uniforme.
  if (cards.every((c) => c.votes === 0)) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-3 gap-2">
        {cards.slice(0, 15).map((c) => (
          <Cartao key={c.id} c={c} compacto />
        ))}
      </div>
    )
  }
  const [lead, ...rest] = cards
  return (
    <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-2">
      <Cartao c={lead} destaque />
      {rest.slice(0, 6).map((c) => (
        <Cartao key={c.id} c={c} />
      ))}
    </div>
  )
}

function FotoAnel({ src, name, pct, size }: { src?: string; name: string; pct: number; size: number }) {
  const [failed, setFailed] = useState(false)
  const stroke = 3
  const r = size / 2 - stroke
  const len = 2 * Math.PI * r
  const initials = name
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6e8ee" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tse-tertiary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(len * Math.min(100, pct)) / 100} ${len}`}
          style={{ transition: 'stroke-dasharray .5s cubic-bezier(.5,0,.3,1)' }}
        />
      </svg>
      <div className="absolute overflow-hidden rounded-full bg-[#e6e8ee]" style={{ inset: stroke * 2 }}>
        {src && !failed ? (
          <img src={src} alt={name} onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[18px] font-bold text-[var(--tse-tertiary)]">
            {initials}
          </span>
        )}
      </div>
    </div>
  )
}

function Pilula({ status }: { status?: CandidateCard['status'] }): ReactNode {
  if (!status) return null
  return (
    <span
      className={cn(
        'inline-block min-w-[5.5em] rounded-full px-[.75em] py-[.3125rem] text-center leading-none font-bold',
        status === 'Não eleito' ? 'bg-[#e3e5ea] text-[#666]' : 'bg-[var(--tse-primary)] text-white',
      )}
    >
      {status}
    </span>
  )
}

function Cartao({ c, destaque, compacto }: { c: CandidateCard; destaque?: boolean; compacto?: boolean }) {
  if (compacto) {
    return (
      <article className="flex min-w-0 items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-[0_1px_3px_rgb(0_0_0/0.06)]">
        <FotoAnel src={c.photo} name={c.name} pct={0} size={56} />
        <div className="min-w-0">
          <p className="text-[11px] text-[#8a8f99] uppercase">
            {c.party} – {c.number}
          </p>
          <p className="line-clamp-2 text-[15px] leading-tight font-extrabold text-[#111] uppercase">{c.name}</p>
          <p className="mt-0.5 text-[13px] font-bold text-[var(--tse-tertiary)] tabular">{fmtPct(0)}</p>
        </div>
      </article>
    )
  }
  return (
    <article
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgb(0_0_0/0.06)]',
        destaque && 'col-span-2',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <FotoAnel src={c.photo} name={c.name} pct={c.pct} size={destaque ? 76 : 56} />
        <div className="text-right">
          <p className={cn('leading-none font-bold text-[var(--tse-tertiary)] tabular', destaque ? 'text-[36px]' : 'text-[24px]')}>
            {fmtPct(c.pct)}
          </p>
          <p className={cn('mt-1 text-[#555] tabular', destaque ? 'text-[17px]' : 'text-[13px]')}>{fmtInt(c.votes)} votos</p>
        </div>
      </div>
      <div className="mt-auto">
        <p className={cn('text-[#8a8f99] uppercase', destaque ? 'text-[14px]' : 'text-[12px]')}>
          {c.party} – {c.number}
        </p>
        <p
          className={cn(
            'line-clamp-2 leading-tight font-extrabold text-[#111] uppercase',
            destaque ? 'mt-1 text-[32px]' : 'mt-0.5 text-[17px]',
          )}
        >
          {c.name}
        </p>
        <div className={cn('mt-1.5', destaque ? 'text-[16px]' : 'text-[12px]')}>
          <Pilula status={c.status} />
        </div>
      </div>
    </article>
  )
}

// ------------------------------------------------------------------ acompanhamento geral

function AcompanhamentoGeral({ cycle, ids, turn, cargo }: { cycle: Cycle; ids?: ElectionIds; turn: Turn; cargo: string }) {
  const office = findOffice(cycle, cargo) ?? cycle.offices[0]
  const effectiveTurn: Turn = office.hasRunoff ? turn : 1
  const target = { cycle, ids, office, turn: effectiveTurn }
  const { byUf } = useUfResults(target)
  const national = useResult(target, 'br')

  const ufs = UFS.map((u) => ({ uf: u, r: byUf[u.sigla] }))
  const finals = ufs.filter((x) => x.r?.final).length
  const aguardando = ufs.every((x) => !x.r)
  const today = todayBrasilia()

  const fill = (code: string) => {
    const r = byUf[UF_BY_IBGE[code].sigla]
    if (!r) return '#ffffff'
    if (r.final) return '#FDB035'
    return `color-mix(in srgb, var(--tse-primary) ${Math.round(r.sectionsPct)}%, #ffffff)`
  }

  return (
    <div className="flex h-full flex-col">
      <Cabecalho cycle={cycle} local="Brasil" cargo={`Acompanhamento geral, ${office.name}`} turno={office.hasRunoff ? effectiveTurn : undefined} />
      <div className="grid flex-1 grid-cols-[1fr_1.05fr] gap-5 px-10 pt-5 pb-6">
        <div className="relative mx-auto w-full max-w-[540px]">
          <ChoroplethMap src="/geo/br-uf.json" label="Totalização por UF" fill={fill} name={(code) => UF_BY_IBGE[code].nome} />
          <div className="absolute top-2 left-0 rounded-[20px] bg-white p-3 shadow-[0_1px_3px_rgb(0_0_0/0.06)]">
            <p className="text-[15px] font-bold text-black">Legenda</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-4 w-4 rounded-[3px] bg-[#FDB035]" />
              <span className="text-[13px] font-bold text-[#767676]">Final</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-16 w-4 rounded-[3px] border border-[#BDAED1]"
                style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, var(--tse-primary) 100%)' }}
              />
              <span className="text-[12px] leading-tight font-bold text-[#767676]">
                Totalização
                <br />
                parcial
                <br />0 a 100%
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          {office.scope === 'br' ? (
            <CartaoTotalizacao
              result={national.data}
              aguardando={!national.data}
              atualizando={national.isFetching}
              onAtualizar={() => national.refetch()}
              inicio={cycle.dates[effectiveTurn].split('-').reverse().join('/')}
            />
          ) : (
            <section className="rounded-2xl bg-white px-5 py-4 shadow-[0_1px_3px_rgb(0_0_0/0.06)]">
              <p className="text-[20px] font-bold text-[#222]">
                {finals} de 27 UFs com totalização final
              </p>
              <p className="text-[13px] font-bold text-[var(--tse-primary)]">(Horário de Brasília)</p>
            </section>
          )}
          <section className="grid grid-cols-3 content-start gap-x-4 gap-y-[7px] rounded-2xl bg-white px-5 py-4 shadow-[0_1px_3px_rgb(0_0_0/0.06)]">
            {ufs.map(({ uf, r }) => (
              <div key={uf.sigla}>
                <div className="flex justify-between text-[12px] leading-tight">
                  <span className="font-bold text-[#333]">{uf.sigla}</span>
                  <span className={cn('font-semibold tabular', r?.final ? 'text-[#c98400]' : 'text-[#555]')}>
                    {r ? fmtPct(r.sectionsPct) : '-'}
                  </span>
                </div>
                <div className="mt-0.5 h-[4px] overflow-hidden rounded-full bg-[#e3e5ea]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r?.sectionsPct ?? 0}%`,
                      background: r?.final ? '#FDB035' : 'linear-gradient(to right, #ffdb05, var(--tse-primary-alt) 93%)',
                    }}
                  />
                </div>
              </div>
            ))}
          </section>
          {aguardando && today < cycle.dates[1] && (
            <p className="text-center text-[13px] font-semibold text-[#666]">
              Divulgação a partir das 17h do dia da votação (horário de Brasília)
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
