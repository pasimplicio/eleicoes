/*
 * Coleta das candidaturas a deputado federal, estadual e distrital no DivulgaCandContas.
 * Mesmo procedimento de coletar-candidatos.js: abra https://divulgacandcontas.tse.jus.br/divulga/,
 * cole este código no Console (F12) e tecle Enter. O navegador baixa
 * "candidatos-proporcionais-<ano>.json". Depois, no projeto:
 *
 *   node scripts/dividir-proporcionais.mjs caminho/do/candidatos-proporcionais-2026.json
 */
;(async () => {
  const ANO = 2026
  const API = '/divulga/rest/v1'
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
  // [cargo no portal, código TSE, código no DF]
  const CARGOS = [
    ['deputado-federal', 6, 6],
    ['deputado-estadual', 7, 8],
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

  const ordinarias = await get('/eleicao/ordinarias')
  const lista = Array.isArray(ordinarias) ? ordinarias : pick(ordinarias, 'eleicoes', 'lista') || []
  const doAno = lista.filter((e) => Number(pick(e, 'ano', 'anoEleicao')) === ANO)
  if (!doAno.length) throw new Error(`Nenhuma eleição ordinária de ${ANO} encontrada`)
  doAno.sort(
    (a, b) =>
      /geral|federal/i.test(pick(b, 'nomeEleicao', 'descricaoEleicao') || '') -
      /geral|federal/i.test(pick(a, 'nomeEleicao', 'descricaoEleicao') || ''),
  )

  const saida = { ano: ANO, coletadoEm: new Date().toISOString(), cargos: {} }
  let total = 0
  for (const [slug, codigo, codigoDF] of CARGOS) {
    saida.cargos[slug] = {}
    for (const ue of UFS) {
      const cd = ue === 'DF' ? codigoDF : codigo
      let resposta = null
      let eleId = null
      for (const e of doAno) {
        try {
          resposta = await get(`/candidatura/listar/${ANO}/${ue}/${e.id}/${cd}/candidatos`)
          eleId = e.id
          break
        } catch {
          /* tenta a próxima eleição do ano */
        }
      }
      const cands = (resposta && pick(resposta, 'candidatos')) || []
      saida.cargos[slug][ue] = cands.map((c) => ({
        id: c.id,
        nomeUrna: pick(c, 'nomeUrna', 'nomeUrnaCandidato'),
        numero: pick(c, 'numero', 'numeroCandidato'),
        partido: pick(c, 'partido.sigla', 'siglaPartido'),
        situacao: pick(c, 'descricaoSituacao', 'descricaoTotalizacao'),
        foto: `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${eleId}/${c.id}/${ue}`,
      }))
      total += cands.length
      console.log(`${slug} ${ue}: ${cands.length}`)
    }
  }

  const blob = new Blob([JSON.stringify(saida)], { type: 'application/json' })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `candidatos-proporcionais-${ANO}.json`,
  })
  document.body.appendChild(a)
  a.click()
  a.remove()
  console.log(`Pronto: ${total} candidaturas.`)
})()
