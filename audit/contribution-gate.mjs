#!/usr/bin/env node
/** Gate de contribuição: falha com o campo e o item que precisam de correção. */
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data/tributos.json', 'utf8'));
const required = ['id', 'sigla', 'nome', 'tipo', 'esfera', 'contexto', 'descricao', 'status'];
const statuses = new Set([
  'Vigente',
  'Em transição',
  'Em implantação',
  'Varia por ente',
  'Não instituído',
  'Histórico',
]);
const ids = new Set();
const errors = [];

if (!Array.isArray(data)) errors.push('data/tributos.json precisa ser um array de itens.');
for (const [index, item] of data.entries?.() ?? []) {
  const label = `item ${index + 1}${item?.id ? ` (${item.id})` : ''}`;
  for (const field of required) {
    if (typeof item?.[field] !== 'string' || !item[field].trim()) {
      errors.push(`${label}: campo obrigatório «${field}» ausente ou vazio.`);
    }
  }
  if (item?.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) {
    errors.push(`${label}: «id» deve ser slug minúsculo (^[a-z0-9]+(-[a-z0-9]+)*$).`);
  }
  if (item?.id && ids.has(item.id)) {
    errors.push(`${label}: «id» duplicado; escolha um identificador estável e único.`);
  }
  if (item?.id) ids.add(item.id);
  if (item?.status && !statuses.has(item.status)) {
    errors.push(`${label}: «status» inválido «${item.status}»; use um valor do schema.`);
  }
  for (const field of ['nota_status']) {
    if (item?.[field] !== undefined && (typeof item[field] !== 'string' || !item[field].trim())) {
      errors.push(`${label}: «${field}» deve ser texto não vazio.`);
    }
  }
  if (
    item?.aliases !== undefined &&
    (!Array.isArray(item.aliases) ||
      item.aliases.some(alias => typeof alias !== 'string' || !alias.trim()))
  ) {
    errors.push(`${label}: «aliases» deve ser uma lista de textos não vazios.`);
  }
}

if (errors.length) {
  console.error(`✗ CONTRIBUIÇÃO REPROVADA: ${errors.length} problema(s) no catálogo.`);
  console.error(errors.map(error => `  - ${error}`).join('\n'));
  console.error('\nConsulte CONTRIBUTING.md e data/schema.json; depois rode npm run build.');
  process.exit(1);
}
console.log(
  `✓ CONTRIBUIÇÃO APROVADA: ${data.length} itens, ${ids.size} ids únicos e campos compatíveis com o schema.`,
);
