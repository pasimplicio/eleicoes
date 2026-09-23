/*
 * Coleta das candidaturas (presidente, governador e senador) no DivulgaCandContas do TSE.
 *
 * O DivulgaCand bloqueia acessos vindos de servidores, então esta coleta roda no seu
 * navegador, dentro do próprio site do TSE (mesma origem, sem bloqueio):
 *
 *   1. Abra https://divulgacandcontas.tse.jus.br/divulga/ no Chrome ou Edge.
 *   2. Pressione F12, vá à aba "Console", cole este arquivo inteiro e tecle Enter.
 *   3. Ao terminar (1 a 3 minutos), o navegador baixa "candidatos-<ano>.json".
 *   4. Salve o arquivo em public/data/ no projeto e publique (git push).
 *
 * Os campos da API do DivulgaCand variam entre ciclos; a coleta lê cada campo pelos
 * nomes conhecidos e registra no console o que não encontrar.
 */
;(async () => {
  const ANO = 2026
  const API = '/divulga/rest/v1'
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
  const CARGOS = [
    ['presidente', 1, ['BR']],
    ['governador', 3, UFS],
    ['senador', 5, UFS],
  ]

  const get = async (path) => {
    const res = await fetch(API + path, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${res.status} em ${path}`)
    return res.json()
  }
  const pick = (obj, ...keys) => {
    for (const k of keys) {
      const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj)
      if (v !== undefined && v !== null && v !== '') return v
    }
    return undefined
  }
  const pool = async (items, n, fn) => {
    const out = []
    let i = 0
    await Promise.all(
      Array.from({ length: n }, async () => {
        while (i < items.length) {
          const idx = i++
          out[idx] = await fn(items[idx]).catch((e) => (console.warn(e.message), null))
        }
      }),
    )
    return out
  }

  // 1. Eleição ordinária do ano
  const ordinarias = await get('/eleicao/ordinarias')
  const lista = Array.isArray(ordinarias) ? ordinarias : pick(ordinarias, 'eleicoes', 'lista') || []
  const doAno = lista.filter((e) => Number(pick(e, 'ano', 'anoEleicao')) === ANO)
  console.table(doAno.map((e) => ({ id: e.id, nome: pick(e, 'nomeEleicao', 'descricaoEleicao') })))
  if (!doAno.length) throw new Error(`Nenhuma eleição ordinária de ${ANO} encontrada`)
  // Preferência: eleição geral/federal primeiro; as demais servem de alternativa.
  doAno.sort((a, b) => /geral|federal/i.test(pick(b, 'nomeEleicao', 'descricaoEleicao') || '') - /geral|federal/i.test(pick(a, 'nomeEleicao', 'descricaoEleicao') || ''))

  const saida = { ano: ANO, coletadoEm: new Date().toISOString(), eleicaoId: String(doAno[0].id), cargos: {} }

  for (const [slug, codigo, ues] of CARGOS) {
    saida.cargos[slug] = {}
    for (const ue of ues) {
      let resposta = null
      let eleId = null
      for (const e of doAno) {
        try {
          resposta = await get(`/candidatura/listar/${ANO}/${ue}/${e.id}/${codigo}/candidatos`)
          eleId = e.id
          break
        } catch {
          /* tenta a próxima eleição do ano */
        }
      }
      const cands = (resposta && (pick(resposta, 'candidatos') || [])) || []
      const detalhados = await pool(cands, 4, async (c) => {
        let d = {}
        try {
          d = await get(`/candidatura/buscar/${ANO}/${ue}/${eleId}/candidato/${c.id}`)
        } catch (err) {
          console.warn(`Sem detalhe para ${c.id}: ${err.message}`)
        }
        const vice = (pick(d, 'vices') || [])[0]
        return {
          id: c.id,
          nomeUrna: pick(c, 'nomeUrna', 'nomeUrnaCandidato') || pick(d, 'nomeUrna'),
          nomeCompleto: pick(c, 'nomeCompleto') || pick(d, 'nomeCompleto'),
          numero: pick(c, 'numero', 'numeroCandidato') ?? pick(d, 'numero'),
          partido: pick(c, 'partido.sigla', 'siglaPartido') || pick(d, 'partido.sigla'),
          coligacao: pick(c, 'nomeColigacao', 'composicaoColigacao') || pick(d, 'nomeColigacao'),
          vice: vice ? pick(vice, 'nm_URNA', 'nomeUrna', 'nm_CANDIDATO', 'nomeCompleto') : undefined,
          situacao: pick(c, 'descricaoSituacao', 'descricaoTotalizacao') || pick(d, 'descricaoSituacao'),
          foto:
            pick(d, 'fotoUrl') ||
            `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${eleId}/${c.id}/${ue}`,
        }
      })
      saida.cargos[slug][ue] = detalhados.filter(Boolean)
      console.log(`${slug} ${ue}: ${saida.cargos[slug][ue].length} candidaturas`)
    }
  }

  const blob = new Blob([JSON.stringify(saida, null, 1)], { type: 'application/json' })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `candidatos-${ANO}.json`,
  })
  document.body.appendChild(a)
  a.click()
  a.remove()
  console.log('Pronto. Salve o arquivo em public/data/ no projeto.')
})()
