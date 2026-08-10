#!/usr/bin/env node
/**
 * Gate de acessibilidade com axe-core.
 * Falha (exit 1) se houver QUALQUER violação em WCAG 2.0/2.1/2.2 A+AA + best-practice.
 * Audita a página em 3 estados, porque a tabela é renderizada por JS:
 *   1. carga inicial (78 itens)
 *   2. filtrada (1 item)
 *   3. estado vazio (0 itens, live region ativa)
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const axeSource = require('node:fs').readFileSync(axePath, 'utf8');

const URL = process.env.AUDIT_URL || 'http://localhost:8080/';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const estados = [
  { nome: 'carga-inicial', setup: async () => {} },
  {
    nome: 'filtrado',
    setup: async page => {
      await page.fill('#search', 'ICMS');
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    },
  },
  {
    nome: 'estado-vazio',
    setup: async page => {
      await page.fill('#search', 'zzzzzz');
      await page.waitForFunction(() => document.getElementById('empty').textContent.length > 0);
    },
  },
];

const browser = await chromium.launch();
const relatorio = [];
let totalViolacoes = 0;

for (const estado of estados) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await estado.setup(page);
  await page.addScriptTag({ content: axeSource });

  const resultado = await page.evaluate(
    async tags => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS
  );

  const violacoes = resultado.violations;
  totalViolacoes += violacoes.length;
  relatorio.push({
    estado: estado.nome,
    violacoes: violacoes.length,
    aprovadas: resultado.passes.length,
    incompletas: resultado.incomplete.length,
    detalhes: violacoes.map(v => ({
      id: v.id,
      impacto: v.impact,
      descricao: v.description,
      ajuda: v.helpUrl,
      nos: v.nodes.map(n => n.target.join(' ')),
    })),
  });

  const icone = violacoes.length ? '✗' : '✓';
  console.log(
    `${icone} [${estado.nome}] violações=${violacoes.length} ` +
      `regras-ok=${resultado.passes.length} incompletas=${resultado.incomplete.length}`
  );
  for (const v of violacoes) {
    console.log(`    → ${v.id} (${v.impact}): ${v.help}`);
    for (const n of v.nodes) console.log(`        ${n.target.join(' ')}`);
  }
  await page.close();
}

await browser.close();
mkdirSync('audit/reports', { recursive: true });
writeFileSync('audit/reports/axe.json', JSON.stringify(relatorio, null, 2));

console.log(
  `\naxe-core ${require('axe-core').version} | tags: ${TAGS.join(', ')}\n` +
    `TOTAL DE VIOLAÇÕES: ${totalViolacoes}`
);

if (totalViolacoes > 0) {
  console.error('\n✗ GATE axe-core REPROVADO: exigido 0 violações.');
  process.exit(1);
}
console.log('✓ GATE axe-core APROVADO (0 violações em 3 estados).');
