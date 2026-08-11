#!/usr/bin/env node
/** Gate de internacionalização: verifica metadados, JSON-LD e resíduos de interface. */
import { readFile } from 'node:fs/promises';
const br = JSON.parse(await readFile('data/tributos.json', 'utf8'));
const en = await readFile('public/en/index.html', 'utf8');
const erros = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) erros.push(mensagem);
};
exigir(/<html lang="en-US">/.test(en), 'en/ precisa declarar lang="en-US".');
for (const rel of ['pt-BR', 'en', 'x-default']) {
  exigir(en.includes(`hreflang="${rel}"`), `en/ sem hreflang ${rel}.`);
}
exigir(
  /<title>Brazilian Taxes, Contributions, Fees and Charges Guide<\/title>/.test(en),
  'title en-US incorreto.',
);
exigir(
  /content="Searchable guide to Brazilian taxes, contributions, fees and charges:/.test(en),
  'description en-US ausente ou parcial.',
);
exigir(
  /<h1>Taxes, contributions, fees and charges in Brazil<\/h1>/.test(en),
  'h1 en-US incorreto.',
);
exigir(!en.includes('og:locale" content="pt_BR"'), 'og:locale ainda pt_BR.');
const jsonLd = JSON.parse(en.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
exigir(jsonLd.inLanguage === 'en-US', 'JSON-LD precisa declarar inLanguage en-US.');
exigir(
  jsonLd.name === 'Brazilian Taxes, Contributions, Fees and Charges Guide',
  'nome do JSON-LD não está em inglês.',
);
const interfaceEn = en
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
  .replace(/const DATA = \[[\s\S]*?;\n/, '');
for (const frase of [
  'Guia de taxes do Brazil',
  'Guia de Taxes do Brazil',
  'no Brazil',
  '78 siglas',
  'Guia pesquisável',
  'Tributos, contribuições, taxas e encargos no Brasil',
  'Escolha de perfil de interesse',
  'Pesquisar e filtrar tributos',
  'Copiar Markdown',
  'Item não encontrado',
  'Selecione',
  'Pesquisar em todos os dados',
  'Limpar filters',
  'Relação na Reforma',
  'Todos os tipos',
  'Todas as esferas',
  'Todos os contextos',
  'Tax de renda',
  'Taxes da empresa',
  'Novos taxes do consumo',
  ' e legislation',
  ' do Brazil',
  ' no Brazil',
  ' taxes do ',
  ' fees e ',
  ' charges no ',
  ' de siglas',
  'Selecione de ',
  'conforme',
  'durante a transition',
  'e charges',
  'de itens',
]) {
  exigir(!interfaceEn.includes(frase), `resíduo de interface/JS pt-BR: ${frase}`);
}
for (const item of br) {
  exigir(en.includes(`"id":"${item.id}"`), `ID ausente na versão en-US: ${item.id}.`);
}
exigir(
  en.includes('Searchable guide') && en.includes('Tax reform'),
  'interface en-US não encontrada.',
);
if (erros.length) {
  console.error(erros.map(x => `✗ ${x}`).join('\n'));
  process.exit(1);
}
console.log(`✓ i18n: en-US traduzido, metadados/JSON-LD válidos e ${br.length} IDs preservados.`);
