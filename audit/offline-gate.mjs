#!/usr/bin/env node
/** Gate PWA: a segunda navegação deve funcionar sem rede após a primeira visita. */
import { chromium } from 'playwright';
import { entrarNoGuia, TOTAL_ITENS, URL_AUDITADA } from './browser.mjs';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(URL_AUDITADA, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready,
);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => navigator.serviceWorker.controller);
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
if ((await page.title()) !== 'Guia de Tributos, Contribuições, Taxas e Encargos do Brasil') {
  throw new Error('shell não abriu offline');
}
await page.getByRole('button', { name: /Explorar tudo/ }).click();
await entrarNoGuia(page);
if ((await page.locator('tbody tr').count()) !== TOTAL_ITENS) {
  throw new Error('catálogo incompleto offline');
}
console.log('✓ PWA offline: catálogo completo após primeira visita.');
await browser.close();
