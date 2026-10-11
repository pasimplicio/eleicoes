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
do TSE e `/api/municipios`, `/api/evolucao` (e as demais em `devApi`, no `vite.config.ts`) rodam localmente.

## Arquitetura

```
api/
  tse.ts              proxy com cache no CDN para resultados.tse.jus.br/oficial; grava a evolução nacional
  municipios.ts       agrega os resultados de todos os municípios de uma UF (mapas estadual e nacional)
  evolucao.ts         série gravada da evolução da apuração de presidente (ver _evolucao.ts)
scripts/
  build-geo.mjs       malhas do IBGE e tabela de municípios TSE <-> IBGE
  build-evolution.mjs evolução da apuração reconstruída pelos boletins de urna (dados abertos)
public/geo/           TopoJSON do Brasil (por UF e por município) e das 27 UFs; códigos de município
public/data/evolucao/ evolução reconstruída de cada eleição (gerada por build-evolution.mjs)
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
O mapa nacional de municípios pede as 27 UFs de uma vez (`escala=br`) e por isso fica 2 min no CDN. Uma
varredura de UF em que o TSE recusa algum município (429, 5xx) responde 503 sem cache, para não guardar um
resultado incompleto como final.

### Evolução da apuração (gráfico de linhas)

O TSE só publica o resultado acumulado e, ao retotalizar, sobrescreve os horários. A curva vem de:

1. **Gravação ao vivo:** `api/tse.ts` grava cada leitura do arquivo nacional de presidente no **Upstash Redis**
   (Vercel → Storage → Upstash, que cria `KV_REST_API_URL` e `KV_REST_API_TOKEN`). Sem essas variáveis, nada é
   gravado e o site segue normal. A gravação acontece enquanto houver visitantes (a cada leitura nova do CDN).
2. **Boletins de urna:** depois da eleição, `node scripts/build-evolution.mjs <ano> <turno> <código>` (ex.:
   `2026 1 6257`) soma os votos de cada urna na ordem em que o TSE recebeu os boletins e grava
   `public/data/evolucao/`. Roda na sua máquina (o portal bloqueia servidores), baixa ~5 GB um estado por vez,
   apaga cada arquivo depois de processar e precisa de um `tar` que leia zip (o do Windows ou `bsdtar`).

## Deploy (Vercel)

1. Importe `pasimplicio/eleicoes` em vercel.com/new. O framework Vite é detectado e `vercel.json` já traz rotas,
   cabeçalhos de cache e limites das funções.
2. Cada push na `main` gera um deploy de produção; PRs geram previews.
3. Para o gráfico da evolução ao vivo, conecte um banco **Upstash Redis** ao projeto (Storage) antes da eleição.

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

## Deputados (eleições proporcionais)

A página de cada cargo (`/2022/deputado-federal?uf=sp`) mostra a bancada em hemiciclo, a distribuição por
partido ou federação (quociente partidário, vagas por QP e por média), os eleitos e todos os candidatos.

- **Resultado oficial:** quando o TSE declara os eleitos, o portal exibe exatamente as vagas e situações do TSE.
- **Durante a apuração:** `src/lib/proportional.ts` projeta as vagas pelas regras do Código Eleitoral (arts.
  106 a 112, Lei 14.211/2021, federações como um partido). A partir de 2024 a última fase das sobras segue a
  decisão do STF (ADIs 7228, 7263 e 7325).
- **Validação:** `node --experimental-strip-types scripts/validar-proporcionais.mjs` compara o cálculo com o
  resultado oficial de 2022. Confere em 53 das 54 disputas; a exceção (deputado federal no TO) é um caso
  histórico em que o arquivo do TSE não segue a mesma interpretação das demais UFs.
- **Candidatos antes da eleição:** rode `scripts/coletar-proporcionais.js` no console do DivulgaCandContas e
  depois `node scripts/dividir-proporcionais.mjs <arquivo baixado>`, que grava
  `public/data/candidatos-<ano>/<cargo>/<uf>.json`.
