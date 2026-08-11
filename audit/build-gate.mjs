#!/usr/bin/env node
/**
 * Gate 8 · Build & Schema.
 *
 * data/tributos.json é a fonte da verdade do catálogo (ver docs/plano-de-melhoria.md,
 * fase 1). Este gate garante duas coisas, nesta ordem:
 *
 *   1. O dado é válido (audit/build.mjs valida contra o contrato de data/schema.json:
 *      campos obrigatórios, id único e no formato slug).
 *   2. public/index.html e public/api/* estão sincronizados com data/tributos.json e
 *      src/index.template.html — ninguém editou o artefato gerado à mão nem esqueceu
 *      de rodar o build depois de mudar o dado ou o template.
 *
 * Não abre navegador: roda em menos de 1s, por isso entra no pre-commit junto do
 * gate de estilo, além do pre-push e do CI.
 *
 * Corrija divergências com: node audit/build.mjs
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('node', ['audit/build.mjs', '--check'], { stdio: 'inherit' });

if (r.status !== 0) {
  console.error('\n✗ GATE de build REPROVADO.');
  console.error('  Rode "node audit/build.mjs" e commite public/index.html e public/api/*.');
  process.exit(1);
}

console.log('\n✓ GATE de build APROVADO (data/tributos.json válido e public/ sincronizado).');
