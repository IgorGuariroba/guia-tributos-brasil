# Guia de Tributos, Contribuições, Taxas e Encargos do Brasil

[![Gates de qualidade](https://github.com/IgorGuariroba/guia-tributos-brasil/actions/workflows/ci.yml/badge.svg)](https://github.com/IgorGuariroba/guia-tributos-brasil/actions/workflows/ci.yml)
![Lighthouse 100](https://img.shields.io/badge/Lighthouse-100%2F100%2F100%2F100-006630)
![axe-core 0 violações](https://img.shields.io/badge/axe--core-0%20viola%C3%A7%C3%B5es-006630)
![Semantic HTML Score 100](https://img.shields.io/badge/Semantic%20HTML-100%2F100-006630)

Página estática, sem dependências de runtime, que reúne **78 siglas** do sistema tributário,
trabalhista, regulatório e financeiro brasileiro — com perfis de interesse, busca, filtros por
tipo/esfera/contexto/status, ordenação por coluna e exportação para CSV. Os campos operacionais
`sujeito_passivo`, `periodicidade` e `guia` são descritivos; `guia` só aponta para documento já
catalogado quando há ligação sustentada. Estilo visual **brutalista**.

🔗 **Publicado em:** https://igorguariroba.github.io/guia-tributos-brasil/

## Estado de qualidade

| Métrica                                          | Resultado                                    |
| ------------------------------------------------ | -------------------------------------------- |
| Lighthouse — Performance                         | **100**                                      |
| Lighthouse — Accessibility                       | **100**                                      |
| Lighthouse — Best Practices                      | **100**                                      |
| Lighthouse — SEO                                 | **100**                                      |
| axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) | **0 violações**                              |
| Semantic HTML Score                              | **100/100 (A)**                              |
| Duplicação de código (jscpd)                     | **0,14%** (limite 0,4%)                      |
| Estilo (higiene + Prettier + ESLint)             | **0 pendências**                             |
| Testes funcionais                                | **20/20**                                    |
| Responsividade                                   | **8 larguras + 3 dispositivos, 0 problemas** |
| Nós no DOM                                       | **1117** (limite 1200)                       |
| Requisições a terceiros                          | **0** (fontes auto-hospedadas)               |
| Peso total                                       | ~90 KB                                       |

Medido **na URL de produção** (`--preset=desktop`): LCP **0.3 s**, CLS **0**, TBT **0 ms**,
5 requisições, nenhuma externa.

## Como rodar localmente

```bash
npm ci
npx playwright install chromium
npm run build           # gera public/index.html e public/api/* a partir de data/tributos.json
npm run serve           # abre http://localhost:8080
```

## De onde vem o catálogo

`data/tributos.json` é a **fonte da verdade** dos 78 itens (schema em `data/schema.json`:
campos obrigatórios, `id` único e estável no formato slug). O campo `status` usa o enum fechado
`Vigente`, `Em transição`, `Em implantação`, `Varia por ente`, `Não instituído` ou `Histórico`;
`nota_status` é opcional e preserva qualificadores específicos. `public/index.html` **não é
escrito à mão** — é gerado por `node audit/build.mjs` a partir de `data/tributos.json` +
`src/index.template.html`, junto com `public/api/tributos.json` e `public/api/tributos.csv`
(o mesmo catálogo em JSON e CSV, para consumo por terceiros).

```bash
npm run build              # regenera public/index.html e public/api/*
npm run gate:build         # valida o schema e falha se public/ estiver desatualizado
npm run gate:cobertura      # exige os campos operacionais em pelo menos 90% dos itens
```

### Fundamento legal e fontes primárias

Todos os 78 itens têm `fundamento` (norma, URL HTTPS e observação opcional) e `fontes` com link primário para o texto oficial no Portal do Planalto. Para taxas municipais/estaduais, o registro aponta a base constitucional ou geral e explicita que a lei do ente competente deve ser consultada; isso evita apresentar uma norma genérica como se fosse a lei instituidora local. O catálogo é informativo e não substitui a legislação vigente nem presta orientação tributária.

O Gate de build reprova qualquer item sem fundamento ou fonte, além de validar que os links apontem para HTTPS. A validação de disponibilidade dos links deve ocorrer em job periódico não bloqueante, pois a indisponibilidade temporária do portal não deve impedir uma contribuição de conteúdo.

Depois de editar `data/tributos.json` ou `src/index.template.html`, rode `npm run build` e
commite tanto a fonte quanto `public/` — o Gate 1 (build) reprova PRs em que os dois
divergem, exatamente como um `git diff --exit-code` de código gerado.

## Contrato da API pública

A API estática está disponível em [`/api/tributos.json`](public/api/tributos.json). Ela não
possui runtime nem faz requisições externas. O documento tem este envelope:

- `version` (`string`): versão automática no formato `sha256-<64 hex>`, calculada sobre o
  JSON canônico de `data/tributos.json`; muda sempre que o catálogo muda.
- `gerado_em` (`string`, ISO 8601): data-base determinística da revisão do catálogo. Não é o
  relógio do build, portanto duas execuções reproduzem os mesmos bytes.
- `total` (`integer`): quantidade de itens; deve ser igual a `itens.length` (atualmente 78).
- `itens` (`array`): os registros do catálogo. Cada registro contém os campos obrigatórios
  `id`, `sigla`, `nome`, `tipo`, `esfera`, `contexto`, `descricao` e `status`, todos strings
  não vazias. `contexto` pode conter categorias separadas por `/`.

Os enums atualmente publicados são:

- `tipo`: `Imposto`, `Contribuição`, `Compensação`, `Contribuição para terceiros`, `Taxa`,
  `Fundo / taxas`, `Encargo trabalhista`, `Fator de cálculo`, `Encargo / contribuições para
terceiros`, `Regime tributário`, `Documento de arrecadação`, `Ferramenta / apuração` e
  `Mecanismo de tributação`.
- `esfera`: `Federal`, `Estadual`, `Municipal`, `Estadual + Municipal`, `Federal / repartida`,
  `Municipal / DF` e `Compartilhado`.
- `status`: `Vigente`, `Em transição`, `Não instituído`, `Implementação 2026`,
  `Implementação`, `Vigente / regras específicas`, `Denominação histórica/comum`,
  `Vigente / nome local`, `Varia por município`, `Varia por estado`, `Vigente / uso específico`,
  `Vigente / específica`, `Vigente / uso conforme caso` e `Vigente conforme fundo`.

O schema exige strings não vazias; consumidores devem tratar valores desconhecidos de forma
compatível para frente. O campo `id` é um slug minúsculo e **estável**: uma vez publicado,
nunca é reatribuído nem reaproveitado, mesmo que o item seja removido. Use-o como chave e em
links, não a posição do item no array.

Exemplo mínimo de consumo:

```js
const resposta = await fetch('/api/tributos.json').then(r => r.json());
for (const tributo of resposta.itens) console.log(tributo.id, tributo.nome);
```

[`/api/tributos.csv`](public/api/tributos.csv) permanece disponível para planilhas. Como CSV
não comporta envelope, ele contém somente cabeçalho e linhas de itens, nas colunas `ID`,
`Sigla`, `Nome`, `Tipo/Natureza`, `Esfera`, `Contexto`, `Descrição` e `Status`; a primeira
linha tem BOM UTF-8 e os metadados `version`/`gerado_em` não são repetidos nele.

## SEO e metadados sociais

`npm run build` também gera, a partir da mesma URL canonical fixa
(`https://igorguariroba.github.io/guia-tributos-brasil/`):

- **`public/robots.txt`** — libera todo o crawling e aponta para o sitemap.
- **`public/sitemap.xml`** — uma URL indexável (SPA de página única; fragmentos `#item-x`
  não entram até existir deep-link funcional — ver `docs/plano-de-melhoria.md`, tarefa 2.2).
- **`<link rel="canonical">`, `og:*`, `twitter:*`** injetados no `<head>` de
  `src/index.template.html` (não gerados dinamicamente — são estáticos, iguais em todo build).

`public/og-image.png` (1200×630, visual brutalista igual ao site) é gerado separadamente,
via Chromium/Playwright, e commitado como artefato binário:

```bash
node audit/gen-og-image.mjs    # regenera public/og-image.png
```

Só precisa rodar de novo se o texto/design da imagem mudar — não faz parte do `npm run build`
nem do Gate de build (é determinístico, mas caro de gerar a cada push; sua consistência
fica sob revisão humana no PR, como qualquer outro binário versionado).
Lighthouse SEO permanece **100** com os metadados presentes (`lighthouserc.json`).

## Gates de qualidade

Os gates rodam automaticamente no **pre-push** (husky) e no **CI** (GitHub Actions).
São propositalmente exigentes: qualquer regressão bloqueia o push.

```bash
npm run gates              # todos os 8 gates
npm run gate:build         # somente build & schema (data/tributos.json → public/)
npm run gate:estilo        # somente estilo (higiene + Prettier + ESLint)
npm run gate:funcional     # somente Playwright
npm run gate:responsivo    # somente responsividade (320→1920px)
npm run gate:a11y          # somente axe-core
npm run gate:semantica     # somente Semantic HTML Score
npm run gate:duplicacao    # somente duplicação de código (jscpd)
npm run gate:lighthouse    # somente Lighthouse CI
```

Correção automática do que o gate de estilo aponta:

```bash
npm run format             # prettier --write .
npm run lint:fix           # eslint . --fix
```

### Gate 1 · Build & Schema (`audit/build-gate.mjs`)

O catálogo vive em `data/tributos.json` (schema em `data/schema.json`), não em
`public/index.html`. Este gate roda `node audit/build.mjs --check` e reprova se:

- algum item tiver campo obrigatório ausente, `id` fora do padrão `^[a-z0-9]+(-[a-z0-9]+)*$`
  ou `id` duplicado;
- `public/index.html`, `public/api/tributos.json` ou `public/api/tributos.csv` divergirem do
  que `data/tributos.json` + `src/index.template.html` produziriam — ou seja, alguém editou
  o artefato gerado à mão, ou mudou o dado/template e esqueceu de rodar `npm run build`.

Roda em menos de 1s, sem navegador — por isso entra no **pre-commit**, junto do gate de
estilo, além do pre-push e de um job próprio no CI.

### Gate 2 · Estilo (`audit/style-gate.mjs`)

Três camadas, da mais barata para a mais cara. Roda em ~2 s, sem navegador — por isso é o
único gate que também entra no **pre-commit** e ganha um job próprio no CI, dando feedback
de padrão em segundos em vez de esperar Playwright e Lighthouse.

| Camada             | Ferramenta              | O que trava                                                                                         |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------------------- |
| Higiene de arquivo | nativo (`git ls-files`) | tabulação, indentação fora do passo de 2, espaço no fim da linha, CRLF, BOM, falta de newline final |
| Formatação         | `prettier --check`      | aspas, larguras, quebras, vírgula final — forma canônica única                                      |
| Padrão de código   | `eslint`                | imports duplicados/desordenados, `var`, `let` que deveria ser `const`, `==`, variável não usada     |

A camada de higiene percorre **todos os arquivos versionados de texto**, inclusive
`public/index.html`, que o Prettier ignora de propósito: ele é o artefato estático entregue
ao usuário (CSS/JS inline compactados para render-blocking zero) e reformatá-lo mudaria o
payload medido pelo gate do Lighthouse. Assim o HTML continua com consistência verificada
sem ficar sujeito ao reformatador.

Configuração em `.editorconfig` (fonte da verdade para o editor), `.prettierrc.json` /
`.prettierignore` e `eslint.config.mjs`. O ESLint **não** define regras de formatação —
essa responsabilidade é só do Prettier, para as duas ferramentas nunca se contradizerem.

### Gate 3 · Funcional (`audit/functional-gate.mjs`)

20 asserções sobre a página real, para que os gates de qualidade não aprovem uma página quebrada:
seleção e confirmação do perfil de interesse, associações visuais dinâmicas por perfil, carga inicial (78 linhas), busca textual, busca sem acento, estado vazio com `role=status`,
reset do formulário, combobox pesquisável com multisseleção, contextos atômicos, chips removíveis,
rótulos visíveis, busca na primeira tela, **ordenação acionável por teclado** com `aria-sort`
exclusivo, skip-link com destino focável, CSV (BOM UTF-8, 8 colunas, 79 linhas),
`<abbr title>` em todas as siglas, zero recursos externos, console sem erros e quatro
asserções sobre os ícones (renderização real de pixels, mapeamento completo, natureza
decorativa e independência do texto em relação a eles).

### Gate 4 · Responsividade (`audit/responsive-gate.mjs`)

Audita **8 larguras** e falha se qualquer uma tiver problema:

| Largura | Alvo                   | Layout esperado          |
| ------: | ---------------------- | ------------------------ |
|   320px | celular pequeno        | cards 1col, filtros 1col |
|   375px | iPhone                 | cards 1col, filtros 1col |
|   390px | celular moderno        | cards 1col, filtros 1col |
|   768px | tablet                 | cards 2col, filtros 2col |
|  1024px | tablet/desktop pequeno | cards 4col, filtros 4col |
|  1280px | desktop                | cards 4col, filtros 4col |
|  1440px | desktop                | cards 4col, filtros 4col |
|  1920px | monitor grande         | cards 4col, filtros 4col |

Mais **3 dispositivos reais** emulados (iPhone 14, Pixel 7, iPad Mini) com `isMobile` e DPR corretos.

Verificações por largura:

1. **zero scroll horizontal** no documento
2. **nenhum elemento estourando** a viewport (o scroller da tabela é exceção intencional)
3. **alvos de toque ≥ 44×44 px** em viewports touch (≤ 768px) — WCAG 2.5.5
4. **sem sobreposição** entre controles de filtro
5. **legibilidade**: corpo ≥ 14px, textos ≥ 12px
6. tabela operável no desktop e resultados em cards no celular, sem rolagem horizontal
7. barra sticky com folga de scroll e **ocupando ≤ 40% da viewport** (se não couber, deve deixar de ser sticky)
8. **filtro e reset funcionam** naquela largura (comportamento, não só layout)

### Gate 5 · Acessibilidade (`audit/axe-gate.mjs`)

axe-core com as tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.
**Exige 0 violações** e audita **3 estados** do DOM, já que a tabela é renderizada por JS:

1. carga inicial (78 itens)
2. filtrado (1 item)
3. estado vazio (0 itens, live region ativa)

O CI executa também o `@axe-core/cli` como verificação independente.

### Gate 6 · HTML semântico (`audit/semantic-gate.mjs`)

Rubrica de 100 pontos em 7 categorias (`audit/semantic-core.mjs`), avaliada no DOM renderizado.
**Mínimo exigido: 100.**

| Categoria   | Peso | O que verifica                                                            |
| ----------- | ---: | ------------------------------------------------------------------------- |
| Landmarks   |   20 | `<main>` único, `header`/`footer`, `section`/`article`, `role=search`     |
| Headings    |   15 | um só `<h1>`, nenhum nível pulado, heading por seção                      |
| Formulários |   20 | rótulo acessível em todo controle, `type` nos botões, `fieldset`/`legend` |
| Tabela      |   20 | `thead`/`tbody`, `th[scope]`, `caption`, `aria-sort`, cabeçalho focável   |
| Divitis     |   10 | proporção de `div`/`span` ≤ 15% dos elementos                             |
| Texto       |    8 | listas reais, `strong`/`em` (não `b`/`i`), `time`/`abbr`                  |
| Dinâmico    |    7 | contador em `aria-live`, estado vazio anunciável                          |

### Gate 7 · Duplicação de código (`audit/duplication-gate.mjs`)

Mede reutilização via clones copiar-e-colar com [jscpd](https://github.com/kucherenko/jscpd)
sobre `public/` e `audit/` (JS, CSS e markup, inclusive os blocos inline do `index.html`).

| Critério                | Limite               | Medido       |
| ----------------------- | -------------------- | ------------ |
| Linhas duplicadas       | ≤ 0,4%               | **0,14%**    |
| Maior clone individual  | < 12 linhas          | **5 linhas** |
| Clone mínimo detectável | 4 linhas / 30 tokens | —            |

Dois critérios porque o percentual global sozinho esconde um bloco grande copiado dentro de
um arquivo grande; o limite por clone pega esse caso. Em base pequena (~2,5 mil linhas) o
percentual é ruidoso — um clone de 6 linhas já vale ~0,24% — então **o limite por clone é o
sinal confiável** e o percentual é apenas a rede de segurança.

O único clone remanescente é o par ascendente/descendente do teste de ordenação em
`functional-gate.mjs`: simetria legítima de teste, mantida de propósito porque extraí-la
pioraria a legibilidade. O `@font-face` com `unicode-range` repetido por peso de fonte é o
outro piso irredutuvel — por isso a meta não é 0%, que forçaria contorcer código correto.

Ajustes por variável de ambiente: `DUP_MAX_PERCENT`, `DUP_MAX_CLONE_LINES`, `DUP_MIN_LINES`,
`DUP_MIN_TOKENS`. Relatório em `audit/reports/jscpd/jscpd-report.json` (artefato do CI).

> `--max-size 5mb` é obrigatório: o default do jscpd (100 kb) ignoraria silenciosamente o
> `public/index.html` (~105 kb) e reportaria um falso "0 clones".

### Gate 8 · Lighthouse CI (`lighthouserc.json`)

Mediana de **3 execuções**, preset desktop, servindo `./public` via `staticDistDir`.

| Assertion                                                                                                         | Limite     | Medido    |
| ----------------------------------------------------------------------------------------------------------------- | ---------- | --------- |
| `categories:accessibility`                                                                                        | = 100      | 100       |
| `categories:best-practices`                                                                                       | = 100      | 100       |
| `categories:seo`                                                                                                  | = 100      | 100       |
| `categories:performance`                                                                                          | ≥ 99       | 100       |
| `first-contentful-paint`                                                                                          | ≤ 1200 ms  | ~1353 ms* |
| `largest-contentful-paint`                                                                                        | ≤ 1500 ms  | ~1503 ms* |
| `total-blocking-time`                                                                                             | ≤ 100 ms   | 0 ms      |
| `cumulative-layout-shift`                                                                                         | ≤ 0.02     | 0.000     |
| `speed-index`                                                                                                     | ≤ 1500 ms  | ~1353 ms  |
| `interactive`                                                                                                     | ≤ 1800 ms  | ~1353 ms  |
| `total-byte-weight`                                                                                               | ≤ 400 KB   | ~90 KB    |
| `dom-size`                                                                                                        | ≤ 1200 nós | 1117      |
| `color-contrast`, `heading-order`, `label`, `th-has-data-cells`, `errors-in-console`, `render-blocking-resources` | = 100      | 100       |

\* Valores medidos com `lighthouse` CLI direto; sob `staticDistDir` do LHCI as métricas ficam
abaixo dos limites. A variância observada entre execuções é < 2 ms.

Auditorias diagnósticas desligadas com justificativa em `lighthouserc.json`:
`dom-size-insight` e `network-dependency-tree-insight` (inerentes a uma tabela de 78×7 e ao
preload de fontes), mais `cache-insight`/`document-latency-insight` (dependem do servidor, não do código).
Em troca, foram ativados gates numéricos explícitos de `dom-size` e `total-byte-weight`.

## Hooks de git

- **pre-commit** — barato (~2 s): bloqueia commit de relatórios/evidências, impede
  reintrodução de `fonts.googleapis.com`, valida a presença de marcação essencial
  (`<main>`, `<caption>`, `role="search"`, `aria-live`) e roda o **gate de build** (schema de
  `data/tributos.json` e sincronia com `public/`) e o **gate de estilo** (indentação, espaços,
  imports, padrão de código). Se `node_modules` não existir, os dois são pulados com aviso —
  o CI continua sendo a rede definitiva.
- **pre-push** — executa os 8 gates. Escape de emergência: `SKIP_GATES=1 git push`
  (deve ser justificado no PR).

No CI, build e estilo rodam em um **job separado** (`estilo`) do qual o job `gates` depende:
um dado inválido ou um erro de indentação falham em segundos em vez de consumir os minutos
de navegador.

## Sistema de ícones

**Lucide** (ISC) — 47 ícones escolhidos por conceito do domínio, embutidos como CSS
por `audit/gen-icons.mjs`. O objetivo é reduzir carga cognitiva: a coluna Esfera passa a
ser reconhecível por bandeira/mapa/prédio e o Status por ícone + cor, sem precisar ler o texto.

### Por que `mask-image` em `::before` e não `<svg>` inline ou `<img>`

| Critério                | `<svg>` inline                   | `<img>`             | **`mask-image` em `::before`**   |
| ----------------------- | -------------------------------- | ------------------- | -------------------------------- |
| Nós no DOM              | +5 a +8 por ícone (~1.500 total) | +1 por ícone (+253) | **0**                            |
| Requisições             | 0                                | +37                 | **0**                            |
| Herda cor do texto      | sim                              | não                 | **sim** (`background-color`)     |
| Ruído em leitor de tela | precisa `aria-hidden`            | precisa `alt=""`    | **impossível** (pseudo-elemento) |

O ponto decisivo foi o DOM: a tabela de 78×7, os comboboxes e as associações visuais usam **1117 dos 1200 nós**
permitidos pelo gate de Lighthouse. Com `<svg>` inline em cada linha o limite seria estourado.
Os ícones por CSS não acrescentam nós e mantêm espaço para os controles pesquisáveis.

### Regeneração

```bash
node audit/gen-icons.mjs > /tmp/icons.css   # ajuste o mapa ICONES no script
```

### Acessibilidade dos ícones

São **estritamente redundantes** com o texto: nenhum ícone é a única fonte de informação.
Três testes do gate funcional garantem isso — que todo ícone **desenha pixels de verdade**
(comparando cores num recorte da tela, o que pega data-URI corrompido), que **não há `<img>`
nem `<svg>` sem rótulo**, e que **toda célula mantém texto próprio**. axe-core continua com
0 violações e o Semantic Score em 100.

## Decisões de implementação

- **Fontes auto-hospedadas** (`public/fonts/`, 168 KB, subsets latin + latin-ext): elimina
  836 ms de render-blocking de `fonts.googleapis.com`, zera requisições a terceiros e levou
  o CLS de 0.037 → 0.000 via `preload`.
- **Tokens de cor separados para texto** (`--ok-text: #006630`, `--danger-text: #b02500`):
  as cores originais (`#00913f`, `#ff3b00`) reprovavam no `color-contrast` sobre o hover
  amarelo (3.13:1 e 2.73:1). Os tokens de texto garantem ≥ 4.5:1 nos três fundos
  (branco, zebra `#faf8f0` e hover `#ffe100`). O vermelho vibrante segue em uso decorativo.
- **Associação visual em fórmula causal e dinâmica**: a seção “Do cotidiano às obrigações” começa pelo objeto ou acontecimento reconhecível e explicita `situação + hipótese observada = obrigação`. Os quatro exemplos mudam com o perfil selecionado (`Pessoa física`, `MEI`, `Empresa e empregador` ou `Reforma tributária`). Ícone, texto e sigla permanecem juntos para preservar precisão e acessibilidade; por exemplo, `ter um veículo + propriedade do veículo automotor = IPVA`.
- **Ordenação com `<button>` dentro do `<th>`**: antes o handler estava no `<th>`, o que
  tornava a ordenação inacessível por teclado.
- **Coluna Sigla como `<th scope="row">`** com `<abbr title>` expandindo o nome completo.
- **`h1` com `clamp(22px, 5vw, 62px)` + `overflow-wrap: break-word`**: a 34px fixos a palavra
  "CONTRIBUIÇÕES," estourava 79px em 320px e propagava 38px de scroll horizontal ao documento.
- **Filtros deixam de ser sticky até 1000px**: empilhados, a barra chegava a 503px de altura —
  56% de uma viewport de 900px. Acima desse limite ela volta a ser sticky.
- **`min-height: 44px`** em `input`, `button` e `.th-btn`: os cabeçalhos de ordenação
  tinham 38px, abaixo do mínimo de alvo de toque da WCAG 2.5.5.

## Estrutura

```
data/
  tributos.json      # FONTE DA VERDADE do catálogo (78 itens, ver "De onde vem o catálogo")
  schema.json        # contrato de data/tributos.json (campos obrigatórios, id, enums)
src/
  index.template.html # o HTML completo com um marcador no lugar dos dados
public/              # ARTEFATO GERADO por audit/build.mjs — o que vai para o GitHub Pages
  index.html          # página completa (HTML + CSS + JS + dados injetados no build)
  favicon.svg
  fonts/              # 10 arquivos woff2 auto-hospedados
  api/
    tributos.json      # o mesmo catálogo em JSON, para consumo por terceiros
    tributos.csv        # o mesmo catálogo em CSV (BOM UTF-8)
audit/
  run-gates.mjs      # orquestrador: sobe servidor e roda os 8 gates
  build.mjs          # gera public/ a partir de data/tributos.json + src/index.template.html
  build-gate.mjs     # gate de build & schema (roda build.mjs --check)
  gen-icons.mjs      # gera o CSS de ícones a partir do lucide-static
  style-gate.mjs     # gate de estilo (higiene + Prettier + ESLint)
  functional-gate.mjs
  responsive-gate.mjs
  axe-gate.mjs
  semantic-gate.mjs
  semantic-core.mjs  # rubrica de 100 pontos
  duplication-gate.mjs # gate de duplicação (jscpd)
  browser.mjs        # URL, viewport, entrada no guia e relatórios compartilhados
lighthouserc.json
.editorconfig        # indentação/EOL/EOF para o editor
.prettierrc.json     # formatação canônica (+ .prettierignore)
eslint.config.mjs    # padrão de código e imports
.husky/              # pre-commit e pre-push
.github/workflows/ci.yml
Dockerfile           # alternativa de deploy via nginx
```

## Deploy alternativo (Docker/nginx)

```bash
docker build -t guia-tributos .
docker run -d -p 8080:80 guia-tributos
```

## O que está e o que não está aqui

Este é um catálogo público de referência, não uma lista oficial exaustiva nem um sistema de apuração. Incluímos tributos, contribuições, fundos, encargos trabalhistas, taxas regulatórias, documentos e mecanismos que ajudam a explicar o que uma pessoa ou empresa encontra no sistema brasileiro. Não incluímos cada taxa criada por município, cada tarifa/preço público, multas, obrigações acessórias ou variações de alíquota: sem uma fonte nacional estável, elas devem ser propostas com município/UF e fonte oficial.

A diferença para a lista de **100 entradas** publicada pelo [Portal Tributário](https://www.portaltributario.com.br/tributos.htm) foi auditada item a item em [`docs/auditoria-escopo.md`](docs/auditoria-escopo.md), com consulta em 11/08/2026. As 78 entradas deste Guia consolidam sinônimos e variantes (por exemplo, ISS/ISSQN e as modalidades de INSS), descartam itens não tributários ou históricos sem identidade própria e preservam taxas setoriais quando há uma categoria verificável. A auditoria não afirma vigência jurídica: cada item precisa de fonte primária na revisão.

Para propor cobertura local, use o [template de contribuição](.github/ISSUE_TEMPLATE/novo-item.yml) e leia [`CONTRIBUTING.md`](CONTRIBUTING.md). O CI valida campos, ids e enums antes de executar os gates estáticos.

## Conteúdo

Atualizado em **agosto de 2026**, refletindo a Reforma Tributária do Consumo (EC 132/2023,
LC 214/2025, LC 227/2026): CBS, IBS e IS em implementação; ICMS, ISS, PIS/Pasep e Cofins em transição.

Material informativo — não substitui a análise da legislação específica do ente ou da operação.

## Licença

O código do projeto é MIT (consulte [`LICENSE`](LICENSE)). O catálogo em `data/` e seus
artefatos de dados em `public/api/` são **CC BY 4.0** (consulte [`data/LICENSE`](data/LICENSE));
a atribuição deve apontar para este projeto.
