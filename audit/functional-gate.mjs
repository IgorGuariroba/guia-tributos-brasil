#!/usr/bin/env node
/**
 * Gate funcional: garante que os gates de qualidade não aprovem uma página quebrada.
 * Cobre filtros, estado vazio, reset, ordenação por teclado, aria-sort, export CSV
 * e ausência de erros de console.
 */
import {
  abrirNavegador,
  abrirPagina,
  entrarNoGuia,
  TOTAL_ITENS,
  URL_AUDITADA,
} from './browser.mjs';

const TOTAL_ESPERADO = TOTAL_ITENS;
const EN = new URL(URL_AUDITADA).pathname.startsWith('/en/');
const TEXTO = {
  itens: EN ? 'items' : 'itens',
  tipo: EN ? 'Type / nature' : 'Tipo / natureza',
  imposto: EN ? 'Tax' : 'Imposto',
  taxa: EN ? 'Fee' : 'Taxa',
  empresa: 'Empresa',
  contexto: EN ? 'Context' : 'Contexto',
  remove: EN ? 'Remove filter' : 'Remover filtro',
  contador: n => `${n} de ${TOTAL_ESPERADO} ${EN ? 'items' : 'itens'} exibidos`,
};

const errosConsole = [];
const browser = await abrirNavegador();
// Os listeners entram por antesDeAbrir: registrados depois do goto, perderiam
// os erros disparados durante a carga inicial.
const page = await abrirPagina(browser, {
  antesDeAbrir: p => {
    p.on('console', m => m.type() === 'error' && errosConsole.push(m.text()));
    p.on('pageerror', e => errosConsole.push(String(e)));
  },
});

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

const linhas = () => page.locator('#tbody tr').count();

// Esperas de convergência da tabela, usadas por vários testes. Centralizadas
// porque a condição (comparar contra o total) é a mesma em todos eles.
const aguardarTodasAsLinhas = () =>
  page.waitForFunction(t => document.querySelectorAll('#tbody tr').length === t, TOTAL_ESPERADO);
const aguardarLinhasFiltradas = () =>
  page.waitForFunction(t => document.querySelectorAll('#tbody tr').length < t, TOTAL_ESPERADO);
const contador = () => page.locator('#count').textContent();

await checar('perfil de interesse personaliza a entrada do guia', async () => {
  await page.getByRole('button', { name: /Pessoa física/ }).click();
  igual(await page.locator('.profile-number').textContent(), '15', 'prévia do perfil');
  await entrarNoGuia(page);
  igual(await page.getByRole('dialog').count(), 0, 'diálogo encerrado');
});

await checar('associações visuais mudam conforme o perfil', async () => {
  const escolherPerfil = async perfil => {
    await page.locator('[data-change-profile]').click();
    await page.locator(`[data-profile="${perfil}"]`).click();
    await page.locator('.profile-confirm').click();
    return page.locator('.association-tax strong').allTextContents();
  };
  const pessoa = await escolherPerfil('pessoa');
  igual(pessoa.join(','), 'IPVA,IPTU,IRPF,ITCMD', 'associações de pessoa física');
  const reforma = await escolherPerfil('reforma');
  await escolherPerfil('all');
  igual(reforma.join(','), 'CBS,IBS,IS,ICMS / ISS', 'associações da reforma tributária');
});

await checar(`carga inicial renderiza ${TOTAL_ESPERADO} linhas`, async () => {
  igual(await linhas(), TOTAL_ESPERADO, 'linhas');
  igual(await contador(), TEXTO.contador(TOTAL_ESPERADO), 'contador');
});

await checar('busca textual filtra (ICMS => 1)', async () => {
  await page.fill('#search', 'ICMS');
  await page.waitForFunction(() => document.querySelectorAll('#tbody tr').length === 1);
  igual(await linhas(), 1, 'linhas');
});

await checar('busca ignora acentos (tributaria => >0)', async () => {
  await page.fill('#search', 'tributaria');
  await page.waitForFunction(() => document.querySelectorAll('#tbody tr').length > 0);
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
  await aguardarTodasAsLinhas();
  igual(await page.inputValue('#search'), '', 'campo de busca');
  igual(await contador(), TEXTO.contador(TOTAL_ESPERADO), 'contador');
});

await checar('combobox pesquisável permite múltiplos tipos', async () => {
  try {
    await page.click('#tipo');
    await page.fill('#tipo-search', EN ? 'tax' : 'imposto');
    await page.getByRole('option', { name: TEXTO.imposto, exact: true }).click();
    await page.fill('#tipo-search', EN ? 'fee' : 'taxa');
    await page.getByRole('option', { name: TEXTO.taxa, exact: true }).click();
    await aguardarLinhasFiltradas();
    const tipos = await page
      .locator('tbody tr td:nth-child(3)')
      .evaluateAll(tds => tds.map(td => td.textContent.trim()));
    const vazados = [...new Set(tipos.filter(t => ![TEXTO.imposto, TEXTO.taxa].includes(t)))];
    if (vazados.length) throw new Error(`filtro multisseleção vazou: ${vazados.join(', ')}`);
    if (!tipos.includes(TEXTO.imposto) || !tipos.includes(TEXTO.taxa)) {
      throw new Error('combinação não retornou as duas categorias selecionadas');
    }
    igual(
      await page.locator('#tipo').getAttribute('aria-expanded'),
      'true',
      'combobox permanece aberto',
    );
  } finally {
    await page.keyboard.press('Escape');
    await page.click('#reset');
    await aguardarTodasAsLinhas();
  }
});

await checar('contexto usa categorias atômicas e chips removíveis', async () => {
  try {
    await page.click('#contexto');
    await page.fill('#contexto-search', 'empresa');
    await page.getByRole('option', { name: TEXTO.empresa, exact: true }).click();
    await aguardarLinhasFiltradas();
    const contextos = await page.locator('#tbody tr td:nth-child(5)').allTextContents();
    if (!contextos.every(c => c.split(/\s*\/\s*/).includes(TEXTO.empresa))) {
      throw new Error('filtro Empresa retornou contexto sem a categoria atômica');
    }
    if (!contextos.some(c => c !== 'Empresa')) {
      throw new Error('filtro Empresa não incluiu contextos compostos');
    }
    const chip = page.getByRole('button', {
      name: `${TEXTO.remove} ${TEXTO.contexto}: ${TEXTO.empresa}`,
    });
    igual(await chip.count(), 1, 'chip do filtro');
    await page.keyboard.press('Escape');
    await chip.click();
    await aguardarTodasAsLinhas();
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
  if (ux.searchBottom > ux.viewport) {
    throw new Error(`busca abaixo da primeira tela: ${ux.searchBottom}px`);
  }
  if (!ux.labels) throw new Error('há rótulo de filtro invisível');
});

await checar('ordenação acionável por teclado (Enter) e aria-sort correto', async () => {
  await page.focus('th[data-key="nome"] .th-btn');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('th[data-key="nome"]').getAttribute('aria-sort') === 'ascending',
  );
  const primeiroAsc = await page.locator('#tbody tr th').first().innerText();

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('th[data-key="nome"]').getAttribute('aria-sort') === 'descending',
  );
  const primeiroDesc = await page.locator('#tbody tr th').first().innerText();

  if (primeiroAsc === primeiroDesc) {
    throw new Error('ordem não inverteu ao pressionar Enter novamente');
  }

  const sorts = await page
    .locator('th[data-key]')
    .evaluateAll(ths => ths.map(t => t.getAttribute('aria-sort')));
  if (sorts.filter(s => s !== 'none').length !== 1) {
    throw new Error(`apenas uma coluna deve estar ordenada, obtido: ${sorts.join(',')}`);
  }
});

await checar('skip-link aponta para destino existente e focável', async () => {
  const href = await page.locator('a.skip-link').getAttribute('href');
  const alvo = page.locator(href);
  igual(await alvo.count(), 1, `destino ${href}`);
  igual(await alvo.getAttribute('tabindex'), '-1', 'tabindex do destino');
});

await checar('copiar Markdown gera conteúdo esperado por item', async () => {
  await page.goto(`${URL_AUDITADA}?profile=all`);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(URL_AUDITADA).origin,
  });
  await entrarNoGuia(page);
  await page.locator('[data-copy-id="iss"]').first().click();
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  if (!texto.startsWith('## ISS — ')) throw new Error(`Markdown inesperado: ${texto.slice(0, 40)}`);
  if (!texto.includes(`- **${TEXTO.tipo}:** ${TEXTO.imposto}`)) {
    throw new Error('Markdown sem tipo');
  }
  igual(
    await page.locator('#copy-status').textContent(),
    'ISS copiado como Markdown.',
    'status da cópia',
  );
});

await checar('export CSV gera arquivo com cabeçalho e BOM', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#csv'),
  ]);
  igual(
    download.suggestedFilename(),
    EN ? 'taxes-brasil-filtrado.csv' : 'tributos-brasil-filtrado.csv',
    'nome do arquivo',
  );
  const stream = await download.createReadStream();
  let conteudo = '';
  for await (const c of stream) conteudo += c;
  if (!conteudo.startsWith('\uFEFF')) throw new Error('CSV sem BOM UTF-8 (quebra no Excel)');
  const primeiraLinha = conteudo.replace('\uFEFF', '').split('\n')[0];
  igual(primeiraLinha.split(';').length, 8, 'colunas no cabeçalho do CSV');
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
      .filter(u => /^https?:\/\//.test(u) && !u.startsWith(location.origin)),
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
      e => getComputedStyle(e).maskImage !== 'none',
    ).length;
    return {
      total: els.length,
      semMascara: semMascara.map(e => `${e.tagName}[${e.dataset.icone}]`).slice(0, 5),
      tdSemChave,
      indicadores,
      totalTh: document.querySelectorAll('th[data-key]').length,
    };
  });
  if (r.total === 0) throw new Error('nenhum elemento com [data-icone] encontrado');
  if (r.semMascara.length) {
    throw new Error(`ícones sem mask-image (data-URI inválido?): ${r.semMascara.join(', ')}`);
  }
  igual(r.tdSemChave, 0, 'células com data-icone vazio (mapeamento incompleto)');
  igual(r.indicadores, r.totalTh, 'indicadores de ordenação com ícone');
});

await checar('ícones desenham pixels de verdade (data-URI válido)', async () => {
  // Um data-URI corrompido (ex.: '#' com duplo-encode) ainda reporta maskImage != none,
  // mas não pinta nada. A única verificação honesta é comparar pixels renderizados.
  const amostras = [
    { sel: '.card h2[data-icone]', nome: 'card' },
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
      img.src = `data:image/png;base64,${b64}`;
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
    if (cores < 3) {
      throw new Error(
        `ícone não desenhou pixels em ${nome} (${sel}): apenas ${cores} cor(es) no recorte`,
      );
    }
  }
});

await checar('ícones são decorativos (invisíveis para leitores de tela)', async () => {
  // Pseudo-elementos não entram na árvore de acessibilidade. Garantimos que ninguém
  // trocou por <img>/<svg> sem texto alternativo, o que criaria ruído ou perda de info.
  const r = await page.evaluate(() => ({
    imgs: document.querySelectorAll('img').length,
    svgSemTitulo: [...document.querySelectorAll('svg')].filter(
      s =>
        !s.getAttribute('aria-label') &&
        !s.querySelector('title') &&
        s.getAttribute('aria-hidden') !== 'true',
    ).length,
  }));
  igual(r.imgs, 0, '<img> na página (ícones devem ser CSS)');
  igual(r.svgSemTitulo, 0, '<svg> sem rótulo nem aria-hidden');
});

await checar('texto permanece legível sem os ícones (não há dependência visual)', async () => {
  // Se um ícone fosse a única fonte de informação, remover as máscaras perderia dados.
  const r = await page.evaluate(() => {
    const linha = document.querySelector('#tbody tr');
    const celulas = [...linha.querySelectorAll('th,td')].map(c => c.textContent.trim());
    return { celulas, vazias: celulas.filter(t => t.length === 0).length };
  });
  igual(r.vazias, 0, `células sem texto próprio (${JSON.stringify(r.celulas)})`);
});

await checar('deep-link restaura filtros, hash, foco e histórico', async () => {
  await page.goto(`${URL_AUDITADA}?profile=all&tipo=${encodeURIComponent(TEXTO.imposto)}#item-iss`);
  await page.getByRole('button', { name: /Entrar no guia com/ }).click();
  igual(await linhas(), 18, 'linhas filtradas por URL');
  igual(await page.locator('#iss').count(), 1, 'item do hash');
  await page.locator('#iss').focus();
  await page.waitForFunction(() => document.activeElement?.id === 'iss');
  const focado = await page.evaluate(() => document.activeElement?.id);
  igual(focado, 'iss', 'foco no item do hash');
  await page.goto(`${URL_AUDITADA}?profile=all&esfera=Federal`);
  await page.goBack();
  igual(
    await page.url(),
    `${URL_AUDITADA}?profile=all&tipo=${encodeURIComponent(TEXTO.imposto)}#item-iss`,
    'voltar restaura URL',
  );
  await page.goForward();
  igual(await page.url(), `${URL_AUDITADA}?profile=all&esfera=Federal`, 'avançar restaura URL');
});

await checar('embed renderiza item válido e trata id inválido', async () => {
  await page.goto(`${URL_AUDITADA}?embed=iss`);
  igual(await page.locator('#embed-panel').getAttribute('hidden'), null, 'painel embed visível');
  igual(
    await page.locator('#embed-title').textContent(),
    EN
      ? 'ISS — Tax sobre Serviços de Qualquer Natureza'
      : 'ISS — Imposto sobre Serviços de Qualquer Natureza',
    'título embed',
  );
  igual(await page.locator('table:visible').count(), 0, 'layout mínimo sem tabela visível');
  await page.goto(`${URL_AUDITADA}?embed=id-que-nao-existe`);
  igual(
    await page.locator('#embed-title').textContent(),
    'Item não encontrado',
    'mensagem para id inválido',
  );
  igual(await page.locator('.embed-back').count(), 1, 'retorno ao catálogo');
});

await checar('aliases retornam o item correto', async () => {
  await page.goto(`${URL_AUDITADA}?profile=all`);
  await entrarNoGuia(page);
  const casos = [
    [EN ? 'contribution patronal' : 'INSS patronal', 'cpp'],
    [EN ? 'tax do MEI' : 'imposto do MEI', 'das-mei'],
    ['carnê-leão', 'irpf'],
    [EN ? 'tax municipal sobre services' : 'imposto municipal sobre serviços', 'iss'],
    [EN ? 'tax do consumo' : 'imposto do consumo', 'ibs'],
    ['carnê do INSS', 'gps'],
    [EN ? 'tax do carro' : 'imposto do carro', 'ipva'],
    [EN ? 'tax da herança' : 'imposto da herança', 'itcmd'],
    [EN ? 'fee do lixo' : 'taxa do lixo', 'tlp'],
    ['guia do Simples Nacional', 'das'],
    [EN ? 'fee de alvará' : 'taxa de alvará', 'tff-municipal'],
    ['guia federal', 'darf'],
  ];
  for (const [termo, id] of casos) {
    const termoLocalizado = EN
      ? await page.evaluate(
          ({ id, fallback }) =>
            DATA.find(item => item.id === id)?.aliases?.[id === 'iss' ? 1 : 0] || fallback,
          { id, fallback: termo },
        )
      : termo;
    if (EN) await page.fill('#search', '');
    await page.fill('#search', termoLocalizado);
    await page.waitForFunction(
      expected =>
        document.querySelectorAll('#tbody tr').length === 1 &&
        document.querySelector('#tbody tr')?.id === expected,
      id,
      { timeout: 5000 },
    );
  }
});

await checar('relações da Reforma são válidas, recíprocas e filtráveis', async () => {
  /* global DATA */
  await page.goto(`${URL_AUDITADA}?profile=all`);
  await entrarNoGuia(page);
  const resultado = await page.evaluate(() => {
    const ids = new Set(DATA.map(x => x.id));
    const erros = [];
    DATA.forEach(x => {
      for (const [campo, inverso] of [
        ['substituido_por', 'substitui'],
        ['substitui', 'substituido_por'],
      ]) {
        for (const id of x[campo] || []) {
          if (!ids.has(id) || !(DATA.find(y => y.id === id)?.[inverso] || []).includes(x.id)) {
            erros.push(`${x.id}->${id}`);
          }
        }
      }
    });
    const timeCount = DATA.filter(x => x.vigencia).reduce(
      (n, x) => n + x.vigencia.marcos.length,
      0,
    );
    return {
      erros,
      timeCount,
      relations: DATA.filter(x => (x.substituido_por || []).length || (x.substitui || []).length)
        .length,
    };
  });
  if (resultado.erros.length) throw new Error(`relações inválidas: ${resultado.erros.join(',')}`);
  if (resultado.relations < 6 || resultado.timeCount < 20) {
    throw new Error('cobertura de relações ou marcos insuficiente');
  }
  await page.click('#reforma');
  await page.getByRole('option', { name: 'O que sai', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('#tbody tr').length > 0);
  if (!(await page.locator('#tbody tr details.reforma-details').count())) {
    throw new Error('filtro não renderizou relações');
  }
  const tempos = await page.locator('#tbody tr time[datetime]').count();
  if (!tempos) throw new Error('timeline sem elementos time');
});

await checar('modo comparação cobre pares prioritários e limita 2–4 itens', async () => {
  await page.goto(`${URL_AUDITADA}?profile=all`);
  await entrarNoGuia(page);
  const escolher = async siglas => {
    for (const sigla of siglas) {
      await page.locator(`[data-compare-id="${sigla.toLowerCase()}"]`).click();
    }
    igual(
      await page.locator('.comparison-card').count(),
      siglas.length,
      `cards de ${siglas.join('×')}`,
    );
  };
  await escolher(['ITBI', 'ITCMD']);
  await page.locator('[data-compare-id="cbs"]').click();
  await page.locator('[data-compare-id="cofins"]').click();
  await page.locator('[data-compare-id="rat"]').click();
  igual(await page.locator('.comparison-card').count(), 4, 'limite máximo');
  for (const sigla of ['ITBI', 'ITCMD', 'CBS', 'COFINS']) {
    if (!(await page.locator('.comparison-card').getByText(sigla, { exact: true }).count())) {
      throw new Error(`item ${sigla} ausente`);
    }
  }
  for (const id of ['itbi', 'itcmd', 'cbs', 'cofins']) {
    await page.locator(`[data-compare-id="${id}"]`).click();
  }
  await page.locator('[data-compare-id="rat"]').click();
  await page.locator('[data-compare-id="fap"]').click();
  igual(await page.locator('.comparison-card').count(), 2, 'troca de seleção');
  if (!(await page.locator('.comparison-card').getByText('RAT', { exact: true }).count())) {
    throw new Error('par RAT×FAP não renderizou');
  }
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
