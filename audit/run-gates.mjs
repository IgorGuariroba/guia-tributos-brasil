#!/usr/bin/env node
/**
 * Orquestrador dos gates de qualidade.
 * Sobe um servidor estático em public/, roda todos os gates e agrega o resultado.
 * Exit 1 se qualquer gate reprovar. Usado pelo pre-push e pelo CI.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Porta 0 = efêmera atribuída pelo SO: evita EADDRINUSE se algo já ocupa a 8080.
const PORT = Number(process.env.AUDIT_PORT || 0);
const RAIZ = 'public';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const servidor = createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    const alvo = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    const dados = await readFile(alvo);
    res.writeHead(200, {
      'content-type': MIME[extname(alvo)] || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000',
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
  }
});

servidor.on('error', e => {
  console.error(`✗ Falha ao subir o servidor de auditoria: ${e.message}`);
  process.exit(1);
});
await new Promise(r => servidor.listen(PORT, '127.0.0.1', r));
const portaReal = servidor.address().port;
const URL_BASE = `http://localhost:${portaReal}/`;
console.log(`servidor estático em ${URL_BASE} (raiz: ${RAIZ}/)\n`);

// Garante que o servidor não fique órfão se o processo for interrompido.
const encerrar = () => {
  servidor.close();
  process.exit(130);
};
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

const executar = (rotulo, cmd, args, env = {}) =>
  new Promise(resolve => {
    console.log(`\n${'═'.repeat(70)}\n▶ ${rotulo}\n${'═'.repeat(70)}`);
    const p = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, AUDIT_URL: URL_BASE, ...env },
      shell: process.platform === 'win32',
    });
    p.on('close', code => resolve({ rotulo, code: code ?? 1 }));
  });

const somente = process.argv[2];
const todos = [
  ['Gate 1/5 · Funcional (Playwright)', 'node', ['audit/functional-gate.mjs']],
  ['Gate 2/5 · Responsividade (8 larguras, 320→1920px)', 'node', ['audit/responsive-gate.mjs']],
  ['Gate 3/5 · Acessibilidade (axe-core, 0 violações)', 'node', ['audit/axe-gate.mjs']],
  ['Gate 4/5 · HTML semântico (score mínimo 100)', 'node', ['audit/semantic-gate.mjs']],
  ['Gate 5/5 · Lighthouse CI (thresholds)', 'npx', ['--no-install', 'lhci', 'autorun']],
];
const selecionados = somente
  ? todos.filter(g => g[0].toLowerCase().includes(somente.toLowerCase()))
  : todos;

const resultados = [];
for (const [rotulo, cmd, args] of selecionados) {
  resultados.push(await executar(rotulo, cmd, args));
}

servidor.close();

console.log(`\n${'═'.repeat(70)}\nRESUMO DOS GATES\n${'═'.repeat(70)}`);
for (const r of resultados) {
  console.log(`${r.code === 0 ? '✓ APROVADO' : '✗ REPROVADO'}  ${r.rotulo}`);
}

const reprovados = resultados.filter(r => r.code !== 0);
if (reprovados.length) {
  console.error(`\n✗ ${reprovados.length} de ${resultados.length} gate(s) reprovado(s). Push bloqueado.`);
  process.exit(1);
}
console.log(`\n✓ Todos os ${resultados.length} gates aprovados.`);
