import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Em desenvolvimento, executa as funções de api/*.ts como a Vercel faz em produção. */
function devApi(names: string[]): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      for (const name of names) {
        server.middlewares.use(`/api/${name}`, async (req, res) => {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const url = new URL(req.originalUrl ?? '', `http://${req.headers.host}`)
          const response: Response = await mod.GET(new Request(url))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devApi(['municipios', 'votos-municipio', 'secao']),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro feito em src/pwa.ts, que procura versão nova a cada minuto.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Apuração Brasil | Eleições',
        short_name: 'Apuração',
        description: 'Resultados e mapas das eleições com dados oficiais do TSE.',
        lang: 'pt-BR',
        theme_color: '#111418',
        background_color: '#f3f4f6',
        display: 'standalone',
        id: '/',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        categories: ['news', 'politics'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Congresso', url: '/congresso', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Telão', url: '/telao', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/tse\//],
        // Versão nova assume na hora e apaga os arquivos da versão anterior.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Resultados nunca vêm de cache do aparelho: sempre o dado mais recente.
            urlPattern: ({ url }) => url.pathname.startsWith('/tse/') && !url.pathname.includes('/fotos/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/tse/') && url.pathname.includes('/fotos/'),
            handler: 'CacheFirst',
            options: { cacheName: 'fotos', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/geo/'),
            handler: 'CacheFirst',
            options: { cacheName: 'geo', expiration: { maxEntries: 80 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Em produção o mesmo caminho é servido por api/tse.ts (proxy com cache no CDN).
      '/tse': {
        target: 'https://resultados.tse.jus.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tse/, '/oficial'),
      },
    },
  },
})
