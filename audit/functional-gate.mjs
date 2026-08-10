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

await checar('combobox pesquisável permite múltiplos tipos', async () => {
  try {
    await page.click('#tipo');
    await page.fill('#tipo-search', 'imposto');
    await page.getByRole('option', { name: 'Imposto', exact: true }).click();
    await page.fill('#tipo-search', 'taxa');
    await page.getByRole('option', { name: 'Taxa', exact: true }).click();
    await page.waitForFunction(t => document.querySelectorAll('tbody tr').length < t, TOTAL_ESPERADO);
    const tipos = await page.locator('tbody tr td:nth-child(3)').evaluateAll(tds =>
      tds.map(td => td.textContent.trim())
    );
    const vazados = [...new Set(tipos.filter(t => !['Imposto', 'Taxa'].includes(t)))];
    if (vazados.length) throw new Error(`filtro multisseleção vazou: ${vazados.join(', ')}`);
    if (!tipos.includes('Imposto') || !tipos.includes('Taxa'))
      throw new Error('combinação não retornou as duas categorias selecionadas');
    igual(await page.locator('#tipo').getAttribute('aria-expanded'), 'true', 'combobox permanece aberto');
  } finally {
    await page.keyboard.press('Escape');
    await page.click('#reset');
    await page.waitForFunction(t => document.querySelectorAll('tbody tr').length === t, TOTAL_ESPERADO);
  }
});

await checar('contexto usa categorias atômicas e chips removíveis', async () => {
  try {
    await page.click('#contexto');
    await page.fill('#contexto-search', 'empresa');
    await page.getByRole('option', { name: 'Empresa', exact: true }).click();
    await page.waitForFunction(t => document.querySelectorAll('tbody tr').length < t, TOTAL_ESPERADO);
    const contextos = await page.locator('tbody tr td:nth-child(5)').allTextContents();
    if (!contextos.every(c => c.split(/\s*\/\s*/).includes('Empresa')))
      throw new Error('filtro Empresa retornou contexto sem a categoria atômica');
    if (!contextos.some(c => c !== 'Empresa'))
      throw new Error('filtro Empresa não incluiu contextos compostos');
    const chip = page.getByRole('button', { name: 'Remover filtro Contexto: Empresa' });
    igual(await chip.count(), 1, 'chip do filtro');
    await page.keyboard.press('Escape');
    await chip.click();
    await page.waitForFunction(t => document.querySelectorAll('tbody tr').length === t, TOTAL_ESPERADO);
  } finally {
    await page.click('#reset');
  }
});

await checar('busca e rótulos dos filtros aparecem na primeira tela', async () => {
  const ux = await page.evaluate(() => ({
    searchBottom: document.getElementById('search').getBoundingClientRect().bottom,
    viewport: innerHeight,
    labels: [...document.querySelectorAll('.field-label')].every(label => {
      const style = getComputedStyle(label);
      return style.display !== 'none' && label.getBoundingClientRect().height > 0;
    }),
  }));
  if (ux.searchBottom > ux.viewport) throw new Error(`busca abaixo da primeira tela: ${ux.searchBottom}px`);
  if (!ux.labels) throw new Error('há rótulo de filtro invisível');
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
  // data: URIs não são requisições de rede; o que importa é não haver origem externa.
  const externos = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map(r => r.name)
      .filter(u => /^https?:\/\//.test(u) && !u.startsWith(location.origin))
  );
  if (externos.length) throw new Error(`recursos externos: ${externos.join(', ')}`);
});

await checar('ícones renderizam em todos os elementos [data-icone]', async () => {
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-icone]')];
    const semMascara = els.filter(e => {
      const m = getComputedStyle(e, '::before').maskImage;
      return !m || m === 'none';
    });
    const tdSemChave = document.querySelectorAll('td[data-icone=""]').length;
    const indicadores = [...document.querySelectorAll('.sort-ind')].filter(
      e => getComputedStyle(e).maskImage !== 'none'
    ).length;
    return {
      total: els.length,
      semMascara: semMascara.map(e => e.tagName + '[' + e.dataset.icone + ']').slice(0, 5),
      tdSemChave,
      indicadores,
      totalTh: document.querySelectorAll('th[data-key]').length,
    };
  });
  if (r.total === 0) throw new Error('nenhum elemento com [data-icone] encontrado');
  if (r.semMascara.length)
    throw new Error(`ícones sem mask-image (data-URI inválido?): ${r.semMascara.join(', ')}`);
  igual(r.tdSemChave, 0, 'células com data-icone vazio (mapeamento incompleto)');
  igual(r.indicadores, r.totalTh, 'indicadores de ordenação com ícone');
});

await checar('ícones desenham pixels de verdade (data-URI válido)', async () => {
  // Um data-URI corrompido (ex.: '#' com duplo-encode) ainda reporta maskImage != none,
  // mas não pinta nada. A única verificação honesta é comparar pixels renderizados.
  const amostras = [
    { sel: '.card h2[data-icone]', nome: 'card' },
    { sel: 'td[data-icone="federal"]', nome: 'esfera na tabela' },
    { sel: '.actions button[data-icone="csv"]', nome: 'botão CSV' },
  ];
  for (const { sel, nome } of amostras) {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0) throw new Error(`amostra ausente: ${sel}`);
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) throw new Error(`sem bounding box: ${sel}`);
    // recorta apenas a faixa à esquerda, onde o ::before é desenhado
    const recorte = await page.screenshot({
      clip: { x: box.x, y: box.y, width: 20, height: Math.min(box.height, 24) },
    });
    const cores = await page.evaluate(async b64 => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return set.size;
    }, recorte.toString('base64'));
    // fundo uniforme => 1 ou 2 cores. Um ícone desenhado gera bem mais (antialiasing).
    if (cores < 3)
      throw new Error(`ícone não desenhou pixels em ${nome} (${sel}): apenas ${cores} cor(es) no recorte`);
  }
});

await checar('ícones são decorativos (invisíveis para leitores de tela)', async () => {
  // Pseudo-elementos não entram na árvore de acessibilidade. Garantimos que ninguém
  // trocou por <img>/<svg> sem texto alternativo, o que criaria ruído ou perda de info.
  const r = await page.evaluate(() => ({
    imgs: document.querySelectorAll('img').length,
    svgSemTitulo: [...document.querySelectorAll('svg')].filter(
      s => !s.getAttribute('aria-label') && !s.querySelector('title') && s.getAttribute('aria-hidden') !== 'true'
    ).length,
  }));
  igual(r.imgs, 0, '<img> na página (ícones devem ser CSS)');
  igual(r.svgSemTitulo, 0, '<svg> sem rótulo nem aria-hidden');
});

await checar('texto permanece legível sem os ícones (não há dependência visual)', async () => {
  // Se um ícone fosse a única fonte de informação, remover as máscaras perderia dados.
  const r = await page.evaluate(() => {
    const linha = document.querySelector('tbody tr');
    const celulas = [...linha.querySelectorAll('th,td')].map(c => c.textContent.trim());
    return { celulas, vazias: celulas.filter(t => t.length === 0).length };
  });
  igual(r.vazias, 0, `células sem texto próprio (${JSON.stringify(r.celulas)})`);
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
