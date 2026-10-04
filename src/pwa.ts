/// <reference types="vite-plugin-pwa/client" />
// Atualização automática do app: procura versão nova a cada minuto e ao voltar para a
// aba. Quando há, o service worker novo assume, apaga os caches antigos e a página
// recarrega sozinha, sem ação de quem está usando (inclusive o telão).
import { registerSW } from 'virtual:pwa-register'

/** Caches de versões anteriores que não existem mais (dados do TSE não são guardados). */
const OBSOLETE_CACHES = ['tse-dados']

export function registerPwa() {
  if (!('serviceWorker' in navigator)) return

  if ('caches' in window) {
    for (const name of OBSOLETE_CACHES) caches.delete(name).catch(() => {})
  }

  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      const check = async () => {
        if (registration.installing || !navigator.onLine) return
        try {
          // Sem cache do navegador: garante que o sw.js novo seja percebido.
          const res = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
          if (res.status === 200) await registration.update()
        } catch {
          /* sem conexão: tenta de novo no próximo ciclo */
        }
      }
      setInterval(check, 60_000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
