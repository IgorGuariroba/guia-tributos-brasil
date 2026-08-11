#!/usr/bin/env node
/** Gate estático da versão en-US: paridade de IDs e metadados de idioma. */
import { readFile } from 'node:fs/promises';
const br = JSON.parse(await readFile('data/tributos.json', 'utf8'));
const en = await readFile('public/en/index.html', 'utf8');
const erros = [];
if (!/<html lang="en-US">/.test(en)) erros.push('en/ precisa declarar lang="en-US".');
for (const rel of ['pt-BR', 'en', 'x-default']) {
  if (!en.includes(`hreflang="${rel}"`)) erros.push(`en/ sem hreflang ${rel}.`);
}
for (const item of br) {
  if (!en.includes(`"id":"${item.id}"`)) erros.push(`ID ausente na versão en-US: ${item.id}.`);
}
if (!en.includes('Tax reform') || !en.includes('Searchable guide')) {
  erros.push('conteúdo de interface en-US não encontrado.');
}
if (erros.length) {
  console.error(erros.map(x => `✗ ${x}`).join('\n'));
  process.exit(1);
}
console.log(`✓ i18n: en-US presente, metadados válidos e ${br.length} IDs preservados.`);
