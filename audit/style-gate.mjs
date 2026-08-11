#!/usr/bin/env node
/**
 * Gate de estilo e consistência de código.
 *
 * Três camadas, da mais barata para a mais cara:
 *
 *   1. Higiene de arquivo (nativo, sem dependências): indentação com espaço,
 *      múltiplo de 2, sem tabulação, sem espaço no fim da linha, LF (nunca CRLF),
 *      nova linha final, sem linhas em branco no fim, sem BOM. Cobre TODOS os
 *      arquivos versionados de texto — inclusive public/index.html, que o
 *      Prettier ignora por ser o artefato estático entregue ao usuário.
 *   2. Prettier --check: formatação canônica dos .mjs/.js/.json/.yml/.md.
 *   3. ESLint: imports, `const`/`let`, comparações, variáveis não usadas e
 *      demais regras de padrão (ver eslint.config.mjs).
 *
 * Correção automática das camadas 2 e 3:  npm run format && npm run lint:fix
 *
 * Não abre navegador nem depende do servidor de auditoria: roda em ~2s e por
 * isso é o único gate pesado o bastante para valer no pre-commit.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const INDENT = 2;

// Binários e arquivos gerados: higiene textual não se aplica.
const EXT_BINARIA = new Set([
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
]);

// LICENSE é texto de terceiros; package-lock.json é gerado pelo npm.
// public/api/tributos.csv é gerado por audit/build.mjs com BOM UTF-8 proposital
// (compatibilidade com Excel no Brasil) — sua consistência é validada pelo gate de build,
// não por este.
const IGNORADOS = new Set(['LICENSE', 'package-lock.json', 'public/api/tributos.csv']);

// Arquivos com indentação legítima fora do passo de 2 (ex.: listas markdown numeradas).
const SEM_CHECAGEM_DE_INDENTACAO = new Set([
  'README.md',
  'docs/analise-concorrencia.md',
  'docs/plano-de-melhoria.md',
]);

const erros = [];
const registrar = (arquivo, linha, msg) =>
  erros.push(`${arquivo}${linha ? `:${linha}` : ''} — ${msg}`);

// ─────────────────────────────────────────────────────────── 1. higiene de arquivo

const versionados = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(f => !IGNORADOS.has(f) && !EXT_BINARIA.has(extname(f).toLowerCase()));

let analisados = 0;

for (const arquivo of versionados) {
  let bruto;
  try {
    bruto = readFileSync(arquivo);
  } catch {
    continue; // arquivo removido no working tree
  }
  if (bruto.includes(0)) continue; // binário não declarado na lista de extensões

  const conteudo = bruto.toString('utf8');
  if (!conteudo.length) continue;
  analisados++;

  if (conteudo.charCodeAt(0) === 0xfeff) registrar(arquivo, 1, 'BOM UTF-8 no início do arquivo');
  if (conteudo.includes('\r\n')) registrar(arquivo, null, 'quebras de linha CRLF (use LF)');
  if (!conteudo.endsWith('\n')) registrar(arquivo, null, 'falta nova linha no fim do arquivo');
  if (/\n\s*\n$/.test(conteudo)) registrar(arquivo, null, 'linhas em branco no fim do arquivo');

  const checarIndentacao = !SEM_CHECAGEM_DE_INDENTACAO.has(arquivo);
  const linhas = conteudo.split('\n');

  // Continuação de comentário de bloco alinha o texto ao `/*` e por isso pode
  // cair em coluna ímpar legitimamente. Rastreamos o estado para não punir isso.
  let dentroDeComentario = false;

  linhas.forEach((linha, i) => {
    const n = i + 1;
    if (/[ \t]+$/.test(linha)) registrar(arquivo, n, 'espaço em branco no fim da linha');

    const eraComentario = dentroDeComentario;
    const abre = linha.lastIndexOf('/*');
    const fecha = linha.lastIndexOf('*/');
    if (abre > fecha) dentroDeComentario = true;
    else if (fecha > abre) dentroDeComentario = false;

    const recuo = linha.match(/^[ \t]*/)[0];
    if (recuo.includes('\t')) {
      registrar(arquivo, n, 'indentação com tabulação (use espaços)');
    } else if (
      checarIndentacao &&
      linha.trim() &&
      recuo.length % INDENT !== 0 &&
      !eraComentario &&
      !/^\s*\*/.test(linha)
    ) {
      registrar(arquivo, n, `indentação de ${recuo.length} espaços (use múltiplos de ${INDENT})`);
    }
  });
}

console.log('Higiene de arquivo');
console.log(`  arquivos versionados analisados : ${analisados}`);
console.log(`  problemas encontrados           : ${erros.length}`);
for (const e of erros.slice(0, 40)) console.log(`  · ${e}`);
if (erros.length > 40) console.log(`  … e mais ${erros.length - 40} problema(s).`);

// ────────────────────────────────────────────────────────── 2 e 3. prettier/eslint

const rodar = (rotulo, args) => {
  const r = spawnSync('npx', ['--no-install', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const ok = r.status === 0;
  console.log(`${ok ? '✓' : '✗'} ${rotulo}`);
  return ok;
};

console.log('\nFormatação (Prettier)');
const prettierOk = rodar('prettier --check', ['prettier', '--check', '--log-level', 'warn', '.']);

console.log('\nPadrão de código (ESLint)');
const eslintOk = rodar('eslint', ['eslint', '.', '--max-warnings', '0']);

// ───────────────────────────────────────────────────────────────────── veredicto

const falhas = [];
if (erros.length) falhas.push(`${erros.length} problema(s) de higiene de arquivo`);
if (!prettierOk) falhas.push('formatação fora do padrão do Prettier');
if (!eslintOk) falhas.push('violações de ESLint');

if (falhas.length) {
  console.error('\n✗ GATE de estilo REPROVADO:');
  for (const f of falhas) console.error(`  · ${f}`);
  console.error('\nCorrija com: npm run format && npm run lint:fix');
  console.error('(higiene de arquivo pode exigir ajuste manual — veja a lista acima)');
  process.exit(1);
}

console.log('\n✓ GATE de estilo APROVADO (higiene, Prettier e ESLint sem pendências).');
