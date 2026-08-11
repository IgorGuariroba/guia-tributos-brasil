#!/usr/bin/env node
/**
 * Infraestrutura compartilhada pelos gates que dirigem um navegador.
 *
 * Existe para que a URL auditada, o viewport de referência, a condição de
 * "página pronta" e o caminho dos relatórios tenham UMA definição só. Antes,
 * cada gate repetia `chromium.launch()` + `newPage({1440x900})` +
 * `goto(networkidle)` + `browser.close()`, e uma mudança na condição de espera
 * exigia editar quatro arquivos — com risco de os gates divergirem em silêncio.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

/** URL servida pelo orquestrador (audit/run-gates.mjs) ou o padrão do `npm run serve`. */
export const URL_AUDITADA = process.env.AUDIT_URL || 'http://localhost:8080/';

/** Viewport de referência dos gates não-responsivos. */
export const VIEWPORT_PADRAO = { width: 1440, height: 900 };

/** Total de itens do guia. Usado no rótulo do botão que confirma a entrada. */
export const TOTAL_ITENS = 78;

const DIR_RELATORIOS = 'audit/reports';

export const abrirNavegador = () => chromium.launch();

/**
 * Cria uma página já carregada e pronta para asserções.
 *
 * @param browser            instância de navegador
 * @param opcoes.viewport    default: 1440x900
 * @param opcoes.antesDeAbrir callback síncrono executado com a página ainda em
 *                            branco — indispensável para registrar listeners de
 *                            `console`/`pageerror` sem perder eventos da carga.
 * @param opcoes.contexto    contexto próprio (emulação de dispositivo); quando
 *                            informado, a página nasce dele em vez do browser.
 */
export async function abrirPagina(browser, opcoes = {}) {
  const { viewport = VIEWPORT_PADRAO, antesDeAbrir, contexto, ...resto } = opcoes;
  const page = contexto ? await contexto.newPage() : await browser.newPage({ viewport, ...resto });
  antesDeAbrir?.(page);
  await page.goto(URL_AUDITADA, { waitUntil: 'networkidle' });
  return page;
}

/**
 * Atravessa o diálogo de perfil de interesse até a tabela completa.
 * A página abre num seletor de perfil; sem isso a tabela nem existe no DOM.
 */
export async function entrarNoGuia(page) {
  await page.getByRole('button', { name: /Explorar tudo/ }).click();
  await page.getByRole('button', { name: `Entrar no guia com ${TOTAL_ITENS} itens` }).click();
}

/** Grava um relatório JSON em audit/reports/ e devolve o caminho escrito. */
export function salvarRelatorio(arquivo, dados) {
  mkdirSync(DIR_RELATORIOS, { recursive: true });
  const caminho = `${DIR_RELATORIOS}/${arquivo}`;
  writeFileSync(caminho, JSON.stringify(dados, null, 2));
  return caminho;
}
