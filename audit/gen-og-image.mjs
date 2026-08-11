#!/usr/bin/env node
/**
 * Gera public/og-image.png (1200×630) — imagem estática usada por og:image e
 * twitter:image, no mesmo visual brutalista do site (fundo #ffe100, borda preta,
 * Archivo Black). Renderizada uma vez via Chromium (Playwright) e commitada como
 * artefato binário — não há custo de runtime nem requisição externa em produção.
 *
 * Uso: node audit/gen-og-image.mjs
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const LARGURA = 1200;
const ALTURA = 630;
const SAIDA = 'public/og-image.png';

async function main() {
  const fonteDisplay = (
    await readFile(resolve('public/fonts/ArchivoBlack-400-latin.woff2'))
  ).toString('base64');
  const fonteMono = (await readFile(resolve('public/fonts/IBMPlexMono-600-latin.woff2'))).toString(
    'base64',
  );

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
@font-face{font-family:'Archivo Black';src:url(data:font/woff2;base64,${fonteDisplay}) format('woff2');}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(data:font/woff2;base64,${fonteMono}) format('woff2');}
*{margin:0;box-sizing:border-box}
html,body{width:${LARGURA}px;height:${ALTURA}px}
body{
  background:#ffe100;font-family:'IBM Plex Mono',monospace;
  background-image:linear-gradient(#00000014 1px,transparent 1px),linear-gradient(90deg,#00000014 1px,transparent 1px);
  background-size:28px 28px;
  display:flex;flex-direction:column;justify-content:center;padding:64px 76px;
  border:14px solid #000;
}
.kicker{display:inline-block;background:#000;color:#ffe100;font-weight:600;font-size:22px;text-transform:uppercase;letter-spacing:.04em;padding:6px 14px;margin-bottom:26px;width:fit-content}
h1{font-family:'Archivo Black',sans-serif;font-size:64px;line-height:1.04;text-transform:uppercase;letter-spacing:-.01em;max-width:1000px}
.foot{display:flex;align-items:center;gap:18px;margin-top:38px}
.badge{background:#fff;border:4px solid #000;box-shadow:8px 8px 0 #000;padding:12px 20px;font-weight:600;font-size:24px}
.url{font-size:22px;font-weight:600}
</style></head>
<body>
  <span class="kicker">Guia de tributos do Brasil</span>
  <h1>Tributos, contribuições, taxas e encargos no Brasil</h1>
  <div class="foot">
    <span class="badge">78 siglas</span>
    <span class="url">igorguariroba.github.io/guia-tributos-brasil</span>
  </div>
</body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: LARGURA, height: ALTURA } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buffer = await page.screenshot({ type: 'png' });
  await browser.close();

  await writeFile(SAIDA, buffer);
  console.log(`✓ ${SAIDA} gerado (${LARGURA}×${ALTURA}, ${(buffer.length / 1024).toFixed(1)} KB).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
