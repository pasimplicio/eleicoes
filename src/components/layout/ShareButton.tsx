// Compartilha a página atual com tudo o que está na URL (cargo, turno, estado, região).
// No celular abre o menu nativo (WhatsApp, Telegram...); no computador copia o link.
import { Check, ShareNetwork } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

export function ShareButton() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(t)
  }, [copied])

  const share = async () => {
    const url = window.location.href
    const title = document.title
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Copie o link desta página:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-ink-2 transition hover:bg-surface-2 hover:text-ink"
      aria-label="Compartilhar esta página"
      title="Compartilhar esta página"
    >
      {copied ? <Check className="h-5 w-5 text-ok" weight="bold" /> : <ShareNetwork className="h-5 w-5" />}
      <span
        role="status"
        className={`pointer-events-none absolute top-full right-0 mt-1 rounded-md bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-page shadow-md transition-opacity ${copied ? 'opacity-100' : 'opacity-0'}`}
      >
        {copied ? 'Link copiado' : ''}
      </span>
    </button>
  )
}
