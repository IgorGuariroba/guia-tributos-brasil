#!/usr/bin/env node
/**
 * Gate funcional: garante que os gates de qualidade não aprovem uma página quebrada.
 * Cobre filtros, estado vazio, reset, ordenação por teclado, aria-sort, export CSV
 * e ausência de erros de console.
 */
import { chromium } from 'playwright';

const URL = process.env.AUDIT_URL || 'http://localhost:8080/';
const TOTAL_ESPERADO = 78;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errosConsole = [];
page.on('console', m => m.type() === 'error' && errosConsole.push(m.text()));
page.on('pageerror', e => errosConsole.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });

const testes = [];
const checar = async (nome, fn) => {
  try {
    await fn();
    testes.push({ nome, ok: true });
    console.log(`✓ ${nome}`);
  } catch (e) {
    testes.push({ nome, ok: false, erro: e.message });
    console.log(`✗ ${nome}\n    ${e.message}`);
  }
};
const igual = (obtido, esperado, ctx) => {
  if (obtido !== esperado) throw new Error(`${ctx}: esperado "${esperado}", obtido "${obtido}"`);
};

const linhas = () => page.locator('tbody tr').count();
const contador = () => page.locator('#count').textContent();

await checar(`carga inicial renderiza ${TOTAL_ESPERADO} linhas`, async () => {
  igual(await linhas(), TOTAL_ESPERADO, 'linhas');
  igual(await contador(), `${TOTAL_ESPERADO} de ${TOTAL_ESPERADO} itens exibidos`, 'contador');
});

await checar('busca textual filtra (ICMS => 1)', async () => {
  await page.fill('#search', 'ICMS');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
  igual(await linhas(), 1, 'linhas');
});

await checar('busca ignora acentos (tributaria => >0)', async () => {
  await page.fill('#search', 'tributaria');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0);
  if ((await linhas()) === 0) throw new Error('busca sem acento não encontrou nada');
});

await checar('estado vazio anuncia mensagem', async () => {
  await page.fill('#search', 'zzzzzz');
  await page.waitForFunction(() => document.getElementById('empty').textContent.length > 0);
  igual(await linhas(), 0, 'linhas');
  const role = await page.locator('#empty').getAttribute('role');
  igual(role, 'status', 'role do #empty');
});

await checar('reset do form restaura tudo', async () => {
  await page.click('#reset');
  await page.waitForFunction(
    t => document.querySelectorAll('tbody tr').length === t,
    TOTAL_ESPERADO
  );
  igual(await page.inputValue('#search'), '', 'campo de busca');
  igual(await contador(), `${TOTAL_ESPERADO} de ${TOTAL_ESPERADO} itens exibidos`, 'contador');
});

await checar('select filtra por tipo', async () => {
  try {
    await page.selectOption('#tipo', 'Imposto');
    await page.waitForFunction(t => document.querySelectorAll('tbody tr').length < t, TOTAL_ESPERADO);
    // textContent (não innerText) para ignorar o text-transform:uppercase do badge
    const tipos = await page
      .locator('tbody tr td:nth-child(3)')
      .evaluateAll(tds => tds.map(td => td.textContent.trim()));
    const vazados = [...new Set(tipos.filter(t => t !== 'Imposto'))];
    if (vazados.length) throw new Error(`filtro de tipo vazou: ${vazados.join(', ')}`);
  } finally {
    // sempre restaura o estado, para não contaminar os testes seguintes
    await page.click('#reset');
    await page.waitForFunction(t => document.querySelectorAll('tbody tr').length === t, TOTAL_ESPERADO);
  }
});

await checar('ordenação acionável por teclado (Enter) e aria-sort correto', async () => {
  await page.focus('th[data-key="nome"] .th-btn');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('th[data-key="nome"]').getAttribute('aria-sort') === 'ascending'
  );
  const primeiroAsc = await page.locator('tbody tr th').first().innerText();

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('th[data-key="nome"]').getAttribute('aria-sort') === 'descending'
  );
  const primeiroDesc = await page.locator('tbody tr th').first().innerText();

  if (primeiroAsc === primeiroDesc) throw new Error('ordem não inverteu ao pressionar Enter novamente');

  const sorts = await page.locator('th[data-key]').evaluateAll(ths =>
    ths.map(t => t.getAttribute('aria-sort'))
  );
  if (sorts.filter(s => s !== 'none').length !== 1)
    throw new Error(`apenas uma coluna deve estar ordenada, obtido: ${sorts.join(',')}`);
});

await checar('skip-link aponta para destino existente e focável', async () => {
  const href = await page.locator('a.skip-link').getAttribute('href');
  const alvo = page.locator(href);
  igual(await alvo.count(), 1, `destino ${href}`);
  igual(await alvo.getAttribute('tabindex'), '-1', 'tabindex do destino');
});

await checar('export CSV gera arquivo com cabeçalho e BOM', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#csv'),
  ]);
  igual(download.suggestedFilename(), 'tributos-brasil-filtrado.csv', 'nome do arquivo');
  const stream = await download.createReadStream();
  let conteudo = '';
  for await (const c of stream) conteudo += c;
  if (!conteudo.startsWith('\uFEFF')) throw new Error('CSV sem BOM UTF-8 (quebra no Excel)');
  const primeiraLinha = conteudo.replace('\uFEFF', '').split('\n')[0];
  igual(primeiraLinha.split(';').length, 7, 'colunas no cabeçalho do CSV');
  const totalLinhas = conteudo.trim().split('\n').length;
  igual(totalLinhas, TOTAL_ESPERADO + 1, 'linhas no CSV (cabeçalho + itens)');
});

await checar('todas as siglas têm nome completo via <abbr title>', async () => {
  const semTitulo = await page.locator('tbody th abbr:not([title])').count();
  igual(semTitulo, 0, 'abbr sem title');
  igual(await page.locator('tbody th abbr').count(), TOTAL_ESPERADO, 'total de abbr');
});

await checar('zero requisições a domínios externos', async () => {
  const externos = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map(r => r.name)
      .filter(u => !u.startsWith(location.origin))
  );
  if (externos.length) throw new Error(`recursos externos: ${externos.join(', ')}`);
});

await checar('console sem erros', async () => {
  igual(errosConsole.length, 0, `erros de console (${errosConsole.join(' | ')})`);
});

await browser.close();

const falhas = testes.filter(t => !t.ok);
console.log(`\n${testes.length - falhas.length}/${testes.length} testes funcionais aprovados`);
if (falhas.length) {
  console.error('\n✗ GATE funcional REPROVADO.');
  process.exit(1);
}
console.log('✓ GATE funcional APROVADO.');
