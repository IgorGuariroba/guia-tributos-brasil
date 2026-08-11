#!/usr/bin/env node
/**
 * Gate de duplicação de código (reutilização).
 *
 * Mede clones copiar-e-colar com jscpd sobre public/ e audit/ e reprova se:
 *   1. o percentual de linhas duplicadas ultrapassar DUP_MAX_PERCENT (default 0.4%); ou
 *   2. existir qualquer clone com >= DUP_MAX_CLONE_LINES linhas (default 12).
 *
 * O critério (1) trava a regressão global; o (2) impede que um único bloco grande
 * copiado passe despercebido só porque o arquivo é grande. Em base pequena (~2,5k
 * linhas) o percentual é ruidoso — um clone de 6 linhas já vale ~0,24% — então o
 * limite POR CLONE é o sinal confiável; o percentual é só a rede de segurança.
 *
 * Sensibilidade 4 linhas / 30 tokens. Baseline: 0.16%, maior clone = 5 linhas
 * (o par asc/desc do teste de ordenação — simetria legítima, não extraída de
 * propósito para não piorar a legibilidade do teste).
 *
 * O jscpd é invocado por subprocesso (e não pela API) porque a build ESM 4.2.x
 * quebra ao importar 'colors/safe' em Node >= 22.
 *
 * Relatório completo em audit/reports/jscpd/jscpd-report.json (artefato do CI).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

const MAX_PERCENT = Number(process.env.DUP_MAX_PERCENT ?? 0.4);
const MAX_CLONE_LINES = Number(process.env.DUP_MAX_CLONE_LINES ?? 12);
const MIN_LINES = Number(process.env.DUP_MIN_LINES ?? 4);
const MIN_TOKENS = Number(process.env.DUP_MIN_TOKENS ?? 30);

const SAIDA = 'audit/reports/jscpd';
const RELATORIO = `${SAIDA}/jscpd-report.json`;

rmSync(RELATORIO, { force: true });
mkdirSync(SAIDA, { recursive: true });

// --max-size acima do default (100kb): public/index.html tem ~105kb e seria
// silenciosamente ignorado, produzindo um falso "0 clones".
const args = [
  '--no-install',
  'jscpd',
  'public',
  'audit',
  '--min-lines',
  String(MIN_LINES),
  '--min-tokens',
  String(MIN_TOKENS),
  '--max-size',
  '5mb',
  '--ignore',
  'audit/reports/**',
  '--reporters',
  'json',
  '--output',
  SAIDA,
  '--silent',
];

const code = await new Promise(resolve => {
  const p = spawn('npx', args, {
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });
  p.on('close', c => resolve(c ?? 1));
});

let relatorio;
try {
  relatorio = JSON.parse(readFileSync(RELATORIO, 'utf8'));
} catch {
  console.error(`✗ jscpd não gerou ${RELATORIO} (exit ${code}). Rode: npm ci`);
  process.exit(1);
}

const t = relatorio.statistics.total;
const clones = relatorio.duplicates ?? [];

console.log('Duplicação de código (jscpd)');
console.log(`  arquivos analisados : ${t.sources}`);
console.log(`  linhas analisadas   : ${t.lines}`);
console.log(`  clones encontrados  : ${t.clones}`);
console.log(`  linhas duplicadas   : ${t.duplicatedLines} (${t.percentage}%)`);
console.log(`  tokens duplicados   : ${t.duplicatedTokens} (${t.percentageTokens}%)`);
console.log(`  reutilização efetiva: ${(100 - t.percentage).toFixed(2)}% do código sem clones`);

for (const [formato, v] of Object.entries(relatorio.statistics.formats ?? {})) {
  const s = v.total;
  console.log(
    `  · ${formato.padEnd(11)} ${String(s.duplicatedLines).padStart(4)}/${String(s.lines).padEnd(5)} linhas (${s.percentage}%)`,
  );
}

const linhasDoClone = c =>
  Math.max(c.firstFile.end - c.firstFile.start, c.secondFile.end - c.secondFile.start) + 1;
const ordenados = [...clones].sort((a, b) => linhasDoClone(b) - linhasDoClone(a));

if (ordenados.length) {
  console.log('\nClones detectados (maiores primeiro):');
  for (const c of ordenados.slice(0, 20)) {
    const a = c.firstFile;
    const b = c.secondFile;
    console.log(
      `  [${String(linhasDoClone(c)).padStart(3)} linhas] ${a.name}:${a.start}-${a.end}  ⇄  ${b.name}:${b.start}-${b.end}`,
    );
  }
  if (ordenados.length > 20) {
    console.log(`  … e mais ${ordenados.length - 20} clone(s). Veja ${RELATORIO}.`);
  }
}

const falhas = [];
if (t.percentage > MAX_PERCENT) {
  falhas.push(`duplicação global ${t.percentage}% > máximo ${MAX_PERCENT}%`);
}
const grandes = ordenados.filter(c => linhasDoClone(c) >= MAX_CLONE_LINES);
if (grandes.length) {
  falhas.push(`${grandes.length} clone(s) com >= ${MAX_CLONE_LINES} linhas`);
}

if (falhas.length) {
  console.error('\n✗ GATE de duplicação REPROVADO:');
  for (const f of falhas) console.error(`  · ${f}`);
  console.error('\nExtraia o trecho repetido para uma função/constante/template reutilizável.');
  console.error(`Detalhes: ${RELATORIO}`);
  process.exit(1);
}

console.log(
  `\n✓ GATE de duplicação APROVADO (${t.percentage}% <= ${MAX_PERCENT}%, maior clone < ${MAX_CLONE_LINES} linhas).`,
);
