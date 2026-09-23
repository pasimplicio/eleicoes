// Confere o cálculo de vagas (src/lib/proportional.ts) com o resultado oficial do TSE.
// Uso: node --experimental-strip-types scripts/validar-proporcionais.mjs [ciclo] [eleição] [regra]
//   ex.: ... ele2022 546 tse-2022   |   ... ele2026 <código> stf-2024
import { allocate } from '../src/lib/proportional.ts'
const [CICLO = 'ele2022', ELE = '546', RULE = 'tse-2022'] = process.argv.slice(2)

const B = `https://resultados.tse.jus.br/oficial/${CICLO}/${ELE}`
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const get = async (u) => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u)
    if (r.ok) return r.json()
  }
  throw new Error('falhou ' + u)
}
const iso = (d) => (d ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : undefined)

let okAll = true
const diffs = []
for (const uf of UFS.map((u) => u.toLowerCase())) {
  for (const cargo of ['6', uf === 'df' ? '8' : '7']) {
    const c4 = cargo.padStart(4, '0')
    const v = await get(`${B}/dados/${uf}/${uf}-c${c4}-e${ELE.padStart(6, '0')}-v.json`)
    const f = await get(`${B}/dados/${uf}/${v.nadf}.json`)
    const r = await get(`${B}/dados-simplificados/${uf}/${uf}-c${c4}-e${ELE.padStart(6, '0')}-r.json`)
    const abr = v.abr[0]
    const names = Object.fromEntries(f.carg.agr.map((a) => [a.n, a.com || a.nm]))
    const parties = abr.agr.map((a) => ({ id: a.n, label: names[a.n], nominal: +a.tvtn, legenda: +a.tvtl }))
    const votes = Object.fromEntries(abr.cand.map((c) => [c.n, +c.vap]))
    const cands = f.carg.agr.flatMap((a) =>
      a.par.flatMap((p) =>
        p.cand.map((c) => ({ id: c.n, partyId: a.n, votes: votes[c.n] ?? 0, eligible: c.dvt === 'Válido', birth: iso(c.dt) })),
      ),
    )
    const res = allocate(parties, cands, +f.carg.nv, RULE)

    const official = Object.fromEntries(abr.agr.map((a) => [a.n, +a.vag]))
    const seatDiff = res.parties.filter((p) => p.seats !== (official[p.id] ?? 0))
    const offSt = Object.fromEntries(r.cand.map((c) => [c.n, c.st]))
    const map = { qp: 'Eleito por QP', media: 'Eleito por média', suplente: 'Suplente', 'nao-eleito': 'Não eleito' }
    const candDiff = Object.entries(res.outcome).filter(([n, o]) => (offSt[n] ?? '') !== map[o])
    const electedDiff = candDiff.filter(([n, o]) => o === 'qp' || o === 'media' || /Eleito/.test(offSt[n] ?? ''))

    const stf = allocate(parties, cands, +f.carg.nv, 'stf-2024')
    const stfChange = stf.parties.filter((p) => p.seats !== res.parties.find((x) => x.id === p.id).seats).length

    const ok = !seatDiff.length && !electedDiff.length
    okAll &&= ok
    console.log(
      `${uf.toUpperCase()} c${cargo} vagas ${f.carg.nv} QE ${res.qe}  partidos ${seatDiff.length ? 'DIVERGE' : 'ok'}  eleitos ${electedDiff.length ? 'DIVERGE ' + electedDiff.length : 'ok'}  sup/ñ-eleito divergentes ${candDiff.length - electedDiff.length}${stfChange ? '  (regra STF mudaria ' + stfChange + ' partidos)' : ''}`,
    )
    if (!ok) diffs.push({ uf, cargo, seatDiff: seatDiff.map((p) => `${p.label}: calc ${p.seats} x TSE ${official[p.id]}`), electedDiff: electedDiff.slice(0, 5).map(([n, o]) => `${n}: calc ${o} x TSE ${offSt[n]}`) })
  }
}
console.log(okAll ? '\nTUDO CONFERE COM O TSE' : '\nDIVERGÊNCIAS:\n' + JSON.stringify(diffs, null, 1))
