#!/usr/bin/env node
/**
 * Gate de responsividade. Falha (exit 1) se QUALQUER breakpoint tiver problema.
 *
 * Larguras auditadas:
 *   320px  celular pequeno       768px  tablet          1440px desktop
 *   375px  iPhone               1024px  tablet/desktop  1920px monitor grande
 *   390px  celular moderno      1280px  desktop
 *
 * Verificações por largura:
 *   1. sem scroll horizontal no documento
 *   2. nenhum elemento estourando a viewport (fora do scroller intencional da tabela)
 *   3. alvos de toque >= 44x44 CSS px em viewports touch (<= 768px) — WCAG 2.5.5 / 2.5.8
 *   4. sem sobreposição entre controles de filtro
 *   5. texto legível (>= 12px) e corpo >= 14px
 *   6. tabela permanece operável no desktop e vira cards no celular
 *   7. a barra de filtros sticky não cobre o conteúdo ao usar o skip-link
 *   8. conteúdo essencial visível e funcional (filtro aplica em qualquer largura)
 */
import { devices } from 'playwright';
import { abrirNavegador, abrirPagina, entrarNoGuia, salvarRelatorio } from './browser.mjs';

const BREAKPOINTS = [
  { w: 320, rotulo: 'celular pequeno', touch: true },
  { w: 375, rotulo: 'iPhone', touch: true },
  { w: 390, rotulo: 'celular moderno', touch: true },
  { w: 768, rotulo: 'tablet', touch: true },
  { w: 1024, rotulo: 'tablet/desktop pequeno', touch: false },
  { w: 1280, rotulo: 'desktop', touch: false },
  { w: 1440, rotulo: 'desktop', touch: false },
  { w: 1920, rotulo: 'monitor grande', touch: false },
];

const ALVO_MIN = 44; // WCAG 2.5.5 Target Size (Enhanced)
const FONTE_MIN = 12;
const FONTE_CORPO_MIN = 14;

const browser = await abrirNavegador();
const relatorio = [];
let totalProblemas = 0;

for (const bp of BREAKPOINTS) {
  const page = await abrirPagina(browser, {
    viewport: { width: bp.w, height: 900 },
    hasTouch: bp.touch,
    isMobile: false, // isMobile altera o layout viewport; queremos medir a largura pedida
    deviceScaleFactor: 1,
  });
  await entrarNoGuia(page);
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0);

  const problemas = await page.evaluate(
    ({ ALVO_MIN, FONTE_MIN, FONTE_CORPO_MIN, touch, largura }) => {
      const ps = [];
      const de = document.documentElement;
      const vw = de.clientWidth;
      const scroller = document.querySelector('.table-wrap');

      const desc = el =>
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : '');

      // 1. scroll horizontal no documento
      const overflowDoc = de.scrollWidth - vw;
      if (overflowDoc > 0) {
        ps.push(
          `scroll horizontal no documento: ${overflowDoc}px (scrollWidth ${de.scrollWidth} > viewport ${vw})`,
        );
      }

      // 2. elementos estourando a viewport
      for (const el of document.querySelectorAll('body *')) {
        if (scroller && (el === scroller || scroller.contains(el))) continue; // scroller é intencional
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'absolute') continue; // skip-link fora de tela
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.right > vw + 1) {
          ps.push(`${desc(el)} estoura à direita: right=${Math.round(b.right)} > viewport=${vw}`);
        }
        if (b.left < -1) ps.push(`${desc(el)} estoura à esquerda: left=${Math.round(b.left)}`);
      }

      // 3. alvos de toque
      if (touch) {
        const interativos = document.querySelectorAll(
          'button, a[href], select, input, [tabindex]:not([tabindex="-1"])',
        );
        for (const el of interativos) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.position === 'absolute') continue;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (b.height < ALVO_MIN || b.width < ALVO_MIN) {
            ps.push(
              `alvo de toque pequeno em ${desc(el)}: ${Math.round(b.width)}x${Math.round(b.height)} < ${ALVO_MIN}x${ALVO_MIN}`,
            );
          }
        }
      }

      // 4. sobreposição entre controles de filtro
      const campos = [...document.querySelectorAll('.filter-grid input, .filter-grid select')];
      for (let i = 0; i < campos.length; i++) {
        for (let j = i + 1; j < campos.length; j++) {
          const a = campos[i].getBoundingClientRect();
          const b = campos[j].getBoundingClientRect();
          const sobrepoe =
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1;
          if (sobrepoe) ps.push(`controles sobrepostos: ${desc(campos[i])} e ${desc(campos[j])}`);
        }
      }

      // 5. legibilidade
      const corpo = parseFloat(getComputedStyle(document.body).fontSize);
      if (corpo < FONTE_CORPO_MIN) {
        ps.push(`fonte do corpo muito pequena: ${corpo}px < ${FONTE_CORPO_MIN}px`);
      }
      const amostra = ['.subtitle', '.card p', '.legend li', 'tbody td', 'footer p', '.stats'];
      for (const sel of amostra) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < FONTE_MIN) ps.push(`texto pequeno em ${sel}: ${fs}px < ${FONTE_MIN}px`);
      }

      // 6. desktop usa tabela; celular usa cards sem rolagem horizontal
      const cardResults = document.querySelector('.result-cards');
      if (largura <= 600) {
        if (getComputedStyle(scroller).display !== 'none') {
          ps.push('tabela deveria estar oculta no celular');
        }
        if (!cardResults || getComputedStyle(cardResults).display === 'none') {
          ps.push('cards de resultado ausentes no celular');
        }
        if (document.querySelectorAll('.result-card').length !== 78) {
          ps.push(
            `quantidade incorreta de cards: ${document.querySelectorAll('.result-card').length}`,
          );
        }
      } else if (scroller) {
        const sb = scroller.getBoundingClientRect();
        if (sb.right > vw + 1) {
          ps.push(`.table-wrap vaza da viewport: right=${Math.round(sb.right)} > ${vw}`);
        }
        const tabela = scroller.querySelector('table');
        if (
          tabela &&
          scroller.scrollWidth <= scroller.clientWidth &&
          tabela.getBoundingClientRect().width > sb.width + 1
        ) {
          ps.push('tabela maior que o container mas o scroller não rola');
        }
      }

      // 7. barra sticky: só exige folga de scroll se ela realmente for sticky nesta largura,
      //    e ela não pode ocupar mais de 40% da viewport quando for.
      const filtros = document.querySelector('.filters');
      const resultados = document.getElementById('resultados');
      if (filtros && resultados) {
        const posicao = getComputedStyle(filtros).position;
        const alturaBarra = filtros.getBoundingClientRect().height;
        if (posicao === 'sticky') {
          const sm = parseFloat(getComputedStyle(resultados).scrollMarginTop) || 0;
          if (sm < alturaBarra) {
            ps.push(
              `scroll-margin-top de #resultados (${sm}px) menor que a barra sticky (${Math.round(alturaBarra)}px): cabeçalho da tabela ficaria coberto`,
            );
          }
          const limite = window.innerHeight * 0.4;
          if (alturaBarra > limite) {
            ps.push(
              `barra sticky ocupa ${Math.round(alturaBarra)}px de ${window.innerHeight}px ` +
                `(${Math.round((alturaBarra / window.innerHeight) * 100)}% da viewport, limite 40%): ` +
                `deveria deixar de ser sticky nesta largura`,
            );
          }
        }
      }

      // 8. conteúdo essencial presente
      const essenciais = ['h1', '#search', '#count'];
      if (largura <= 600) essenciais.push('.result-card');
      else essenciais.push('table thead th', 'tbody tr');
      for (const sel of essenciais) {
        if (!document.querySelector(sel)) ps.push(`elemento essencial ausente: ${sel}`);
      }

      return {
        problemas: ps,
        metricas: {
          viewport: vw,
          scrollWidth: de.scrollWidth,
          cards: getComputedStyle(document.querySelector('.cards')).gridTemplateColumns.split(' ')
            .length,
          filtros: getComputedStyle(
            document.querySelector('.filter-grid'),
          ).gridTemplateColumns.split(' ').length,
          h1: getComputedStyle(document.querySelector('h1')).fontSize,
          linhas: document.querySelectorAll('tbody tr').length,
        },
      };
    },
    { ALVO_MIN, FONTE_MIN, FONTE_CORPO_MIN, touch: bp.touch, largura: bp.w },
  );

  // 8b. o filtro precisa funcionar nesta largura (teste de comportamento, não só de layout)
  const ps = [...problemas.problemas];
  try {
    const resultSelector = bp.w <= 600 ? '.result-card' : 'tbody tr';
    await page.fill('#search', 'ICMS');
    await page.waitForFunction(sel => document.querySelectorAll(sel).length === 1, resultSelector, {
      timeout: 5000,
    });
    await page.click('#reset');
    await page.waitForFunction(
      sel => document.querySelectorAll(sel).length === 78,
      resultSelector,
      { timeout: 5000 },
    );
  } catch {
    ps.push('filtro/reset não funcionou nesta largura');
  }

  const m = problemas.metricas;
  const unicos = [...new Set(ps)];
  totalProblemas += unicos.length;
  relatorio.push({ largura: bp.w, rotulo: bp.rotulo, problemas: unicos, metricas: m });

  const icone = unicos.length ? '✗' : '✓';
  console.log(
    `${icone} ${String(bp.w).padStart(4)}px ${bp.rotulo.padEnd(22)} ` +
      `cards=${m.cards}col filtros=${m.filtros}col h1=${m.h1} linhas=${m.linhas}${
        unicos.length ? `  → ${unicos.length} problema(s)` : ''
      }`,
  );
  for (const p of unicos.slice(0, 8)) console.log(`      • ${p}`);
  if (unicos.length > 8) console.log(`      … e mais ${unicos.length - 8}`);

  await page.close();
}

// Verificação extra: emulação de dispositivos reais (com isMobile e DPR corretos)
console.log('\n— emulação de dispositivos reais —');
for (const nome of ['iPhone 14', 'Pixel 7', 'iPad Mini']) {
  const d = devices[nome];
  if (!d) continue;
  const ctx = await browser.newContext({ ...d });
  const page = await abrirPagina(browser, { contexto: ctx });
  const r = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vw: document.documentElement.clientWidth,
  }));
  const ok = r.overflow <= 0;
  if (!ok) totalProblemas++;
  console.log(`${ok ? '✓' : '✗'} ${nome.padEnd(12)} viewport=${r.vw}px overflow=${r.overflow}px`);
  relatorio.push({ dispositivo: nome, problemas: ok ? [] : [`overflow de ${r.overflow}px`] });
  await ctx.close();
}

await browser.close();
salvarRelatorio('responsive.json', relatorio);

console.log(`\nBreakpoints auditados: ${BREAKPOINTS.map(b => `${b.w}px`).join(', ')}`);
console.log(`TOTAL DE PROBLEMAS: ${totalProblemas}`);

if (totalProblemas > 0) {
  console.error('\n✗ GATE de responsividade REPROVADO: exigido 0 problemas em todas as larguras.');
  process.exit(1);
}
console.log('✓ GATE de responsividade APROVADO (8 larguras + 3 dispositivos).');
