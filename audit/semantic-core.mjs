// Auditoria de Semantic HTML Score — executada no DOM renderizado.
// Núcleo reutilizável: recebe uma page do Playwright e devolve o relatório em JSON.
export async function auditar(page) {
  return await page.evaluate(() => {
    const q = s => Array.from(document.querySelectorAll(s));
    const checks = [];
    const add = (categoria, criterio, peso, pontos, detalhe) =>
      checks.push({ categoria, criterio, peso, pontos, detalhe });

    // ---------- 1. Landmarks / estrutura de documento (peso 20) ----------
    const landmarks = {
      header: q('header').length,
      nav: q('nav').length,
      main: q('main').length,
      footer: q('footer').length,
      section: q('section').length,
      article: q('article').length,
      aside: q('aside').length,
    };
    const hasMain = landmarks.main === 1;
    add(
      'Landmarks',
      '<main> único envolvendo o conteúdo principal',
      8,
      hasMain ? 8 : 0,
      `main encontrados: ${landmarks.main}`,
    );
    add(
      'Landmarks',
      '<header> e <footer> presentes',
      4,
      (landmarks.header ? 2 : 0) + (landmarks.footer ? 2 : 0),
      `header=${landmarks.header} footer=${landmarks.footer}`,
    );
    add(
      'Landmarks',
      '<section>/<article> usados para agrupar',
      4,
      Math.min(4, landmarks.section + landmarks.article ? 4 : 0),
      `section=${landmarks.section} article=${landmarks.article}`,
    );
    add(
      'Landmarks',
      'Regiões de busca/filtro com <form> ou role=search',
      4,
      q('form').length || q('[role=search]').length ? 4 : 0,
      `form=${q('form').length} role=search=${q('[role=search]').length}`,
    );

    // ---------- 2. Hierarquia de headings (peso 15) ----------
    const hs = q('h1,h2,h3,h4,h5,h6').map(h => +h.tagName[1]);
    const h1count = hs.filter(n => n === 1).length;
    let skips = 0;
    for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skips++;
    add('Headings', 'Exatamente um <h1>', 6, h1count === 1 ? 6 : 0, `h1=${h1count}`);
    add(
      'Headings',
      'Nenhum nível pulado',
      5,
      skips === 0 ? 5 : Math.max(0, 5 - skips * 2),
      `saltos=${skips} sequencia=[${hs.join(',')}]`,
    );
    add(
      'Headings',
      'Seções com heading próprio',
      4,
      (() => {
        const secs = q('section,article');
        if (!secs.length) return 0;
        const ok = secs.filter(s => s.querySelector('h1,h2,h3,h4,h5,h6')).length;
        return Math.round((ok / secs.length) * 4);
      })(),
      `${q('section,article').filter(s => s.querySelector('h1,h2,h3,h4,h5,h6')).length}/${q('section,article').length}`,
    );

    // ---------- 3. Formulários e rótulos (peso 20) ----------
    const controls = q('input,select,textarea');
    const labelled = controls.filter(c => {
      const id = c.id;
      return (
        (id && document.querySelector(`label[for="${id}"]`)) ||
        c.closest('label') ||
        c.getAttribute('aria-label') ||
        c.getAttribute('aria-labelledby') ||
        c.getAttribute('title')
      );
    });
    add(
      'Formulários',
      'Todo controle tem rótulo acessível',
      12,
      controls.length ? Math.round((labelled.length / controls.length) * 12) : 0,
      `${labelled.length}/${controls.length} rotulados`,
    );
    const btns = q('button');
    const btnsTyped = btns.filter(b => b.hasAttribute('type'));
    add(
      'Formulários',
      '<button> com type explícito',
      4,
      btns.length ? Math.round((btnsTyped.length / btns.length) * 4) : 0,
      `${btnsTyped.length}/${btns.length}`,
    );
    add(
      'Formulários',
      '<fieldset>/<legend> em grupos de filtro',
      4,
      q('fieldset').length ? 4 : 0,
      `fieldset=${q('fieldset').length}`,
    );

    // ---------- 4. Tabela de dados (peso 20) ----------
    const tables = q('table');
    const t = tables[0];
    add(
      'Tabela',
      '<thead>/<tbody> presentes',
      4,
      t && t.tHead && t.tBodies.length ? 4 : 0,
      t ? `thead=${!!t.tHead} tbody=${t.tBodies.length}` : 'sem tabela',
    );
    const ths = q('th');
    const thScoped = ths.filter(th => th.hasAttribute('scope'));
    add(
      'Tabela',
      '<th scope> em todos os cabeçalhos',
      5,
      ths.length ? Math.round((thScoped.length / ths.length) * 5) : 0,
      `${thScoped.length}/${ths.length} com scope`,
    );
    add(
      'Tabela',
      '<caption> descrevendo a tabela',
      4,
      t && t.caption ? 4 : 0,
      t ? `caption=${!!t.caption}` : '-',
    );
    const sortableTh = ths.filter(th => th.dataset.key);
    const sortedAria = sortableTh.filter(th => th.hasAttribute('aria-sort'));
    add(
      'Tabela',
      'aria-sort nos cabeçalhos ordenáveis',
      4,
      sortableTh.length ? Math.round((sortedAria.length / sortableTh.length) * 4) : 0,
      `${sortedAria.length}/${sortableTh.length}`,
    );
    const thBtn = sortableTh.filter(th => th.querySelector('button') || th.tabIndex >= 0);
    add(
      'Tabela',
      'Cabeçalho ordenável focável por teclado',
      3,
      sortableTh.length ? Math.round((thBtn.length / sortableTh.length) * 3) : 0,
      `${thBtn.length}/${sortableTh.length} focáveis`,
    );

    // ---------- 5. Divitis / uso de tags genéricas (peso 10) ----------
    const all = q('*').length;
    const generic = q('div,span').length;
    const ratio = generic / all;
    add(
      'Divitis',
      'Baixa proporção de div/span',
      10,
      ratio <= 0.15 ? 10 : ratio <= 0.3 ? 7 : ratio <= 0.45 ? 4 : 1,
      `${generic}/${all} = ${(ratio * 100).toFixed(1)}% genéricas`,
    );

    // ---------- 6. Texto e microssemântica (peso 8) ----------
    add(
      'Texto',
      'Listas reais (<ul>/<ol>/<dl>) em enumerações',
      3,
      q('ul,ol,dl').length ? 3 : 0,
      `listas=${q('ul,ol,dl').length}`,
    );
    add(
      'Texto',
      '<strong>/<em> em vez de <b>/<i>',
      3,
      q('b,i').length === 0 ? 3 : 1,
      `b/i=${q('b,i').length} strong/em=${q('strong,em').length}`,
    );
    add(
      'Texto',
      '<time>/<abbr>/<dfn> para datas e siglas',
      2,
      Math.min(2, q('time,abbr,dfn').length ? 2 : 0),
      `time=${q('time').length} abbr=${q('abbr').length} dfn=${q('dfn').length}`,
    );

    // ---------- 7. Live regions e feedback dinâmico (peso 7) ----------
    add(
      'Dinâmico',
      'Contador de resultados como aria-live',
      4,
      q('[aria-live],output,[role=status]').length ? 4 : 0,
      `live/status/output=${q('[aria-live],output,[role=status]').length}`,
    );
    add(
      'Dinâmico',
      'Estado vazio anunciável (não só display:none)',
      3,
      (() => {
        const e = document.getElementById('empty');
        if (!e) return 0;
        return e.hasAttribute('aria-live') || e.getAttribute('role') === 'status' ? 3 : 0;
      })(),
      (() => {
        const e = document.getElementById('empty');
        return e
          ? `role=${e.getAttribute('role')} aria-live=${e.getAttribute('aria-live')}`
          : 'ausente';
      })(),
    );

    // ---------- Extras informativos ----------
    const meta = {
      lang: document.documentElement.lang || '(ausente)',
      title: document.title.length,
      metaDescription: !!document.querySelector('meta[name=description]'),
      viewport: !!document.querySelector('meta[name=viewport]'),
      imgs: q('img').length,
      imgsSemAlt: q('img:not([alt])').length,
      skipLink: !!document.querySelector('a[href^="#"]'),
    };

    // ---------- Consolidação ----------
    const porCategoria = {};
    let pesoTotal = 0,
      pontosTotal = 0;
    for (const c of checks) {
      porCategoria[c.categoria] ??= { peso: 0, pontos: 0 };
      porCategoria[c.categoria].peso += c.peso;
      porCategoria[c.categoria].pontos += c.pontos;
      pesoTotal += c.peso;
      pontosTotal += c.pontos;
    }
    const score = Math.round((pontosTotal / pesoTotal) * 100);
    const nota =
      score >= 90
        ? 'A'
        : score >= 80
          ? 'B'
          : score >= 70
            ? 'C'
            : score >= 60
              ? 'D'
              : score >= 50
                ? 'E'
                : 'F';

    return JSON.stringify(
      {
        score,
        nota,
        pontosTotal,
        pesoTotal,
        porCategoria,
        checks,
        landmarks,
        meta,
      },
      null,
      2,
    );
  });
}
