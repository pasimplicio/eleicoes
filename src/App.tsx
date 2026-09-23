import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { AboutPage } from './pages/AboutPage'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { OfficePage } from './pages/OfficePage'
import { PollsPage } from './pages/PollsPage'
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
      { path: '/pesquisas', element: <PollsPage /> },
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
