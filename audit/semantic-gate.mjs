#!/usr/bin/env node
/**
 * Gate de HTML semântico. Falha se o score cair abaixo de SEMANTIC_MIN (default 100).
 * Rubrica completa em audit/semantic-core.mjs.
 */
import { abrirNavegador, abrirPagina, salvarRelatorio } from './browser.mjs';
import { auditar } from './semantic-core.mjs';

const MIN = Number(process.env.SEMANTIC_MIN ?? 100);

const browser = await abrirNavegador();
const page = await abrirPagina(browser);
const relatorio = JSON.parse(await auditar(page));
await browser.close();

salvarRelatorio('semantic.json', relatorio);

console.log(`Semantic HTML Score: ${relatorio.score}/100 (nota ${relatorio.nota})`);
for (const [cat, v] of Object.entries(relatorio.porCategoria)) {
  const ok = v.pontos === v.peso ? '✓' : '✗';
  console.log(`  ${ok} ${cat.padEnd(14)} ${String(v.pontos).padStart(3)}/${v.peso}`);
}

const pendentes = relatorio.checks.filter(c => c.pontos < c.peso);
if (pendentes.length) {
  console.log('\nCritérios não atingidos:');
  for (const c of pendentes) console.log(`  [${c.pontos}/${c.peso}] ${c.criterio} :: ${c.detalhe}`);
}

if (relatorio.score < MIN) {
  console.error(`\n✗ GATE semântico REPROVADO: ${relatorio.score} < mínimo ${MIN}.`);
  process.exit(1);
}
console.log(`\n✓ GATE semântico APROVADO (${relatorio.score} >= ${MIN}).`);
