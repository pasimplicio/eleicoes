import { Plus, Trash } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentYear, getCycle, KNOWN_IDS } from '../config/elections'
import { UFS } from '../config/ufs'
import { loadTelaoConfig, saveTelaoConfig, type TelaoConfig } from '../lib/telao'

const CARGOS = [
  { slug: 'presidente', label: 'Presidente', brasil: true },
  { slug: 'governador', label: 'Governador', brasil: false },
  { slug: 'senador', label: 'Senador', brasil: false },
]

export function TelaoConfig() {
  const navigate = useNavigate()
  const [c, setC] = useState<TelaoConfig>(loadTelaoConfig)
  const id = useId()
  const now = currentYear()
  const anos = [...new Set([now, ...Object.keys(KNOWN_IDS).map(Number)])]
    .filter((y) => getCycle(y)?.kind === 'geral')
    .sort((a, b) => b - a)

  const set = (patch: Partial<TelaoConfig>) => setC((prev) => ({ ...prev, ...patch }))
  const setAbr = (i: number, patch: Partial<TelaoConfig['abrangencias'][number]>) =>
    set({ abrangencias: c.abrangencias.map((a, j) => (j === i ? { ...a, ...patch } : a)) })

  const iniciar = () => {
    saveTelaoConfig(c)
    navigate('/telao')
  }

  const field = 'min-h-11 w-full rounded-lg border border-[#cfd5e3] bg-white px-3 text-[15px] text-[#222]'

  return (
    <div className="telao min-h-dvh">
      <header className="bg-[var(--tse-secundary)] px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[28px] font-bold text-[var(--tse-primary)]">Configurar telão</h1>
          <p className="mt-1 text-[15px] text-[var(--tse-primary)]/80">
            Escolha o que o telão exibe em rodízio. A configuração fica salva neste navegador.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <section className="grid gap-5 rounded-2xl bg-white p-6 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-ano`} className="mb-1.5 block text-[14px] font-bold text-[#333]">
              Eleição
            </label>
            <select id={`${id}-ano`} className={field} value={c.ano} onChange={(e) => set({ ano: Number(e.target.value) })}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  Eleições Gerais {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-seg`} className="mb-1.5 block text-[14px] font-bold text-[#333]">
              Segundos em cada tela
            </label>
            <input
              id={`${id}-seg`}
              type="number"
              min={5}
              max={300}
              className={field}
              value={c.segundos}
              onChange={(e) => set({ segundos: Math.max(5, Number(e.target.value) || 15) })}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--tse-primary)]"
              checked={c.mostrarAcompanhamentoGeral}
              onChange={(e) => set({ mostrarAcompanhamentoGeral: e.target.checked })}
            />
            <span className="text-[15px] text-[#333]">
              Mostrar o acompanhamento geral (mapa da totalização por UF) antes de cada tela
            </span>
          </label>
        </section>

        <section className="rounded-2xl bg-white p-6">
          <h2 className="text-[18px] font-bold text-[#222]">Telas de resultado</h2>
          <ul className="mt-4 space-y-3">
            {c.abrangencias.map((a, i) => {
              const cargo = CARGOS.find((x) => x.slug === a.cargo) ?? CARGOS[0]
              return (
                <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                  <div>
                    <label htmlFor={`${id}-c${i}`} className="mb-1 block text-[13px] font-semibold text-[#555]">
                      Cargo
                    </label>
                    <select
                      id={`${id}-c${i}`}
                      className={field}
                      value={a.cargo}
                      onChange={(e) => {
                        const next = CARGOS.find((x) => x.slug === e.target.value)!
                        setAbr(i, { cargo: next.slug, uf: next.brasil ? a.uf : a.uf === 'BR' ? 'SP' : a.uf })
                      }}
                    >
                      {CARGOS.map((x) => (
                        <option key={x.slug} value={x.slug}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${id}-u${i}`} className="mb-1 block text-[13px] font-semibold text-[#555]">
                      Local
                    </label>
                    <select id={`${id}-u${i}`} className={field} value={a.uf} onChange={(e) => setAbr(i, { uf: e.target.value })}>
                      {cargo.brasil && <option value="BR">Brasil</option>}
                      {UFS.map((u) => (
                        <option key={u.sigla} value={u.sigla}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={c.abrangencias.length === 1}
                    onClick={() => set({ abrangencias: c.abrangencias.filter((_, j) => j !== i) })}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#cfd5e3] text-[#666] disabled:opacity-40"
                    aria-label="Remover tela"
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => set({ abrangencias: [...c.abrangencias, { cargo: 'governador', uf: 'SP' }] })}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--tse-primary)] px-4 text-[14px] font-bold text-[var(--tse-primary)]"
          >
            <Plus weight="bold" className="h-4 w-4" /> Adicionar tela
          </button>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={iniciar}
            className="min-h-12 rounded-lg bg-[var(--tse-primary)] px-8 text-[16px] font-bold text-white"
          >
            Iniciar telão
          </button>
        </div>
      </main>
    </div>
  )
}
