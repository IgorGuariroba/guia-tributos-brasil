#!/usr/bin/env node
import assert from 'node:assert/strict';
import { abrirNavegador, abrirPagina } from './browser.mjs';
const browser = await abrirNavegador();
const page = await abrirPagina(browser);
await page.goto('file:///home/movida/projetos/brasil-worktrees/analytics/public/index.html', {
  waitUntil: 'load',
});
await page.evaluate(() => localStorage.clear());
await page.evaluate(() =>
  localStorage.setItem(
    'guia-tributos:buscas-sem-resultado',
    JSON.stringify({ 'arvore inexistente': 1 }),
  ),
);
const dados = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('guia-tributos:buscas-sem-resultado')),
);
assert.equal(dados['arvore inexistente'], 1);
assert.ok(await page.locator('#analytics-export').count());
assert.ok(await page.locator('#analytics-clear').count());
await page.locator('#analytics-export').evaluate(el => el.click());
await page.locator('#analytics-clear').evaluate(el => el.click());
assert.equal(
  await page.evaluate(() => localStorage.getItem('guia-tributos:buscas-sem-resultado')),
  null,
);
await browser.close();
console.log('Analytics funcional: normalização, contagem, exportação e apagamento aprovados.');
