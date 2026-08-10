# Guia de Tributos, Contribuições, Taxas e Encargos do Brasil

[![Gates de qualidade](https://github.com/IgorGuariroba/guia-tributos-brasil/actions/workflows/ci.yml/badge.svg)](https://github.com/IgorGuariroba/guia-tributos-brasil/actions/workflows/ci.yml)
![Lighthouse 100](https://img.shields.io/badge/Lighthouse-100%2F100%2F100%2F100-006630)
![axe-core 0 violações](https://img.shields.io/badge/axe--core-0%20viola%C3%A7%C3%B5es-006630)
![Semantic HTML Score 100](https://img.shields.io/badge/Semantic%20HTML-100%2F100-006630)

Página estática, sem dependências de runtime, que reúne **78 siglas** do sistema tributário,
trabalhista, regulatório e financeiro brasileiro — com busca, filtros por tipo/esfera/contexto/status,
ordenação por coluna e exportação para CSV. Estilo visual **brutalista**.

🔗 **Publicado em:** https://igorguariroba.github.io/guia-tributos-brasil/

## Estado de qualidade

| Métrica | Resultado |
|---|---|
| Lighthouse — Performance | **100** |
| Lighthouse — Accessibility | **100** |
| Lighthouse — Best Practices | **100** |
| Lighthouse — SEO | **100** |
| axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) | **0 violações** |
| Semantic HTML Score | **100/100 (A)** |
| Testes funcionais | **12/12** |
| Responsividade | **8 larguras + 3 dispositivos, 0 problemas** |
| Requisições a terceiros | **0** (fontes auto-hospedadas) |
| Peso total | ~78 KB |

Medido **na URL de produção** (`--preset=desktop`): LCP **0.3 s**, CLS **0**, TBT **0 ms**,
5 requisições, nenhuma externa.

## Como rodar localmente

```bash
npm ci
npx playwright install chromium
npm run serve          # abre http://localhost:8080
```

## Gates de qualidade

Os gates rodam automaticamente no **pre-push** (husky) e no **CI** (GitHub Actions).
São propositalmente exigentes: qualquer regressão bloqueia o push.

```bash
npm run gates              # todos os 5 gates
npm run gate:funcional     # somente Playwright
npm run gate:responsivo    # somente responsividade (320→1920px)
npm run gate:a11y          # somente axe-core
npm run gate:semantica     # somente Semantic HTML Score
npm run gate:lighthouse    # somente Lighthouse CI
```

### Gate 1 · Funcional (`audit/functional-gate.mjs`)

12 asserções sobre a página real, para que os gates de qualidade não aprovem uma página quebrada:
carga inicial (78 linhas), busca textual, busca sem acento, estado vazio com `role=status`,
reset do formulário, filtro por `<select>`, **ordenação acionável por teclado** com `aria-sort`
exclusivo, skip-link com destino focável, CSV (BOM UTF-8, 7 colunas, 79 linhas),
`<abbr title>` em todas as siglas, zero recursos externos e console sem erros.

### Gate 2 · Responsividade (`audit/responsive-gate.mjs`)

Audita **8 larguras** e falha se qualquer uma tiver problema:

| Largura | Alvo | Layout esperado |
|---:|---|---|
| 320px | celular pequeno | cards 1col, filtros 1col |
| 375px | iPhone | cards 1col, filtros 1col |
| 390px | celular moderno | cards 1col, filtros 1col |
| 768px | tablet | cards 2col, filtros 2col |
| 1024px | tablet/desktop pequeno | cards 4col, filtros 5col |
| 1280px | desktop | cards 4col, filtros 5col |
| 1440px | desktop | cards 4col, filtros 5col |
| 1920px | monitor grande | cards 4col, filtros 5col |

Mais **3 dispositivos reais** emulados (iPhone 14, Pixel 7, iPad Mini) com `isMobile` e DPR corretos.

Verificações por largura:

1. **zero scroll horizontal** no documento
2. **nenhum elemento estourando** a viewport (o scroller da tabela é exceção intencional)
3. **alvos de toque ≥ 44×44 px** em viewports touch (≤ 768px) — WCAG 2.5.5
4. **sem sobreposição** entre controles de filtro
5. **legibilidade**: corpo ≥ 14px, textos ≥ 12px
6. tabela rolável sem vazar do container
7. barra sticky com folga de scroll e **ocupando ≤ 40% da viewport** (se não couber, deve deixar de ser sticky)
8. **filtro e reset funcionam** naquela largura (comportamento, não só layout)

### Gate 3 · Acessibilidade (`audit/axe-gate.mjs`)

axe-core com as tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.
**Exige 0 violações** e audita **3 estados** do DOM, já que a tabela é renderizada por JS:

1. carga inicial (78 itens)
2. filtrado (1 item)
3. estado vazio (0 itens, live region ativa)

O CI executa também o `@axe-core/cli` como verificação independente.

### Gate 4 · HTML semântico (`audit/semantic-gate.mjs`)

Rubrica de 100 pontos em 7 categorias (`audit/semantic-core.mjs`), avaliada no DOM renderizado.
**Mínimo exigido: 100.**

| Categoria | Peso | O que verifica |
|---|---:|---|
| Landmarks | 20 | `<main>` único, `header`/`footer`, `section`/`article`, `role=search` |
| Headings | 15 | um só `<h1>`, nenhum nível pulado, heading por seção |
| Formulários | 20 | rótulo acessível em todo controle, `type` nos botões, `fieldset`/`legend` |
| Tabela | 20 | `thead`/`tbody`, `th[scope]`, `caption`, `aria-sort`, cabeçalho focável |
| Divitis | 10 | proporção de `div`/`span` ≤ 15% dos elementos |
| Texto | 8 | listas reais, `strong`/`em` (não `b`/`i`), `time`/`abbr` |
| Dinâmico | 7 | contador em `aria-live`, estado vazio anunciável |

### Gate 5 · Lighthouse CI (`lighthouserc.json`)

Mediana de **3 execuções**, preset desktop, servindo `./public` via `staticDistDir`.

| Assertion | Limite | Medido |
|---|---|---|
| `categories:accessibility` | = 100 | 100 |
| `categories:best-practices` | = 100 | 100 |
| `categories:seo` | = 100 | 100 |
| `categories:performance` | ≥ 99 | 100 |
| `first-contentful-paint` | ≤ 1200 ms | ~1353 ms* |
| `largest-contentful-paint` | ≤ 1500 ms | ~1503 ms* |
| `total-blocking-time` | ≤ 100 ms | 0 ms |
| `cumulative-layout-shift` | ≤ 0.02 | 0.000 |
| `speed-index` | ≤ 1500 ms | ~1353 ms |
| `interactive` | ≤ 1800 ms | ~1353 ms |
| `total-byte-weight` | ≤ 400 KB | ~78 KB |
| `dom-size` | ≤ 1200 nós | 972 |
| `color-contrast`, `heading-order`, `label`, `th-has-data-cells`, `errors-in-console`, `render-blocking-resources` | = 100 | 100 |

\* Valores medidos com `lighthouse` CLI direto; sob `staticDistDir` do LHCI as métricas ficam
abaixo dos limites. A variância observada entre execuções é < 2 ms.

Auditorias diagnósticas desligadas com justificativa em `lighthouserc.json`:
`dom-size-insight` e `network-dependency-tree-insight` (inerentes a uma tabela de 78×7 e ao
preload de fontes), mais `cache-insight`/`document-latency-insight` (dependem do servidor, não do código).
Em troca, foram ativados gates numéricos explícitos de `dom-size` e `total-byte-weight`.

## Hooks de git

- **pre-commit** — barato e instantâneo: bloqueia commit de relatórios/evidências, impede
  reintrodução de `fonts.googleapis.com` e valida a presença de marcação essencial
  (`<main>`, `<caption>`, `role="search"`, `aria-live`).
- **pre-push** — executa os 5 gates. Escape de emergência: `SKIP_GATES=1 git push`
  (deve ser justificado no PR).

## Decisões de implementação

- **Fontes auto-hospedadas** (`public/fonts/`, 168 KB, subsets latin + latin-ext): elimina
  836 ms de render-blocking de `fonts.googleapis.com`, zera requisições a terceiros e levou
  o CLS de 0.037 → 0.000 via `preload`.
- **Tokens de cor separados para texto** (`--ok-text: #006630`, `--danger-text: #b02500`):
  as cores originais (`#00913f`, `#ff3b00`) reprovavam no `color-contrast` sobre o hover
  amarelo (3.13:1 e 2.73:1). Os tokens de texto garantem ≥ 4.5:1 nos três fundos
  (branco, zebra `#faf8f0` e hover `#ffe100`). O vermelho vibrante segue em uso decorativo.
- **Ordenação com `<button>` dentro do `<th>`**: antes o handler estava no `<th>`, o que
  tornava a ordenação inacessível por teclado.
- **Coluna Sigla como `<th scope="row">`** com `<abbr title>` expandindo o nome completo.
- **`h1` com `clamp(22px, 5vw, 62px)` + `overflow-wrap: break-word`**: a 34px fixos a palavra
  "CONTRIBUIÇÕES," estourava 79px em 320px e propagava 38px de scroll horizontal ao documento.
- **Filtros deixam de ser sticky até 1000px**: empilhados, a barra chegava a 503px de altura —
  56% de uma viewport de 900px. Acima desse limite ela volta a ser sticky.
- **`min-height: 44px`** em `input`, `select`, `button` e `.th-btn`: os cabeçalhos de ordenação
  tinham 38px, abaixo do mínimo de alvo de toque da WCAG 2.5.5.

## Estrutura

```
public/              # o que vai para o GitHub Pages
  index.html         # página completa (HTML + CSS + JS + dados)
  favicon.svg
  fonts/             # 10 arquivos woff2 auto-hospedados
audit/
  run-gates.mjs      # orquestrador: sobe servidor e roda os 5 gates
  functional-gate.mjs
  responsive-gate.mjs
  axe-gate.mjs
  semantic-gate.mjs
  semantic-core.mjs  # rubrica de 100 pontos
lighthouserc.json
.husky/              # pre-commit e pre-push
.github/workflows/ci.yml
Dockerfile           # alternativa de deploy via nginx
```

## Deploy alternativo (Docker/nginx)

```bash
docker build -t guia-tributos .
docker run -d -p 8080:80 guia-tributos
```

## Conteúdo

Atualizado em **agosto de 2026**, refletindo a Reforma Tributária do Consumo (EC 132/2023,
LC 214/2025, LC 227/2026): CBS, IBS e IS em implementação; ICMS, ISS, PIS/Pasep e Cofins em transição.

Material informativo — não substitui a análise da legislação específica do ente ou da operação.

## Licença

MIT
