import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-bold tracking-[0.14em] text-muted uppercase">Página não encontrada</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">Essa urna está vazia.</h1>
      <p className="mt-3 text-muted">O endereço não corresponde a nenhuma eleição, cargo ou estado.</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
        Voltar ao início
      </Link>
    </div>
  )
}
