#!/usr/bin/env node
/** Gate da tarefa 4.4: campos operacionais presentes e referências internas válidas. */
import { readFile } from 'node:fs/promises';

const itens = JSON.parse(await readFile('data/tributos.json', 'utf8'));
const campos = ['sujeito_passivo', 'periodicidade', 'guia'];
const limite = Math.ceil(itens.length * 0.9);
const erros = [];
for (const campo of campos) {
  const preenchidos = itens.filter(item => Object.hasOwn(item, campo)).length;
  if (preenchidos < limite) {
    erros.push(`${campo}: ${preenchidos}/${itens.length} (mínimo ${limite})`);
  }
}
const ids = new Set(itens.map(item => item.id));
for (const item of itens) {
  if (
    item.guia !== null &&
    (!item.guia || typeof item.guia !== 'object' || !ids.has(item.guia.id))
  ) {
    erros.push(`${item.id}: guia deve apontar para um id existente ou ser null.`);
  }
}
if (erros.length) {
  console.error(`✗ Gate de cobertura 4.4 reprovado:\n  - ${erros.join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `✓ Gate 4.4 aprovado: ${itens.length} itens, cobertura mínima de ${limite} itens por campo.`,
);
