# Apuração Brasil — Portal das Eleições

Portal de acompanhamento eleitoral com resultados em tempo real, mapas interativos por estado e município e
pesquisas registradas na Justiça Eleitoral. Usa apenas dados oficiais do TSE e malhas do IBGE.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · d3-geo · PWA · Vercel Functions

## Rodando localmente

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # checagem de tipos + build de produção
npm run geo          # regera as malhas em public/geo (IBGE + códigos TSE)
```

Em desenvolvimento o Vite faz o papel das funções da Vercel: `/tse/*` é repassado ao servidor de resultados
do TSE e `/api/municipios` roda `api/municipios.ts` localmente.

## Arquitetura

```
api/
  tse.ts              proxy com cache no CDN para resultados.tse.jus.br/oficial
  municipios.ts       agrega os resultados de todos os municípios de uma UF (mapa estadual)
scripts/build-geo.mjs malhas do IBGE e tabela de municípios TSE <-> IBGE
public/geo/           TopoJSON do Brasil e das 27 UFs; códigos de município
src/
  config/
    elections.ts      ciclos eleitorais (gerais/municipais), cargos, datas e códigos do TSE
    parties.ts        cores por partido
    ufs.ts            UFs (sigla, IBGE, região)
  lib/tse/
    raw.ts            formato cru dos arquivos do TSE
    model.ts          modelo interno normalizado (o que a interface consome)
    adapter.ts        cru -> normalizado
    discovery.ts      descobre os códigos de eleição do ciclo na config pública do TSE
    queries.ts        hooks de dados (atualização a cada 30 s durante a apuração)
  components/         mapa coroplético, placar, layout
  pages/              Home, cargo (/2026/presidente), UF (/2026/governador/sp), pesquisas, metodologia
```

### Evolução a cada ciclo

As eleições acontecem a cada dois anos, alternando **gerais** (2026, 2030…) e **municipais** (2028, 2032…).
`getCycle(ano)` calcula o tipo, os cargos e as datas (1º e último domingo de outubro). Os códigos de eleição do
TSE do ciclo corrente são lidos em `comum/config/ele-c.json` quando o TSE os publica. Depois da eleição,
registre-os em `KNOWN_IDS` para manter o histórico estável. Se o TSE mudar o formato dos arquivos, só o
adapter precisa mudar.

### Carga no dia da eleição

O navegador nunca chama o TSE diretamente. As respostas ficam no CDN da Vercel por 20 a 30 s
(`stale-while-revalidate`), as malhas são estáticas e o service worker mostra o último dado se a conexão cair.

## Deploy (Vercel)

1. Importe `pasimplicio/eleicoes` em vercel.com/new. O framework Vite é detectado e `vercel.json` já traz rotas,
   cabeçalhos de cache e limites das funções.
2. Cada push na `main` gera um deploy de produção; PRs geram previews.

## Fontes

- Resultados: <https://resultados.tse.jus.br>
- Pesquisas: <https://pesqele-divulgacao.tse.jus.br>
- Dados abertos: <https://dadosabertos.tse.jus.br>
- Malhas: <https://servicodados.ibge.gov.br/api/docs/malhas>

Portal independente, sem vínculo com a Justiça Eleitoral.

## Candidatos antes da eleição

Enquanto uma eleição não acontece, o portal mostra as candidaturas registradas, buscando em ordem:

1. **Servidor de resultados do TSE**, automaticamente, assim que o TSE publica o ciclo (dias antes da votação).
2. **`public/data/candidatos-<ano>.json`**, coletado do DivulgaCandContas.

O DivulgaCandContas e o Portal de Dados Abertos bloqueiam acessos vindos de servidores, incluindo a Vercel.
Por isso a coleta roda no navegador:

1. Abra <https://divulgacandcontas.tse.jus.br/divulga/> no Chrome ou Edge.
2. Pressione F12, abra a aba **Console**, cole o conteúdo de `scripts/coletar-candidatos.js` e tecle Enter.
3. Salve o arquivo baixado em `public/data/` e faça o push.
