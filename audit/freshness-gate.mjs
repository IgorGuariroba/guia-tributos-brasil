#!/usr/bin/env node
/** Gate de frescor: nenhum registro pode ficar mais de 180 dias sem revisão. */
import { readFile } from 'node:fs/promises';

const LIMITE_DIAS = 180;
const data = JSON.parse(await readFile('data/tributos.json', 'utf8'));
const referencia = process.env.FRESHNESS_AS_OF ? new Date(process.env.FRESHNESS_AS_OF) : new Date();
if (Number.isNaN(referencia.getTime())) {
  console.error('✗ FRESHNESS_AS_OF não é uma data ISO válida.');
  process.exit(1);
}
const limite = LIMITE_DIAS * 24 * 60 * 60 * 1000;
const antigos = data.filter(item => {
  const revisao = new Date(item.atualizado_em);
  return Number.isNaN(revisao.getTime()) || referencia - revisao > limite;
});
if (antigos.length) {
  console.error(
    `✗ GATE de frescor reprovado: ${antigos.length} item(ns) acima de ${LIMITE_DIAS} dias (referência ${referencia.toISOString().slice(0, 10)}).`,
  );
  antigos.forEach(item => console.error(`  - ${item.id}: ${item.atualizado_em}`));
  process.exit(1);
}
console.log(
  `✓ GATE de frescor aprovado: ${data.length} itens revisados nos últimos ${LIMITE_DIAS} dias.`,
);
