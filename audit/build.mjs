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
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const SITE_URL = 'https://igorguariroba.github.io/guia-tributos-brasil/';
// A data-base do catálogo é a revisão que introduziu data/tributos.json. Ela é
// deliberadamente fixa: usar "agora" faria um build sem mudanças divergir.
const DATA_REVISAO = '2026-08-10T22:16:49-03:00';

const REQUIRED_FIELDS = [
  'id',
  'sigla',
  'nome',
  'tipo',
  'esfera',
  'contexto',
  'descricao',
  'status',
  'atualizado_em',
  'fontes',
  'fundamento',
  'sujeito_passivo',
  'periodicidade',
  'guia',
];
const STATUS_ENUM = [
  'Vigente',
  'Em transição',
  'Em implantação',
  'Varia por ente',
  'Não instituído',
  'Histórico',
];
const OPTIONAL_FIELDS = ['nota_status', 'aliases', 'substituido_por', 'substitui', 'vigencia'];
const URL_PATTERN = /^https:\/\//;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// A tradução é deliberadamente local e determinística: a edição em português
// continua sendo a fonte do catálogo e nenhum serviço externo participa do build.
const EN_GLOSSARY = [
  ['Reforma Tributária', 'Tax Reform'],
  ['tributos', 'taxes'],
  ['Tributos', 'Taxes'],
  ['contribuições', 'contributions'],
  ['Contribuições', 'Contributions'],
  ['taxas', 'fees'],
  ['Taxas', 'Fees'],
  ['encargos', 'charges'],
  ['Encargos', 'Charges'],
  ['Brasil', 'Brazil'],
  ['imposto', 'tax'],
  ['Imposto', 'Tax'],
  ['Contribuição', 'Contribution'],
  ['Taxa', 'Fee'],
  ['Vigente', 'In force'],
  ['Em transição', 'In transition'],
  ['Em implantação', 'Being implemented'],
  ['Varia por ente', 'Varies by jurisdiction'],
  ['Não instituído', 'Not enacted'],
  ['Histórico', 'Historical'],
  ['federal', 'federal'],
  ['estadual', 'state'],
  ['municipal', 'municipal'],
  ['União', 'Federal government'],
  ['O que é / quando aparece', 'What it is / when it appears'],
  ['Contexto', 'Context'],
  ['Esfera', 'Jurisdiction'],
  ['Status', 'Status'],
  ['Descrição', 'Description'],
  ['Tipo / natureza', 'Type / nature'],
  ['Fontes', 'Sources'],
  ['Fundamento legal', 'Legal basis'],
  ['Explorar tudo', 'Explore all'],
  ['Sem recorte', 'No filter'],
  ['Empresa e empregador', 'Business and employer'],
  ['Reforma tributária', 'Tax reform'],
  ['O que está mudando', 'What is changing'],
  ['Guia pesquisável', 'Searchable guide'],
  ['itens', 'items'],
  ['item', 'item'],
  ['resultados', 'results'],
  ['filtros', 'filters'],
  ['Nenhum', 'No'],
  ['Copiar Markdown', 'Copy Markdown'],
  ['Copiado', 'Copied'],
  ['Remover filtro', 'Remove filter'],
];
const traduzir = valor => EN_GLOSSARY.reduce((texto, [pt, en]) => texto.split(pt).join(en), valor);
const traduzirCatalogo = dados =>
  dados.map(item =>
    Object.fromEntries(
      Object.entries(item).map(([chave, valor]) => [
        chave,
        typeof valor === 'string'
          ? traduzir(valor)
          : Array.isArray(valor)
            ? valor.map(x => (typeof x === 'string' ? traduzir(x) : x))
            : valor,
      ]),
    ),
  );
function traduzirHtml(html) {
  return EN_GLOSSARY.reduce((texto, [pt, en]) => texto.split(pt).join(en), html).replace(
    'lang="pt-BR"',
    'lang="en-US"',
  );
}

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
      if (campo === 'aliases') {
        if (
          valor !== undefined &&
          (!Array.isArray(valor) || valor.some(alias => typeof alias !== 'string' || !alias.trim()))
        ) {
          erros.push(`${rotulo}: "aliases" deve ser uma lista de textos não vazios.`);
        }
      } else if (campo === 'guia') {
        if (
          valor !== null &&
          (typeof valor !== 'object' ||
            typeof valor.id !== 'string' ||
            typeof valor.rotulo !== 'string')
        ) {
          erros.push(`${rotulo}: guia deve ser null ou objeto com id e rotulo.`);
        }
      } else if (campo === 'fontes' || campo === 'fundamento') {
        if (!Array.isArray(valor) || valor.length < 1) {
          erros.push(`${rotulo}: "${campo}" deve ser uma lista não vazia.`);
        }
      } else if (campo === 'atualizado_em') {
        if (typeof valor !== 'string' || valor.trim() === '') {
          erros.push(`${rotulo}: campo obrigatório "${campo}" ausente ou vazio.`);
        }
      } else if (typeof valor !== 'string' || valor.trim() === '') {
        erros.push(`${rotulo}: campo obrigatório "${campo}" ausente ou vazio.`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.atualizado_em)) {
      erros.push(`${rotulo}: atualizado_em deve ser uma data ISO (AAAA-MM-DD).`);
    }
    for (const campo of ['fontes', 'fundamento']) {
      if (!Array.isArray(item[campo]) || item[campo].length < 1) {
        erros.push(`${rotulo}: ${campo} precisa ter ao menos um registro.`);
      } else {
        item[campo].forEach((fonte, i) => {
          if (!fonte || (typeof fonte.lei === 'undefined' && campo === 'fundamento')) {
            erros.push(`${rotulo}: ${campo}[${i}] sem lei.`);
          }
          if (!fonte || (typeof fonte.rotulo === 'undefined' && campo === 'fontes')) {
            erros.push(`${rotulo}: ${campo}[${i}] sem rótulo.`);
          }
          if (!fonte || typeof fonte.url !== 'string' || !URL_PATTERN.test(fonte.url)) {
            erros.push(`${rotulo}: ${campo}[${i}] precisa de URL HTTPS.`);
          }
        });
      }
    }
    if (!STATUS_ENUM.includes(item.status)) {
      erros.push(`${rotulo}: status "${item.status}" não pertence ao enum fechado.`);
    }
    if (
      item.nota_status !== undefined &&
      (typeof item.nota_status !== 'string' || item.nota_status.trim() === '')
    ) {
      erros.push(`${rotulo}: nota_status, quando presente, precisa ser texto não vazio.`);
    }
    if (
      item.aliases !== undefined &&
      (!Array.isArray(item.aliases) ||
        item.aliases.some(alias => typeof alias !== 'string' || !alias.trim()))
    ) {
      erros.push(`${rotulo}: "aliases" deve ser uma lista de textos não vazios.`);
    }
    const chavesExtras = Object.keys(item).filter(
      k => !REQUIRED_FIELDS.includes(k) && !OPTIONAL_FIELDS.includes(k),
    );
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
  const porId = new Map(dados.map(item => [item.id, item]));
  for (const item of dados) {
    for (const campo of ['substituido_por', 'substitui']) {
      for (const id of item[campo] || []) {
        if (!porId.has(id)) erros.push(`${item.id}: ${campo} aponta para id inexistente ${id}.`);
        const inverso = campo === 'substituido_por' ? 'substitui' : 'substituido_por';
        if (porId.has(id) && !(porId.get(id)[inverso] || []).includes(item.id)) {
          erros.push(`${item.id}: relação não recíproca com ${id}.`);
        }
      }
    }
  }
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
  <url>
    <loc>${SITE_URL}en/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
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

function paraManifest() {
  return `${JSON.stringify(
    {
      name: 'Guia de Tributos, Contribuições, Taxas e Encargos do Brasil',
      short_name: 'Guia de Tributos',
      lang: 'pt-BR',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f7f5ef',
      theme_color: '#006630',
      description: 'Catálogo estático de tributos, contribuições, taxas e encargos do Brasil.',
      icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    null,
    2,
  )}\n`;
}

function paraServiceWorker(version) {
  const precache = [
    './',
    'index.html',
    'manifest.webmanifest',
    'favicon.svg',
    'og-image.png',
    'api/tributos.json',
    'api/tributos.csv',
  ];
  return `const CACHE = 'guia-tributos-${version}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('guia-tributos-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./').then(cached => cached || caches.match('index.html')) : Response.error())));
});
`;
}

function paraCsv(dados) {
  const cols = [
    'id',
    'sigla',
    'nome',
    'tipo',
    'esfera',
    'contexto',
    'descricao',
    'status',
    'nota_status',
  ];
  const header = [
    'ID',
    'Sigla',
    'Nome',
    'Tipo/Natureza',
    'Esfera',
    'Contexto',
    'Descrição',
    'Status',
    'Nota do status',
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

  // A versão é o hash do conteúdo canônico do catálogo: muda automaticamente
  // quando qualquer item muda, sem depender de passo manual ou relógio.
  const version = `sha256-${createHash('sha256').update(JSON.stringify(dados)).digest('hex')}`;
  const apiJson = `${JSON.stringify(
    {
      version,
      gerado_em: DATA_REVISAO,
      total: dados.length,
      itens: dados,
    },
    null,
    2,
  )}\n`;
  // CSV é mantido como formato tabular: envelope não se aplica a ele. A versão
  // e a data-base ficam documentadas no contrato JSON e no README.
  const apiCsv = paraCsv(dados);
  const manifest = paraManifest();
  const serviceWorker = paraServiceWorker(version);

  const dadosEn = traduzirCatalogo(dados);
  const templateEn = traduzirHtml(template)
    .replace('const DATA = __TRIBUTOS_DATA__;\n', `const DATA = ${JSON.stringify(dadosEn)};\n`)
    .replace(
      marcadorJsonLd,
      `<script type="application/ld+json">${JSON.stringify(paraJsonLd(dadosEn))}</script>`,
    );
  const htmlEn = templateEn
    .replace(
      '<link rel="canonical" href="https://igorguariroba.github.io/guia-tributos-brasil/">',
      '<link rel="canonical" href="https://igorguariroba.github.io/guia-tributos-brasil/en/">',
    )
    .replaceAll('href="fonts/', 'href="../fonts/')
    .replaceAll('src:url(fonts/', 'src:url(../fonts/')
    .replaceAll('href="favicon.svg"', 'href="../favicon.svg"')
    .replaceAll('href="./', 'href="../')
    .replaceAll('href="manifest.webmanifest"', 'href="../manifest.webmanifest"')
    .replaceAll("register('sw.js')", "register('../sw.js')");
  const alvos = [
    ['public/index.html', htmlGerado],
    ['public/en/index.html', htmlEn],
    ['public/api/tributos.json', apiJson],
    ['public/api/tributos.csv', apiCsv],
    ['public/robots.txt', paraRobots()],
    ['public/sitemap.xml', paraSitemap()],
    ['public/manifest.webmanifest', manifest],
    ['public/sw.js', serviceWorker],
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
  await mkdir('public/en', { recursive: true });
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
