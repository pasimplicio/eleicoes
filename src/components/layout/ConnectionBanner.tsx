// Aviso quando a conexão cai: os números na tela continuam os últimos recebidos e
// voltam a se atualizar sozinhos quando a internet volta (o TanStack Query refaz as consultas).
import { WifiSlash } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { Container } from '../ui'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export function ConnectionBanner() {
  const online = useOnline()
  const client = useQueryClient()
  if (online) return null

  // Momento do último dado recebido, entre todas as consultas em cache.
  const last = Math.max(0, ...client.getQueryCache().getAll().map((q) => q.state.dataUpdatedAt))

  return (
    <div role="status" className="border-b border-line bg-surface-2 text-ink">
      <Container className="flex min-h-10 items-center gap-2.5 py-2 text-sm">
        <WifiSlash className="h-4 w-4 shrink-0 text-live" weight="bold" aria-hidden />
        <span>
          <strong className="font-semibold">Sem conexão.</strong>{' '}
          {last ? `Mostrando os números recebidos às ${hhmm(last)}.` : 'Mostrando os últimos números salvos.'}{' '}
          <span className="text-muted">A página se atualiza sozinha quando a internet voltar.</span>
        </span>
      </Container>
    </div>
  )
}
