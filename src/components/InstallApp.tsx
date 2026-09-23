// Instalação do aplicativo (PWA).
//  - Chrome, Edge e Android oferecem a instalação sozinhos (botão "Instalar" na barra de
//    endereço, aviso "Adicionar à tela inicial"). O portal não intercepta esse convite.
//  - iPhone/iPad (Safari) não têm oferta nativa: este aviso aparece ao acessar e mostra o
//    caminho pelo Compartilhar. Não reaparece por 7 dias depois de fechado.
import { Export, PlusSquare, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

const KEY = 'instalar.dispensado'
const INTERVALO = 7 * 24 * 60 * 60 * 1000
const ATRASO_IOS = 2500

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIosSafari = () => {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
}

function dispensadoRecentemente() {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < INTERVALO
  } catch {
    return false
  }
}

export function InstallApp() {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (isStandalone() || dispensadoRecentemente() || !isIosSafari()) return
    const t = window.setTimeout(() => setAberto(true), ATRASO_IOS)
    return () => window.clearTimeout(t)
  }, [])

  const dispensar = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* armazenamento indisponível */
    }
    setAberto(false)
  }

  if (!aberto) return null

  return (
    <div
      role="dialog"
      aria-labelledby="instalar-titulo"
      aria-describedby="instalar-texto"
      className="install-sheet fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-line bg-surface p-4 shadow-[0_18px_48px_rgb(17_20_24/0.24)] sm:inset-x-auto sm:right-5 sm:bottom-5"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p id="instalar-titulo" className="font-semibold">
            Instale o Apuração Brasil
          </p>
          <p id="instalar-texto" className="mt-0.5 text-sm leading-snug text-muted">
            Acesso direto da tela inicial e resultados em tela cheia no dia da eleição.
          </p>
        </div>
        <button
          type="button"
          onClick={dispensar}
          className="-mt-1 -mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

        <ol className="mt-3 space-y-2 rounded-md bg-surface-2 p-3 text-sm">
          <li className="flex items-center gap-2.5">
            <Export className="h-5 w-5 shrink-0" aria-hidden />
            <span>
              Toque em <strong>Compartilhar</strong> na barra do Safari.
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <PlusSquare className="h-5 w-5 shrink-0" aria-hidden />
            <span>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </span>
          </li>
        </ol>
    </div>
  )
}
