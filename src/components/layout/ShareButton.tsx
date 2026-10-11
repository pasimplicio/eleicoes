// Compartilhar: abre um painel com a prévia da mensagem de apresentação do site (formato do
// WhatsApp) e as opções de envio. O link leva à página inicial.
import { Check, Copy, Export, ShareNetwork, WhatsappLogo, X } from '@phosphor-icons/react'
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../lib/format'
import { useFeaturedCycle } from '../../lib/phase'
import { siteMessage } from '../../lib/share'


/** Mostra *negrito* do WhatsApp como negrito de verdade na prévia. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/).map((part, i) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <strong key={i} className="font-semibold">
            {part.slice(1, -1)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export function ShareButton() {
  const message = siteMessage(useFeaturedCycle())
  const { pathname } = useLocation()
  // Fecha ao trocar de página: guarda em qual página o painel abriu.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenAt(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenAt(null)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(t)
  }, [copied])

  const url = () => `${window.location.origin}/`
  const full = () => `${message}\n\nAcesse: ${url()}`

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(full())}`, '_blank', 'noopener')
    setOpenAt(null)
  }
  const nativeShare = async () => {
    try {
      // Sem "url" separado: alguns apps repetem o link. Ele já vai no fim do texto.
      await navigator.share({ text: full() })
      setOpenAt(null)
    } catch {
      /* cancelado pelo usuário */
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full())
      setCopied(true)
    } catch {
      window.prompt('Copie a mensagem:', full())
    }
  }
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const action =
    'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors'

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpenAt(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-ink-2 transition hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
        )}
        aria-label="Compartilhar esta página"
        title="Compartilhar esta página"
      >
        <ShareNetwork className="h-5 w-5" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        role="dialog"
        aria-label="Compartilhar"
        className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+6.5rem)] z-40 rounded-lg border border-line bg-surface p-4 shadow-[0_18px_40px_rgb(17_20_24/0.18)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[24rem]"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Compartilhar</p>
          <button
            type="button"
            onClick={() => setOpenAt(null)}
            className="-mr-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-1.5 text-xs text-muted">Prévia da mensagem</p>
        <div className="max-h-64 overflow-y-auto rounded-lg rounded-tl-sm border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line text-ink">
          <Bold text={message} />
          {'\n\n'}Acesse: <span className="break-all text-ink-2 underline underline-offset-2">{open ? url() : ''}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={whatsapp} className={cn(action, 'bg-[#1f7a4d] text-white hover:bg-[#19663f]')}>
            <WhatsappLogo className="h-5 w-5" weight="fill" aria-hidden /> WhatsApp
          </button>
          <button type="button" onClick={copy} className={cn(action, 'border border-line bg-surface hover:bg-surface-2')}>
            {copied ? <Check className="h-5 w-5 text-ok" weight="bold" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
            {copied ? 'Copiada' : 'Copiar'}
          </button>
          {canShare && (
            <button type="button" onClick={nativeShare} className={cn(action, 'border border-line bg-surface hover:bg-surface-2')}>
              <Export className="h-5 w-5" aria-hidden /> Outros apps
            </button>
          )}
        </div>
        <p role="status" className="sr-only">
          {copied ? 'Mensagem copiada' : ''}
        </p>
      </div>
    </div>
  )
}
