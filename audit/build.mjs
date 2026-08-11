#!/usr/bin/env node
/**
 * Build determinístico: data/tributos.json + src/index.template.html -> public/.
 *
 * public/index.html continua sendo o artefato estático servido pelo GitHub Pages —
 * este script apenas o gera, para que o catálogo (data/tributos.json) deixe de estar
 * embutido no HTML e possa ser versionado, validado e reutilizado (API, JSON-LD etc.).
 *
 * Uso:
 *   node audit/build.mjs          # gera public/index.html e public/api/*
 *   node audit/build.mjs --check  # gera em memória e falha se divergir do que está commitado
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const SITE_URL = 'https://igorguariroba.github.io/guia-tributos-brasil/';

const REQUIRED_FIELDS = [
  'id',
  'sigla',
  'nome',
  'tipo',
  'esfera',
  'contexto',
  'descricao',
  'status',
];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validar(dados) {
  const erros = [];
  if (!Array.isArray(dados) || dados.length === 0) {
    erros.push('data/tributos.json precisa ser um array não vazio.');
    return erros;
  }
  const ids = new Set();
  dados.forEach((item, index) => {
    const rotulo = `item[${index}]${item?.sigla ? ` (${item.sigla})` : ''}`;
    if (item == null || typeof item !== 'object') {
      erros.push(`${rotulo}: não é um objeto.`);
      return;
    }
    for (const campo of REQUIRED_FIELDS) {
      const valor = item[campo];
      if (typeof valor !== 'string' || valor.trim() === '') {
        erros.push(`${rotulo}: campo obrigatório "${campo}" ausente ou vazio.`);
      }
    }
    const chavesExtras = Object.keys(item).filter(k => !REQUIRED_FIELDS.includes(k));
    if (chavesExtras.length) {
      erros.push(`${rotulo}: campo(s) não previstos no schema: ${chavesExtras.join(', ')}.`);
    }
    if (typeof item.id === 'string') {
      if (!ID_PATTERN.test(item.id)) {
        erros.push(`${rotulo}: id "${item.id}" não casa com ${ID_PATTERN}.`);
      }
      if (ids.has(item.id)) {
        erros.push(`${rotulo}: id "${item.id}" duplicado.`);
      }
      ids.add(item.id);
    }
  });
  return erros;
}

function paraRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`;
}

function paraSitemap() {
  // Uma única URL indexável: o site é uma SPA de página única sem roteamento de
  // servidor. Fragmentos (#item-x) não são páginas distintas para crawlers — não
  // entram no sitemap até existir deep-link funcional com estado inicial (fase
  // 2.2 do plano de melhoria) que justifique tratá-los como URLs próprias.
  // Sem <lastmod>: o build precisa ser determinístico byte a byte (Gate de
  // build/--check); uma data "hoje" tornaria o artefato divergente todo dia
  // mesmo sem mudança real no catálogo.
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function paraJsonLd(dados) {
  // DefinedTermSet/DefinedTerm: expõe o catálogo como dado estruturado para que
  // buscadores entendam a página como um glossário de termos, não como texto solto.
  // @id de cada termo aponta para a URL do site com o id estável do catálogo (o
  // deep-link por item ainda não existe — fase 2.2 — mas o identificador já é
  // estável e reaproveitável quando o link funcional existir).
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${SITE_URL}#catalogo`,
    name: 'Guia de Tributos, Contribuições, Taxas e Encargos do Brasil',
    description:
      'Catálogo de tributos, contribuições, taxas e encargos do Brasil: sigla, tipo, esfera, contexto e status na Reforma Tributária.',
    url: SITE_URL,
    inLanguage: 'pt-BR',
    hasDefinedTerm: dados.map(item => ({
      '@type': 'DefinedTerm',
      '@id': `${SITE_URL}#${item.id}`,
      name: item.nome,
      alternateName: item.sigla,
      description: item.descricao,
      inDefinedTermSet: `${SITE_URL}#catalogo`,
    })),
  };
}

function paraCsv(dados) {
  const cols = ['id', 'sigla', 'nome', 'tipo', 'esfera', 'contexto', 'descricao', 'status'];
  const header = [
    'ID',
    'Sigla',
    'Nome',
    'Tipo/Natureza',
    'Esfera',
    'Contexto',
    'Descrição',
    'Status',
  ];
  const quote = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [
    header.map(quote).join(';'),
    ...dados.map(x => cols.map(c => quote(x[c])).join(';')),
  ];
  return `\uFEFF${linhas.join('\n')}\n`;
}

async function main() {
  const dadosBrutos = await readFile('data/tributos.json', 'utf8');
  const dados = JSON.parse(dadosBrutos);

  const erros = validar(dados);
  if (erros.length) {
    console.error(`✗ data/tributos.json inválido (${erros.length} erro(s)):`);
    erros.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  const template = await readFile('src/index.template.html', 'utf8');
  const marcador = 'const DATA = __TRIBUTOS_DATA__;\n';
  if (!template.includes(marcador)) {
    console.error(`✗ src/index.template.html não contém o marcador esperado: ${marcador.trim()}`);
    process.exit(1);
  }
  const marcadorJsonLd = '<!-- __TRIBUTOS_JSONLD__ -->';
  if (!template.includes(marcadorJsonLd)) {
    console.error(`✗ src/index.template.html não contém o marcador esperado: ${marcadorJsonLd}`);
    process.exit(1);
  }
  const jsonLd = paraJsonLd(dados);
  const scriptJsonLd = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  const htmlGerado = template
    .replace(marcador, `const DATA = ${JSON.stringify(dados)};\n`)
    .replace(marcadorJsonLd, scriptJsonLd);

  const apiJson = `${JSON.stringify(dados, null, 2)}\n`;
  const apiCsv = paraCsv(dados);

  const alvos = [
    ['public/index.html', htmlGerado],
    ['public/api/tributos.json', apiJson],
    ['public/api/tributos.csv', apiCsv],
    ['public/robots.txt', paraRobots()],
    ['public/sitemap.xml', paraSitemap()],
  ];

  if (CHECK) {
    let divergente = false;
    for (const [caminho, conteudo] of alvos) {
      if (!existsSync(caminho)) {
        console.error(
          `✗ ${caminho} não existe. Rode "node audit/build.mjs" e commite o resultado.`,
        );
        divergente = true;
        continue;
      }
      const atual = await readFile(caminho, 'utf8');
      if (atual !== conteudo) {
        console.error(
          `✗ ${caminho} está desatualizado em relação a data/tributos.json e src/index.template.html.`,
        );
        console.error(`  Rode "node audit/build.mjs" e commite o resultado.`);
        divergente = true;
      }
    }
    if (divergente) process.exit(1);
    console.log(`✓ ${dados.length} itens — public/ sincronizado com data/tributos.json.`);
    return;
  }

  await mkdir('public/api', { recursive: true });
  for (const [caminho, conteudo] of alvos) {
    await writeFile(caminho, conteudo);
  }
  console.log(
    `✓ build gerado a partir de ${dados.length} itens: public/index.html, public/api/tributos.json, public/api/tributos.csv.`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
