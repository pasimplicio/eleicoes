// Botão "Instalar app": usa o convite nativo do navegador (Chrome, Edge, Android) e, no
// iPhone/iPad, onde não existe convite, explica o caminho pelo menu Compartilhar.
// Some quando o portal já está aberto como aplicativo instalado.
import { DeviceMobile, Export, PlusSquare, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/format'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function InstallApp({ className }: { className?: string }) {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalado, setInstalado] = useState(isStandalone)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const ios = isIos()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvento(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalado(true)
      setEvento(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (instalado || (!evento && !ios)) return null

  const instalar = async () => {
    if (evento) {
      await evento.prompt()
      const { outcome } = await evento.userChoice
      if (outcome === 'accepted') setInstalado(true)
      setEvento(null)
    } else {
      dialogRef.current?.showModal()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={instalar}
        aria-label="Instalar o aplicativo"
        className={cn(
          'inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-page transition hover:bg-ink-2 active:translate-y-px',
          className,
        )}
      >
        <DeviceMobile className="h-4 w-4" aria-hidden />
        <span className="lg:hidden xl:inline">Instalar app</span>
      </button>

      {ios && (
        <dialog
          ref={dialogRef}
          aria-labelledby="instalar-titulo"
          className="m-auto w-[min(92vw,26rem)] rounded-lg border border-line bg-surface p-6 text-ink backdrop:bg-black/50"
          onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id="instalar-titulo" className="font-serif text-2xl font-semibold tracking-tight">
              Instalar no iPhone
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ol className="mt-5 space-y-4 text-[15px]">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <Export className="h-5 w-5" aria-hidden />
              </span>
              <span>
                No Safari, toque em <strong>Compartilhar</strong>.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <PlusSquare className="h-5 w-5" aria-hidden />
              </span>
              <span>
                Escolha <strong>Adicionar à Tela de Início</strong> e confirme.
              </span>
            </li>
          </ol>
          <p className="mt-5 text-sm text-muted">O Apuração Brasil abre em tela cheia, como um aplicativo.</p>
        </dialog>
      )}
    </>
  )
}
