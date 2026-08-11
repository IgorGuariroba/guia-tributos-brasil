# Plano de melhoria — Guia de Tributos, Contribuições, Taxas e Encargos do Brasil

Derivado de [`analise-concorrencia.md`](analise-concorrencia.md). Data-base: agosto de 2026.

**Meta de 6 meses:** deixar de ser "uma página bonita com uma lista" e virar **a referência
pública, estruturada e citável** do que o Brasil cobra — a fonte que o contador linka no
parecer e que o ERP consome como JSON.

> **Status: concluído em agosto de 2026.** As 24 tarefas das fases 1–5 foram implementadas.
> Os critérios automatizados são cobertos pelos gates; a tarefa 5.6 usa agregação local
> exportável porque a entrega estática não permite consolidação entre visitantes sem runtime.

---

## 0. Princípios que o plano não pode quebrar

Estes são os ativos do projeto. Toda tarefa abaixo foi desenhada para preservá-los:

1. **Entrega estática, zero runtime.** O que vai ao Pages continua sendo HTML+CSS+JS inline
   sem framework e sem requisição a terceiros.
2. **Gates são a rede.** Nenhuma funcionalidade entra sem gate correspondente. Se um gate
   precisa de teto novo (ex.: DOM), o teto sobe com justificativa escrita, nunca em silêncio.
3. **Acessibilidade e performance não regridem.** Lighthouse 100×4, axe 0 violações.
4. **Precisão jurídica acima de conveniência.** Nada que sugira alíquota, cálculo ou
   conselho tributário. O produto descreve e classifica; não apura.

---

## 1. Decisão arquitetural que destrava tudo (fazer primeiro)

Hoje `DATA` (78 itens) vive embutido em `public/index.html`. Isso bloqueia,
simultaneamente, deep-link, API pública, JSON-LD, versionamento por item e contribuição
externa — cinco melhorias diferentes travadas no mesmo ponto.

**Proposta: separar dado de apresentação, com um passo de build determinístico.**

```
data/tributos.json          # fonte da verdade (versionada, revisável em PR)
data/schema.json            # JSON Schema do catálogo
src/index.template.html     # HTML sem os dados
audit/build.mjs             # template + dados -> public/index.html + public/api/*
public/                     # ARTEFATO GERADO (continua sendo o que vai ao Pages)
  index.html
  api/tributos.json
  api/tributos.csv
  sitemap.xml
```

Objeções previstas e respostas:

| Objeção                                                    | Resposta                                                                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Passa a ter build, perde a simplicidade"                  | O build é um único script Node sem dependências, ~100 linhas, determinístico. `public/` continua commitado e servível direto — quem clonar e abrir o HTML segue funcionando |
| "O gate de estilo ignora `public/index.html` de propósito" | Continua ignorando: agora ele é claramente um artefato. Prettier/ESLint passam a valer para `src/` e `data/`, que é onde a revisão humana acontece                          |
| "Risco de artefato dessincronizado do dado"                | Novo **Gate 8 · Build** roda `build.mjs` e falha se `git diff --exit-code public/` acusar diferença. Mesma técnica de "generated code is up to date"                        |

**Sem esta decisão, as fases 1 a 3 abaixo ficam todas mais caras.** Ela é o item #1.

---

## 2. Fases

Cada tarefa traz: esforço (P=pequeno ≤2h, M=médio ≤1 dia, G=grande >1 dia), arquivos e
**critério de aceite verificável** (o gate que prova que está pronto).

### Fase 1 — Fundação de dados (destrava o resto)

| #   | Tarefa                                                                                                                                                                                                          | Esf. | Aceite                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| 1.1 | **`id` único e estável por item** (slug: `iss`, `tff-municipal`, `tff-telecom`). Resolve a colisão real hoje existente: `TFF` aparece 2× e `ISS`/`ISSQN` são o mesmo tributo com siglas distintas               | P    | Gate funcional: nenhum `id` repetido; 78 ids; `id` casa `^[a-z0-9-]+$`     |
| 1.2 | **Extrair `DATA` para `data/tributos.json`** + `data/schema.json` + `audit/build.mjs`                                                                                                                           | M    | `node audit/build.mjs` reproduz `public/index.html` byte a byte            |
| 1.3 | **Gate 8 · Build & Schema** — valida schema (campos obrigatórios, enums de `tipo`/`esfera`/`status`) e sincronia do artefato                                                                                    | M    | `npm run gate:build` no pre-push e no CI; falha se `git diff` em `public/` |
| 1.4 | **Normalizar enums.** Hoje `status` tem valores livres (`Vigente / regras específicas`, `Denominação histórica/comum`, `Varia por município`). Separar em `status` (enum fechado) + `nota_status` (texto livre) | M    | Schema com `enum`; filtro de status deixa de ter 9 variantes quase iguais  |
| 1.5 | **Campos de rastreabilidade:** `atualizado_em` (ISO), `fontes: [{rotulo, url}]`                                                                                                                                 | P    | Schema exige ambos em 100% dos itens                                       |

**Marco 1:** o catálogo é um dado válido, versionado e auditado por CI.

---

### Fase 2 — Ser citável (maior ganho competitivo por esforço)

| #   | Tarefa                                                                                                                                                                | Esf. | Aceite                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **`fundamento` legal por item** — a única coisa em que o Portal Tributário nos vence hoje. Ex.: `{lei: "LC 214/2025", url: "..."}`. Preenchimento em lotes por `tipo` | G    | Gate: 100% dos itens com ≥1 fundamento; links validados (HEAD 200) em job semanal separado, não bloqueante do PR                      |
| 2.2 | **Deep-link por item e por estado de filtro.** `?q=&tipo=&esfera=&status=#item-iss` com `popstate`; abrir a página nesse endereço já expande o item e rola até ele    | M    | Gate funcional: navegar para URL com filtro renderiza N linhas esperadas; voltar/avançar do browser restaura estado; hash foca o item |
| 2.3 | **`aliases` na busca** — "INSS patronal", "imposto do MEI", "carnê-leão", "ISSQN", "imposto do consumo"                                                               | M    | Gate funcional: ≥10 buscas por sinônimo retornam o item certo                                                                         |
| 2.4 | **JSON-LD `DefinedTermSet` + `DefinedTerm`**, gerado do mesmo JSON no build                                                                                           | P    | Gate: JSON-LD parseia, tem 78 termos, ids batem com o catálogo                                                                        |
| 2.5 | **Metadados sociais e de indexação:** `canonical`, `og:*`, `twitter:*`, `og:image` estático, `robots.txt`, `sitemap.xml` (gerado). **Hoje não existe nenhum**         | M    | Gate: tags presentes; sitemap com todas as URLs de item; Lighthouse SEO segue 100                                                     |

**Marco 2:** um item pode ser compartilhado por link, encontrado pelo Google e citado com
base legal.

---

### Fase 3 — Ser infraestrutura (dado aberto)

| #   | Tarefa                                                                                                                                                                 | Esf. | Aceite                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| 3.1 | **API estática pública:** `/api/tributos.json` (+ `/api/tributos.csv`), com `version` e `gerado_em` no envelope                                                        | P    | Gate: JSON servido, valida contra o schema, contagem = catálogo         |
| 3.2 | **Documentar o contrato** no README: campos, enums, política de estabilidade de `id`, licença dos dados (sugestão: **CC BY 4.0** para `data/`, mantendo MIT no código) | P    | Seção no README + `data/LICENSE`                                        |
| 3.3 | **"Copiar como Markdown"** por item e `@media print`                                                                                                                   | M    | Gate funcional: botão copia texto esperado; gate responsivo cobre print |
| 3.4 | **Embed de item** (URL `?embed=iss` com layout mínimo)                                                                                                                 | M    | Gate funcional + axe no modo embed                                      |

**Marco 3:** terceiros conseguem consumir o catálogo sem copiar e colar.

---

### Fase 4 — Diferenciação de produto (Reforma)

| #   | Tarefa                                                                                                                                                          | Esf. | Aceite                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| 4.1 | **Relações de-para da Reforma:** `substituido_por: []` / `substitui: []` (ICMS+ISS→IBS, PIS+Cofins→CBS, IPI→IS/IBS). Renderizar como link recíproco entre itens | G    | Gate: toda relação é bidirecional e aponta para `id` existente; filtro "o que sai / o que entra" |
| 4.2 | **Linha do tempo da transição 2026→2033** por item (`vigencia: {inicio, fim, marcos: []}`)                                                                      | G    | Gate semântico: `<time datetime>` em todo marco; axe 0                                           |
| 4.3 | **Modo comparação** (2–4 siglas lado a lado) — ITBI×ITCMD, CBS×COFINS, RAT×FAP                                                                                  | G    | Gate funcional + responsivo (comparação em 320px vira empilhamento)                              |
| 4.4 | **`sujeito_passivo`, `periodicidade`, `guia`** (liga ao DARF/DAS/GPS já catalogados)                                                                            | M    | Schema + gate de cobertura ≥90% (nem todo item tem)                                              |

**Marco 4:** somos a melhor ferramenta do país para entender o que a Reforma troca.

---

### Fase 5 — Longevidade e alcance

| #   | Tarefa                                                                                                                                                                        | Esf. | Aceite                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| 5.1 | **Gate de frescor:** falha (ou avisa) se algum item passar de 180 dias sem revisão; issue trimestral automática                                                               | P    | `gate:frescor` no CI agendado (cron), não no pre-push                                           |
| 5.2 | **Contribuição externa** para taxas municipais/estaduais: `CONTRIBUTING.md`, issue template com schema, validação em CI do PR                                                 | M    | PR de terceiro com item inválido falha no CI com mensagem clara                                 |
| 5.3 | **Critério de escopo publicado.** Portal Tributário anuncia ~93 itens; temos 78. Ou cobrimos a diferença, ou documentamos por que ela existe (hoje só há nota vaga no rodapé) | M    | Seção "O que está e o que não está aqui" no README + auditoria item a item da lista concorrente |
| 5.4 | **PWA/offline** (service worker, ~90 KB já estáticos)                                                                                                                         | M    | Gate: funciona offline após primeira visita; Lighthouse segue 100                               |
| 5.5 | **i18n en-US** (`/en/`) — público estrangeiro tem quase zero opção boa                                                                                                        | G    | `hreflang`, gates rodando nas duas versões                                                      |
| 5.6 | **Analytics sem cookie de buscas sem resultado** — o roadmap de conteúdo escrito pelo usuário                                                                                 | M    | Sem cookie, sem terceiro no gate de rede; endpoint próprio ou log agregado                      |

---

## 3. Riscos e como mitigar

| Risco                                                                                             | Impacto                                                                          | Mitigação                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teto de DOM.** 1117/1200 nós hoje. Fases 2 e 4 acrescentam links, relações e timeline por linha | Alto — trava o crescimento do catálogo e novas features ao mesmo tempo           | Decidir **antes da Fase 2**: (a) detalhes por item só sob `<details>` já existente, (b) renderização virtualizada, ou (c) elevar o teto com medição de LCP/TBT provando ausência de regressão. Preferência: (a) → (c) |
| **Fundamento legal errado ou desatualizado**                                                      | Alto — destrói a credibilidade, que é o produto                                  | Revisão em lote por `tipo`, sempre linkando fonte primária (Planalto/RFB); disclaimer mantido; job semanal de link-check                                                                                              |
| **Build introduz dessincronia artefato/dado**                                                     | Médio                                                                            | Gate 8 com `git diff --exit-code`                                                                                                                                                                                     |
| **Escopo criativo** (calculadoras, alíquotas)                                                     | Alto — muda o produto de "referência" para "consultoria" e cria responsabilidade | Princípio 4 da seção 0: descrever e classificar, nunca apurar                                                                                                                                                         |
| **Projeto apodrecer** — o destino de todos os concorrentes                                        | Alto                                                                             | Fase 5.1 e 5.2: frescor auditado por CI + contribuição externa                                                                                                                                                        |
| **Gates ficarem lentos** com 8+ gates                                                             | Médio                                                                            | Manter separação já existente (estilo rápido em job próprio); `build`/`schema` são baratos e entram no pre-commit; navegador segue no pre-push                                                                        |

---

## 4. Sequência recomendada

```
1.1 id estável
 └─ 1.2 extrair dados + build
     ├─ 1.3 gate build/schema ── 1.4 enums ── 1.5 rastreabilidade
     ├─ 2.4 JSON-LD ── 2.5 SEO/social/sitemap
     ├─ 3.1 API estática ── 3.2 contrato + licença de dados
     └─ 2.2 deep-link ── 2.3 aliases
                          └─ 2.1 fundamento legal
                              └─ 4.1 de-para ── 4.2 timeline ── 4.3 comparação
                                                 └─ 5.x longevidade e alcance
```

**Primeira PR sugerida (escopo fechado, alto destravamento):** `1.1 + 1.2 + 1.3`.
Não muda um pixel da página, não mexe em nenhum gate existente, e transforma o catálogo em
dado auditável — pré-requisito de 11 das 20 tarefas restantes.

**Se só houver orçamento para três coisas:** `1.2` (dados fora do HTML), `2.5` (SEO —
hoje literalmente zero metadado social/estruturado) e `2.1` (fundamento legal — a única
vantagem real que o concorrente líder ainda tem sobre nós).
