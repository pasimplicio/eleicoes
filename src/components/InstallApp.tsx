// Oferta de instalação do aplicativo (PWA), exibida automaticamente ao acessar.
// O Chrome no Android nem sempre mostra a própria oferta (decide o momento, respeita
// dispensas anteriores) e navegadores internos (WhatsApp, Instagram...) não instalam.
// Por isso o portal oferece em todos os casos:
//  - convite nativo disponível (Chrome, Edge, Samsung Internet): botão "Instalar" (um toque);
//  - navegador interno de outro app: orienta a abrir no Chrome;
//  - Android sem convite: caminho pelo menu do navegador;
//  - iPhone/iPad (Safari): caminho pelo Compartilhar.
// No computador sem convite, nada aparece: o navegador mostra "Instalar" na barra de endereço.
// Não aparece quando já instalado nem por 7 dias depois de fechado.
import { DotsThreeVertical, DownloadSimple, Export, PlusSquare, X } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Modo = 'nativo' | 'ios' | 'interno' | 'android'

const KEY = 'instalar.dispensado'
const INTERVALO = 7 * 24 * 60 * 60 * 1000
const ESPERA = 3500

const ua = () => navigator.userAgent
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isAndroid = () => /android/i.test(ua())
/** Navegadores embutidos em outros apps, onde não há instalação. */
const isInterno = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|TikTok|; wv\)/i.test(ua())

function dispensadoRecentemente() {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < INTERVALO
  } catch {
    return false
  }
}

export function InstallApp() {
  const [modo, setModo] = useState<Modo | null>(null)
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || dispensadoRecentemente()) return
    let recebido = false
    const onPrompt = (e: Event) => {
      e.preventDefault()
      recebido = true
      setEvento(e as BeforeInstallPromptEvent)
      setModo('nativo')
    }
    const onInstalled = () => setModo(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Sem convite nativo depois de alguns segundos: orientação conforme o aparelho.
    const t = window.setTimeout(() => {
      if (recebido) return
      if (isIos()) setModo(isInterno() ? 'interno' : 'ios')
      else if (isAndroid()) setModo(isInterno() ? 'interno' : 'android')
    }, ESPERA)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(t)
    }
  }, [])

  const dispensar = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* armazenamento indisponível */
    }
    setModo(null)
  }

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    if (outcome === 'dismissed') dispensar()
    else setModo(null)
  }

  if (!modo) return null

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
            {modo === 'interno'
              ? 'Para instalar, abra esta página no navegador do celular.'
              : 'Acesso direto da tela inicial e resultados em tela cheia no dia da eleição.'}
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

      {modo === 'nativo' ? (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={dispensar}
            className="min-h-11 cursor-pointer rounded-md px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={instalar}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-ink px-5 text-sm font-semibold text-page hover:bg-ink-2 active:translate-y-px"
          >
            <DownloadSimple weight="bold" className="h-4 w-4" aria-hidden />
            Instalar
          </button>
        </div>
      ) : (
        <ol className="mt-3 space-y-2 rounded-md bg-surface-2 p-3 text-sm">
          {modo === 'ios' && (
            <>
              <Passo icone={<Export className="h-5 w-5" />}>
                Toque em <strong>Compartilhar</strong> na barra do Safari.
              </Passo>
              <Passo icone={<PlusSquare className="h-5 w-5" />}>
                Escolha <strong>Adicionar à Tela de Início</strong>.
              </Passo>
            </>
          )}
          {modo === 'android' && (
            <>
              <Passo icone={<DotsThreeVertical weight="bold" className="h-5 w-5" />}>
                Toque no menu <strong>⋮</strong> do navegador.
              </Passo>
              <Passo icone={<DownloadSimple className="h-5 w-5" />}>
                Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
              </Passo>
            </>
          )}
          {modo === 'interno' && (
            <>
              <Passo icone={<DotsThreeVertical weight="bold" className="h-5 w-5" />}>
                Toque no menu <strong>⋮</strong> ou <strong>…</strong> no canto da tela.
              </Passo>
              <Passo icone={<Export className="h-5 w-5" />}>
                Escolha <strong>Abrir no navegador</strong> ({isIos() ? 'Safari' : 'Chrome'}) e instale por lá.
              </Passo>
            </>
          )}
        </ol>
      )}
    </div>
  )
}

function Passo({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="shrink-0" aria-hidden>
        {icone}
      </span>
      <span>{children}</span>
    </li>
  )
}
