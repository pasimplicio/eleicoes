import { Link } from 'react-router-dom'
import { Container } from '../components/ui'

export function NotFound() {
  return (
    <Container className="py-24">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-muted">Erro 404</p>
        <h1 className="mt-2 font-serif text-5xl leading-[1.05] font-semibold tracking-tight">Essa urna está vazia.</h1>
        <p className="mt-4 leading-relaxed text-ink-2">
          O endereço não corresponde a nenhuma eleição, cargo ou estado.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-page hover:bg-ink-2"
        >
          Voltar ao início
        </Link>
      </div>
    </Container>
  )
}
