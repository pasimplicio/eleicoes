// Mapa das seções eleitorais (Leaflet + OpenStreetMap): um marcador por seção, no local de
// votação informado pelo TSE. Ao clicar, a página busca o boletim de urna daquela seção
// (api/secao) e mostra os votos para presidente no turno escolhido.
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Container, Segmented } from '../components/ui'
import { findOffice, type Turn } from '../config/elections'
import { partyColor } from '../config/parties'
import { findUf, UFS } from '../config/ufs'
import { fmtInt, fmtPct } from '../lib/format'
import { useFeaturedCycle } from '../lib/phase'
import { useMunicipalities, useResult } from '../lib/tse/queries'

/** [seção, aptos, seção principal (se agregada)] */
type Sec = [number, number, number?]
/** [local, nome, endereço, bairro, lat, lng, zona, seções] */
type Local = [number, string, string, string, number, number, number, Sec[]]

interface SecaoResultado {
  turno: number
  aptos: number
  comparecimento: number
  nominais: { numero: number; partido: number; votos: number }[]
  brancos: number
  nulos: number
  emissao: string
  recebimento?: string
  erro?: string
}

const BASES: { name: string; url: string; attribution: string; subdomains?: string; maxZoom?: number }[] = [
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    name: 'OSM Humanitário',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; colaboradores do OpenStreetMap, estilo HOT, hospedagem OSM France',
    subdomains: 'abc',
    maxZoom: 19,
  },
  {
    name: 'OpenTopoMap (relevo)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; colaboradores do OpenStreetMap, SRTM | estilo &copy; OpenTopoMap (CC-BY-SA)',
    subdomains: 'abc',
    maxZoom: 17,
  },
  {
    name: 'Claro (CARTO)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; colaboradores do OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  {
    name: 'Escuro (CARTO)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; colaboradores do OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const titleish = (s: string) => s.trim().replace(/\s+/g, ' ')

export function SectionsMapPage() {
  const { cycle, ids } = useFeaturedCycle()
  const [params, setParams] = useSearchParams()
  const uf = findUf(params.get('uf') ?? '') ?? findUf('DF')!
  const turno: Turn = params.get('turno') === '2' ? 2 : 1
  const { data: municipios } = useMunicipalities(uf.sigla)
  const capital = municipios?.find((m) => m.capital)
  const mun = municipios?.find((m) => m.tse === params.get('mun')) ?? capital ?? municipios?.[0]

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true, preventScrollReset: true })
  }

  // Nomes e partidos dos candidatos a presidente, pelo resultado nacional do turno.
  const presidente = findOffice(cycle, 'presidente')!
  const nacional = useResult({ cycle, ids, office: presidente, turn: turno }, 'br')
  const nacional1 = useResult({ cycle, ids, office: presidente, turn: 1 }, 'br')
  const nomes = useMemo(() => {
    const m = new Map<number, { name: string; party: string }>()
    for (const c of [...(nacional1.data?.candidates ?? []), ...(nacional.data?.candidates ?? [])]) {
      m.set(Number(c.number), { name: c.name, party: c.party })
    }
    return m
  }, [nacional.data, nacional1.data])

  const secoes = useQuery({
    queryKey: ['secoes', cycle.year, uf.sigla, mun?.tse],
    enabled: Boolean(mun),
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(`/data/secoes-${cycle.year}/${uf.sigla.toLowerCase()}/${mun!.tse}.json`)
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return { locais: [] as Local[] }
      return (await res.json()) as { locais: Local[] }
    },
  })

  const totalSecoes = useMemo(
    () => (secoes.data?.locais ?? []).reduce((n, l) => n + l[7].filter((s) => !s[2]).length, 0),
    [secoes.data],
  )

  return (
    <Container className="py-8 sm:py-10">
      <header className="max-w-3xl">
        <p className="text-sm text-muted">Eleições gerais de {cycle.year}, presidente</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Mapa das seções</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Cada ponto é uma seção eleitoral, no seu local de votação. Toque num ponto para ver os votos daquela urna,
          tirados do boletim de urna oficial do TSE.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <Select
          label="Estado"
          value={uf.sigla}
          onChange={(v) => set({ uf: v.toLowerCase(), mun: undefined })}
          options={UFS.map((u) => ({ value: u.sigla, label: u.nome }))}
        />
        <Select
          label="Município"
          value={mun?.tse ?? ''}
          onChange={(v) => set({ mun: v })}
          options={(municipios ?? []).map((m) => ({ value: m.tse, label: m.nome }))}
          wide
        />
        <div>
          <p className="mb-1.5 text-sm font-medium">Turno</p>
          <Segmented<Turn>
            label="Turno"
            value={turno}
            onChange={(t) => set({ turno: t === 2 ? '2' : undefined })}
            options={[
              { value: 1, label: '1º turno' },
              { value: 2, label: '2º turno' },
            ]}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {secoes.isLoading
          ? 'Carregando seções…'
          : `${fmtInt(totalSecoes)} seções em ${fmtInt(secoes.data?.locais.length ?? 0)} locais de votação${mun ? ` em ${mun.nome}` : ''}.`}
        {turno === 2 && ' Os boletins do 2º turno aparecem depois da votação de 25 de outubro.'}
      </p>

      <SectionsMap locais={secoes.data?.locais ?? []} uf={uf.sigla} mun={mun?.tse} turno={turno} nomes={nomes} />

      <p className="mt-3 text-xs text-muted">
        Locais e coordenadas: dados abertos do TSE (locais de votação). Votos: boletins de urna publicados pelo TSE. Seções
        agregadas não têm urna própria; seus votos estão no boletim da seção principal.
      </p>
    </Container>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  wide?: boolean
}) {
  const id = useId()
  return (
    <div className={wide ? 'min-w-56' : 'min-w-44'}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full cursor-pointer rounded-md border border-line bg-surface px-3 text-base sm:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SectionsMap({
  locais,
  uf,
  mun,
  turno,
  nomes,
}: {
  locais: Local[]
  uf: string
  mun?: string
  turno: Turn
  nomes: Map<number, { name: string; party: string }>
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const cluster = useRef<L.MarkerClusterGroup | null>(null)
  // O clique usa sempre o turno e os nomes atuais, sem recriar os marcadores.
  const ctx = useRef({ uf, mun, turno, nomes })
  ctx.current = { uf, mun, turno, nomes }

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { center: [-15.78, -47.93], zoom: 4 })
    const layers = Object.fromEntries(
      BASES.map((b) => [b.name, L.tileLayer(b.url, { attribution: b.attribution, subdomains: b.subdomains ?? 'abc', maxZoom: b.maxZoom })]),
    )
    layers[BASES[0].name].addTo(m)
    L.control.layers(layers, undefined, { position: 'topright' }).addTo(m)
    L.control.scale({ imperial: false }).addTo(m)
    cluster.current = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 48, spiderfyOnMaxZoom: true, showCoverageOnHover: false })
    m.addLayer(cluster.current)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      cluster.current = null
    }
  }, [])

  // Turno trocado: fecha o boletim aberto (era do outro turno).
  useEffect(() => {
    map.current?.closePopup()
  }, [turno])

  useEffect(() => {
    const m = map.current
    const group = cluster.current
    if (!m || !group) return
    group.clearLayers()
    m.closePopup()
    if (!locais.length) return
    const markers: L.Layer[] = []
    const bounds = L.latLngBounds([])
    for (const l of locais) {
      const [, nome, endereco, bairro, lat, lng, zona, secs] = l
      const latlng = L.latLng(lat, lng)
      bounds.extend(latlng)
      for (const s of secs) {
        if (s[2]) continue // agregada: votos no boletim da principal
        const agregadas = secs.filter((x) => x[2] === s[0]).map((x) => x[0])
        const marker = L.circleMarker(latlng, {
          radius: 7,
          weight: 2,
          color: '#ffffff',
          fillColor: '#0e7c66',
          fillOpacity: 0.9,
        })
        marker.bindPopup('', { maxWidth: 320, minWidth: 260 })
        marker.on('popupopen', (e) => openSection(e.popup, { nome, endereco, bairro, zona, secao: s[0], aptos: s[1], agregadas }))
        markers.push(marker)
      }
    }
    group.addLayers(markers)
    m.fitBounds(bounds.pad(0.08), { maxZoom: 15 })
  }, [locais])

  async function openSection(
    popup: L.Popup,
    info: { nome: string; endereco: string; bairro: string; zona: number; secao: number; aptos: number; agregadas: number[] },
  ) {
    const { uf, mun, turno, nomes } = ctx.current
    const head = `<div class="secao-pop">
      <p class="sp-local">${esc(titleish(info.nome))}</p>
      <p class="sp-end">${esc(titleish(info.endereco))}${info.bairro ? `, ${esc(titleish(info.bairro))}` : ''}</p>
      <p class="sp-id">Zona ${info.zona}, seção ${info.secao}${info.agregadas.length ? ` (inclui ${info.agregadas.join(', ')})` : ''} · ${turno}º turno</p>`
    popup.setContent(`${head}<p class="sp-msg">Carregando o boletim de urna…</p></div>`)
    try {
      const res = await fetch(`/api/secao?${new URLSearchParams({ uf: uf.toLowerCase(), mun: mun!, zona: String(info.zona), secao: String(info.secao), turno: String(turno) })}`)
      const d = (await res.json()) as SecaoResultado
      if (!res.ok || d.erro) {
        popup.setContent(`${head}<p class="sp-msg">${esc(d.erro ?? 'Boletim indisponível.')}</p></div>`)
        return
      }
      const validos = d.nominais.reduce((n, c) => n + c.votos, 0) || 1
      const rows = d.nominais
        .map((c, i) => {
          const who = nomes.get(c.numero)
          const party = who?.party ?? String(c.partido)
          const pct = (c.votos / validos) * 100
          return `<li>
            <span class="sp-name"><i style="background:${partyColor(party, i)}"></i>${esc(who?.name ?? `Candidato ${c.numero}`)} <em>${esc(party)}</em></span>
            <span class="sp-v"><b>${fmtInt(c.votos)}</b> ${fmtPct(pct)}</span>
            <span class="sp-bar"><span style="width:${pct}%;background:${partyColor(party, i)}"></span></span>
          </li>`
        })
        .join('')
      popup.setContent(`${head}
        <ul class="sp-list">${rows}</ul>
        <dl class="sp-tot">
          <div><dt>Brancos</dt><dd>${fmtInt(d.brancos)}</dd></div>
          <div><dt>Nulos</dt><dd>${fmtInt(d.nulos)}</dd></div>
          <div><dt>Compareceram</dt><dd>${fmtInt(d.comparecimento)} de ${fmtInt(d.aptos)}</dd></div>
        </dl>
        <p class="sp-foot">Boletim emitido em ${esc(d.emissao)}. Percentuais sobre os votos válidos da seção.</p>
      </div>`)
      popup.update()
    } catch {
      popup.setContent(`${head}<p class="sp-msg">Não foi possível carregar o boletim. Tente de novo.</p></div>`)
    }
  }

  return (
    <div
      ref={el}
      className="secoes-map mt-4 h-[70dvh] min-h-[420px] w-full overflow-hidden rounded-lg border border-line"
      role="region"
      aria-label="Mapa das seções eleitorais"
    />
  )
}
