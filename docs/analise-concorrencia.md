# Análise competitiva — Guia de Tributos, Contribuições, Taxas e Encargos do Brasil

Data: agosto de 2026 · Base: `public/index.html` (78 itens, 7 campos), README e inspeção
direta dos concorrentes com navegador (Playwright).

---

## 1. Quem já resolve (ou tenta resolver) o mesmo problema

O problema atendido é: **"vi uma sigla tributária/trabalhista e quero saber, em segundos,
o que é, quem cobra, em que contexto aparece e se a Reforma mudou algo"**.

### 1.1 Concorrentes diretos (lista/glossário de siglas)

| Solução                                                                                                                                   | O que é                                                    | Busca/filtro            | Export/API       | Reforma               | Pontos fracos observados                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------- | ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Portal Tributário — "Os tributos no Brasil"** (`portaltributario.com.br/tributos.htm`) — a lista canônica, copiada por dezenas de blogs | `<ul>` com ~93 itens, cada um linkando a lei               | **Nenhuma** (só Ctrl+F) | Não              | Praticamente ausente  | Layout de 2005, sem responsividade, publicidade, sem tipo/esfera/status estruturados, sem descrição — só nome + lei. Inspecionado: 100 `<listitem>`, 1 campo de busca (do site, não da lista) |
| **Dootax — Lista de tributos brasileiros**                                                                                                | Republicação da lista do Portal Tributário em post de blog | Não                     | Não              | Menção genérica       | Conteúdo isca para SaaS; sem manutenção; sem taxonomia                                                                                                                                        |
| **Glossário da Reforma Tributária — Receita Federal** (3ª versão, mai/2026)                                                               | PDF oficial de termos da RTC                               | Não (PDF)               | Não              | **Autoridade máxima** | PDF: sem filtro, sem link direto por termo, sem mobile decente; cobre **só** consumo — ignora folha, Sistema S, taxas regulatórias, documentos de arrecadação                                 |
| **Glossário Avalara / Thomson Reuters / consultorias**                                                                                    | Página de conteúdo por termo                               | Busca do site           | Não              | Sim                   | Marketing gate: conteúdo raso, CTA para produto, cookies/trackers, LCP alto                                                                                                                   |
| **Wikipedia "Lista de tributos do Brasil"**                                                                                               | Tabela wiki                                                | Busca do navegador      | Wikidata parcial | Desatualizada         | Sem status de transição, sem contexto de uso, curadoria irregular                                                                                                                             |

### 1.2 Adjacentes (mesmo público, outra dor)

| Solução                                    | Faz melhor que nós                                                                                    | Não faz                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Impostômetro (IBPT / impostometro.org)** | Números de arrecadação em tempo real, ranking por estado, timeline visual da Reforma, marca conhecida | Não é glossário: não explica o que cada sigla é, nem tipo/esfera/status por item       |
| **Tabela IBPT / De Olho no Imposto**       | Dados por NCM/LC 116, **API** consumida por ERPs, vigência datada                                     | Só carga tributária aproximada por produto; exige cadastro; não é navegável por humano |
| **consumo.tributos.gov.br (RFB, beta)**    | Calculadora oficial de CBS/IBS, apuração assistida, **API credenciada**                               | Exige gov.br; é operação, não consulta rápida; nada sobre tributos fora do consumo     |
| **CGIBS (cgibs.gov.br)**                   | Fonte primária de cronograma e leiautes do IBS                                                        | Portal institucional de notícias; sem catálogo consultável                             |
| **Contabilizei/Contábeis/Jornal Contábil** | SEO e volume de conteúdo                                                                              | Artigos dispersos, ads, sem base estruturada                                           |

### 1.3 Conclusão do mapeamento

Não foi encontrado **nenhum** produto que combine, num único artefato: catálogo
estruturado + filtros multidimensionais + status da Reforma por item + export + acesso
instantâneo sem cadastro. O mercado é bipolar: **listas estáticas grátis e mortas** de um
lado, **SaaS fiscal pago/credenciado** do outro. O meio-termo — referência pública,
navegável e viva — está vago.

---

## 2. O que este projeto já faz melhor

1. **Taxonomia real, não lista plana.** 7 campos por item (`sigla, nome, tipo, esfera,
contexto, descricao, status`) contra "nome + link da lei" dos concorrentes. Permite
   filtrar por esfera, tipo, contexto e status — nenhum concorrente direto tem isso.
2. **Distingue o que não é tributo.** `Documento de arrecadação` (DARF, DAS, GPS),
   `Fator de cálculo` (FAP), `Mecanismo de tributação` (come-cotas), `Regime` (Simples,
   RET). Isso é a fonte nº 1 de confusão do público e ninguém trata explicitamente.
3. **Status da Reforma por item.** `Em transição`, `Implementação 2026`, `Não instituído`,
   `Varia por município` — a Reforma vira um atributo consultável, não um artigo à parte.
4. **Perfis de interesse** (Pessoa física, MEI, Empresa, Reforma) com associações causais
   dinâmicas (`situação + hipótese = obrigação`). Isso é onboarding cognitivo; concorrentes
   entregam a lista crua.
5. **Escopo mais largo que "tributos".** Inclui encargo trabalhista (FGTS), Sistema S,
   taxas regulatórias setoriais (FISTEL, ANVISA, aviação, agropecuária), compensações
   financeiras (CFEM/CFURH) — o mapa mental completo de "coisas que a empresa paga".
6. **Qualidade técnica sem paralelo no nicho.** Lighthouse 100/100/100/100, axe-core 0
   violações, ~90 KB, 0 requisições a terceiros, 5 requisições totais, LCP 0.3 s. Os
   concorrentes carregam ads, trackers e frameworks.
7. **Export CSV com BOM UTF-8** — abre no Excel brasileiro sem quebrar acento. Nenhum
   concorrente direto exporta.
8. **Sem cadastro, sem cookie, sem paywall, sem ad.** Diferencial de confiança relevante
   num nicho dominado por captura de lead.
9. **Estilo brutalista memorável.** Num mar de templates WordPress genéricos, identidade
   visual é retenção.

---

## 3. Onde podemos melhorar

Ordenado por **impacto ÷ esforço**. Cada item traz o porquê competitivo.

### P0 — alto impacto, esforço baixo/médio

| #   | Melhoria                                                                                                              | Por quê                                                                                                                                                       | Como                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Base normativa por item** (campo `fundamento` + link)                                                               | O Portal Tributário vence em uma única coisa: cada item aponta a lei. Hoje temos leis só no rodapé, genéricas. Sem isso não somos citáveis por profissional   | Novo campo `fundamento: {texto, url}`; render como link no `<details>`/coluna; gate funcional exigindo 100% de cobertura |
| 2   | **URL profunda por item e por filtro**                                                                                | Hoje só `?profile=`. Não dá para mandar "olha o IBS aqui" no WhatsApp. Isso mata compartilhamento e SEO de cauda longa (`o que é CPRB`)                       | Serializar `q`, `tipo`, `esfera`, `status` na query e `#sigla-XXX` com scroll/expand; `popstate`                         |
| 3   | **SEO estruturado** (JSON-LD `DefinedTermSet`/`DefinedTerm`, canonical, OG/Twitter, sitemap, robots)                  | Zero metadados sociais e zero dados estruturados hoje. O tráfego do nicho é 100% orgânico; sem isso o Google nunca vai preferir a página ao Portal Tributário | Bloco `<script type="application/ld+json">` gerado do mesmo `DATA`; `og:image` estático; `sitemap.xml`                   |
| 4   | **Dados como artefato público** (`data/tributos.json` + `tributos.csv` versionados, servidos em `/api/tributos.json`) | Vira infraestrutura: ERPs, planilhas e outros agentes consomem. Nenhum concorrente grátis expõe JSON limpo. É o caminho para virar referência citada          | Extrair `DATA` do HTML para JSON fonte-da-verdade; build injeta no HTML; gate valida sincronia                           |
| 5   | **Versionamento e data por item** (`atualizado_em`, `vigencia`)                                                       | "Atualizado em agosto de 2026" no rodapé não diz nada sobre um item específico. Tributário exige rastreabilidade temporal                                     | Campo por item + coluna opcional + filtro "alterados nos últimos 90 dias"                                                |
| 6   | **`<abbr>` só na sigla é pouco: sinônimos e erros comuns na busca**                                                   | Usuário digita "INSS patronal", "imposto do MEI", "ISSQN", "carnê-leão"                                                                                       | Campo `aliases: []` incluído no índice de busca; testes de busca por sinônimo                                            |

### P1 — diferenciação de produto

| #   | Melhoria                                                                                                                                     | Por quê                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **Mapa "de-para" da Reforma** (ICMS+ISS→IBS, PIS+Cofins→CBS, IPI→IS/IBS) como relação explícita entre itens (`substituido_por`, `substitui`) | É a pergunta nº 1 do mercado em 2026. Hoje a informação está solta na descrição. Vira funcionalidade única: filtrar "o que morre", "o que nasce", ver o par                              |
| 8   | **Linha do tempo da transição 2026→2033** por item                                                                                           | O Impostômetro tem timeline e nós não; combinada ao catálogo, seria imbatível                                                                                                            |
| 9   | **Quem paga / quando paga / onde se recolhe** (campos `sujeito_passivo`, `periodicidade`, `guia`)                                            | Completa o modelo mental. Liga naturalmente com os documentos de arrecadação já catalogados (DARF/DAS/GPS)                                                                               |
| 10  | **Cobertura declarada e auditável**                                                                                                          | Portal Tributário anuncia ~93 itens, nós 78. Precisamos ou cobrir a diferença ou publicar critério explícito de escopo (o que é excluído e por quê) — hoje só há uma nota vaga no rodapé |
| 11  | **Modo comparação** (selecionar 2–4 siglas e ver lado a lado)                                                                                | ITBI vs ITCMD, CBS vs COFINS, RAT vs FAP são confusões clássicas                                                                                                                         |
| 12  | **Página/impressão** (`@media print`) e "copiar como Markdown"                                                                               | Contador cola em parecer/e-mail; export CSV não cobre esse caso                                                                                                                          |

### P2 — alcance e operação

| #   | Melhoria                                                                                                           | Por quê                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **PWA/offline** (service worker)                                                                                   | Já são 90 KB estáticos; offline é quase de graça e útil em fiscalização de campo                                                       |
| 14  | **i18n en-US**                                                                                                     | Investidor/matriz estrangeira procurando "Brazilian taxes explained" não tem boa opção. Público de alto valor, concorrência quase nula |
| 15  | **Pipeline de atualização** (checklist trimestral + issue template + gate que falha se `atualizado_em` > 180 dias) | O maior risco do produto não é técnico: é apodrecer como os concorrentes                                                               |
| 16  | **Contribuição da comunidade para taxas municipais/estaduais**                                                     | O rodapé admite que a lista local é incompleta. Crowdsourcing com schema validado em CI resolve o que curadoria central não escala     |
| 17  | **Analytics sem cookie** (contagem de buscas sem resultado)                                                        | Buscas vazias são o roadmap de conteúdo escrito pelo usuário. Hoje o estado vazio é acessível mas silencioso                           |
| 18  | **Embed** (`<iframe>`/web component de uma sigla)                                                                  | Blogs contábeis embedariam; backlinks e autoridade                                                                                     |

### Dívidas técnicas relacionadas

- `DATA` embutido no HTML impede reuso e força o gate de duplicação a rodar sobre dados
  (`--max-size 5mb`). Extrair para JSON resolve os itens 4, 5 e 15 de uma vez.
- Duplicata real na base: `TFF` aparece duas vezes (municipal e telecom) e `ISS`/`ISSQN`
  são o mesmo tributo — sem campo de identidade estável (`id`), deep-link (item 2) e API
  (item 4) ficam ambíguos. **Adicionar `id` único é pré-requisito dos dois.**
- Gate de DOM em 1117/1200 nós já limita crescimento do catálogo. Antes de ir de 78 para
  ~120 itens é preciso decidir: virtualização, paginação ou elevar o teto com evidência.

---

## 4. Posicionamento recomendado

> **"O catálogo estruturado e aberto do que o Brasil cobra — inclusive o que a Reforma está
> trocando."**

Três apostas que nenhum concorrente cobre simultaneamente:

1. **Estruturado e citável** — cada item com fundamento legal, id estável e URL própria (P0 1–3).
2. **Aberto como dado** — JSON/CSV públicos, versionados, sem cadastro (P0 4).
3. **Vivo** — data por item, de-para da Reforma e processo de atualização auditado por CI (P0 5, P1 7–8, P2 15).

Sequência sugerida: `id` estável → extrair `DATA` para JSON → deep-link + JSON-LD →
`fundamento` → de-para da Reforma.
