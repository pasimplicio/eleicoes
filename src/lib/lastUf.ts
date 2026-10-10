// Último estado visitado, para o atalho "Continuar em ..." do menu. Só conveniência:
// sem armazenamento disponível, o atalho simplesmente não aparece.
import { findUf, type Uf } from '../config/ufs'

const KEY = 'ultimo-estado'

export function getLastUf(): Uf | undefined {
  try {
    return findUf(localStorage.getItem(KEY) ?? undefined)
  } catch {
    return undefined
  }
}

export function setLastUf(sigla: string) {
  try {
    localStorage.setItem(KEY, sigla)
  } catch {
    /* armazenamento indisponível */
  }
}
