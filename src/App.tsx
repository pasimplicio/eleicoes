import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { AboutPage } from './pages/AboutPage'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { OfficePage } from './pages/OfficePage'
import { CongressPage } from './pages/CongressPage'
import { VoteMapPage } from './pages/VoteMapPage'

// Leaflet só carrega quando alguém abre o mapa das seções.
const SectionsMapPage = lazy(() => import('./pages/SectionsMapPage').then((m) => ({ default: m.SectionsMapPage })))
import { StatePage } from './pages/StatePage'
import { Telao } from './pages/Telao'
import { TelaoConfig } from './pages/TelaoConfig'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
})

const router = createBrowserRouter([
  { path: '/telao', element: <Telao /> },
  { path: '/telao/configurar', element: <TelaoConfig /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/congresso', element: <CongressPage /> },
      { path: '/mapa-de-votos', element: <VoteMapPage /> },
      {
        path: '/mapa-das-secoes',
        element: (
          <Suspense fallback={<div className="mx-auto h-[70dvh] max-w-7xl px-4 pt-10"><div className="skeleton h-full rounded-lg" /></div>}>
            <SectionsMapPage />
          </Suspense>
        ),
      },
      { path: '/sobre', element: <AboutPage /> },
      { path: '/:ano/:cargo', element: <OfficePage /> },
      { path: '/:ano/:cargo/:uf', element: <StatePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
