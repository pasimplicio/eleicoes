import { ArrowRight, BarChart3, Database, MapPinned, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Countdown } from '../components/Countdown'
import { NationalExplorer } from '../components/results/NationalExplorer'
import { Card, LiveBadge, Segmented, SectionTitle } from '../components/ui'
import type { Turn } from '../config/elections'
import { fmtDateLong } from '../lib/format'
import { resultsStart, useFeaturedCycle } from '../lib/phase'

export function Home() {
  const f = useFeaturedCycle()
  const offices = f.display.offices.filter((o) => o.system === 'majoritario')
  const [officeSlug, setOfficeSlug] = useState(offices[0].slug)
  const office = offices.find((o) => o.slug === officeSlug) ?? offices[0]
  const [turnChoice, setTurn] = useState<Turn | null>(null)
  const turn: Turn = office.hasRunoff ? (turnChoice ?? f.turn) : 1

  const nextDate = f.cycle.dates[1]

  return (
    <>
      {/* Capa */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60% 80% at 85% 10%, rgba(245,183,0,0.18), transparent 60%), radial-gradient(50% 60% at 10% 100%, rgba(43,123,214,0.25), transparent 60%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {f.live && <LiveBadge />}
              <span className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
                Eleições {f.cycle.kind === 'geral' ? 'Gerais' : 'Municipais'} {f.cycle.year}
              </span>
            </div>
            <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              {f.started ? 'Apuração em tempo real, voto a voto.' : 'O Brasil vai às urnas. Acompanhe cada voto aqui.'}
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
              Resultados oficiais do Tribunal Superior Eleitoral em mapas interativos por estado e município, com as
              pesquisas registradas na Justiça Eleitoral.
            </p>
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div>
                <dt className="text-white/55">1º turno</dt>
                <dd className="text-lg font-semibold">{fmtDateLong(f.cycle.dates[1])}</dd>
              </div>
              <div>
                <dt className="text-white/55">2º turno</dt>
                <dd className="text-lg font-semibold">{fmtDateLong(f.cycle.dates[2])}</dd>
              </div>
            </dl>
          </div>

          {!f.started && (
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur sm:p-6">
              <p className="mb-4 text-sm font-medium text-white/70">A divulgação dos resultados começa em</p>
              <Countdown to={resultsStart(nextDate)} />
              <p className="mt-4 text-xs text-white/50">
                Às 17h (Brasília) de {fmtDateLong(nextDate)}, quando as urnas fecham em todo o país.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Resultados */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Card className="-mt-6 relative shadow-sm sm:-mt-8">
          <SectionTitle
            kicker={f.started ? `Resultados ${f.display.year}` : `Referência · Eleições ${f.display.year}`}
            title={f.started ? 'Como o Brasil está votando' : `Como o Brasil votou em ${f.display.year}`}
          />
          {!f.started && (
            <p className="-mt-2 mb-5 max-w-3xl text-sm text-muted">
              Enquanto a apuração de {f.cycle.year} não começa, veja o resultado final da última eleição{' '}
              {f.display.kind === 'geral' ? 'geral' : 'municipal'}. No dia da votação, este painel passa a mostrar os
              números de {f.cycle.year} ao vivo.
            </p>
          )}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Segmented
              label="Cargo"
              value={office.slug}
              onChange={setOfficeSlug}
              options={offices.map((o) => ({ value: o.slug, label: o.name }))}
            />
            {office.hasRunoff && (
              <Segmented<Turn>
                label="Turno"
                value={turn}
                onChange={setTurn}
                options={[
                  { value: 1, label: '1º turno' },
                  { value: 2, label: '2º turno', disabled: !f.displayIds?.[2] },
                ]}
              />
            )}
            <Link
              to={`/${f.display.year}/${office.slug}?turno=${turn}`}
              className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
            >
              Página completa <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <NationalExplorer cycle={f.display} ids={f.displayIds} office={office} turn={turn} />
        </Card>

        {/* Pesquisas */}
        <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Pesquisas eleitorais</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
              Só pesquisas registradas na Justiça Eleitoral
            </h2>
            <p className="mt-3 text-ink-2">
              Toda pesquisa divulgada precisa de registro prévio no TSE, com instituto, contratante, amostra, margem de
              erro e questionário. Aqui você encontra esse registro oficial ao lado dos números.
            </p>
            <Link
              to="/pesquisas"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-2"
            >
              Explorar pesquisas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: 'Registro verificado', d: 'Cada pesquisa exibe o número de registro no TSE e o link para conferência.' },
              { icon: BarChart3, t: 'Evolução e média', d: 'Tendência por instituto e média ponderada ao longo da campanha.' },
              { icon: MapPinned, t: 'Por estado e cargo', d: 'Filtre por UF, cargo e instituto em segundos.' },
              { icon: Database, t: 'Dados abertos', d: 'Metodologia e fontes públicas, sem enquetes nem números sem origem.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-line bg-surface p-5">
                <Icon className="h-5 w-5 text-brand-2 dark:text-accent" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
