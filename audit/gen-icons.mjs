#!/usr/bin/env node
/**
 * Gera CSS de ícones a partir do lucide-static.
 *
 * Estratégia: cada ícone vira um data-URI em `mask-image` sobre um pseudo-elemento
 * `::before`. Vantagens sobre <svg> inline ou <img>:
 *   - ZERO nós adicionados ao DOM (pseudo-elementos não contam) — essencial porque
 *     a página fica próxima do limite de 1200 nós permitido pelo gate.
 *   - ZERO requisições de rede (data-URI embutido no <style>).
 *   - A cor vem de `background-color`, então o ícone herda o contraste já validado.
 *   - Ícones são puramente decorativos: não entram na árvore de acessibilidade,
 *     logo não poluem leitores de tela nem duplicam o texto que acompanham.
 *
 * Uso: node audit/gen-icons.mjs > /tmp/icons.css
 */
import { readFileSync } from 'node:fs';

// Mapeamento semântico: conceito do domínio → ícone do Lucide.
const ICONES = {
  // Tipos / natureza
  imposto: 'landmark',
  taxa: 'stamp',
  contribuicao: 'users',
  'contribuicao-terceiros': 'graduation-cap',
  compensacao: 'scale',
  regime: 'settings-2',
  documento: 'receipt',
  fundo: 'piggy-bank',
  'encargo-trabalhista': 'briefcase',
  fator: 'calculator',
  ferramenta: 'wrench',
  mecanismo: 'repeat',

  // Situações cotidianas que podem gerar impostos
  veiculo: 'car-front',
  imovel: 'house',
  renda: 'banknote',
  heranca: 'gift',
  loja: 'store',
  servico: 'wrench',
  folha: 'hand-coins',
  consumo: 'shopping-cart',
  industria: 'factory',
  empresa: 'briefcase-business',

  // Esferas
  federal: 'flag',
  estadual: 'map',
  municipal: 'building-2',
  compartilhado: 'network',

  // Status
  vigente: 'circle-check',
  transicao: 'arrow-right-left',
  implementacao: 'rocket',
  'nao-instituido': 'circle-off',
  varia: 'map-pin',
  historico: 'history',

  // Interface
  busca: 'search',
  limpar: 'eraser',
  csv: 'download',
  aviso: 'triangle-alert',
  info: 'info',
  lista: 'list',
  ordenar: 'chevrons-up-down',
  'ordenar-asc': 'arrow-up',
  'ordenar-desc': 'arrow-down',
  vazio: 'search-x',
  atalho: 'skip-forward',
  atualizacao: 'calendar-clock',
  reforma: 'scroll-text',
  fonte: 'book-open',
  contador: 'hash',
};

const limpar = svg =>
  svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*class="[^"]*"/g, '')
    // Em mask-image a cor é irrelevante (só o alfa importa) e width/height são
    // definidos pelo CSS. Remover reduz ~35% do peso de cada data-URI.
    .replace(/\s*(width|height)="24"/g, '')
    // Em mask-image apenas o canal alfa importa; usamos 'black' literal para evitar
    // duplo-encode de '#' (%23 -> %2523) ao passar pelo encodeURIComponent.
    .replace(/\s*stroke="currentColor"/g, ' stroke="black"')
    .replace(/\s*xmlns="[^"]*"/, ' xmlns="http://www.w3.org/2000/svg"')
    .replace(/\n\s*/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\/>/g, '/>')
    .trim();

const paraDataUri = svg => {
  // encodeURIComponent é mais seguro que base64 aqui e costuma ficar menor para SVG.
  const compacto = limpar(svg);
  return `data:image/svg+xml,${encodeURIComponent(compacto)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')}`;
};

const linhas = [];
linhas.push('/* Ícones: Lucide v1.31.0 (ISC) — embutidos como mask-image em ::before.');
linhas.push('   Zero nós no DOM, zero requisições, cor herdada via background-color.');
linhas.push('   Gerado por audit/gen-icons.mjs — não edite à mão. */');

for (const [chave, nome] of Object.entries(ICONES)) {
  const caminho = `node_modules/lucide-static/icons/${nome}.svg`;
  let svg;
  try {
    svg = readFileSync(caminho, 'utf8');
  } catch {
    console.error(`✗ ícone ausente no lucide-static: ${nome} (chave "${chave}")`);
    process.exit(1);
  }
  linhas.push(`[data-icone="${chave}"]::before{--icone:url("${paraDataUri(svg)}")}`);
}

console.log(linhas.join('\n'));
console.error(`✓ ${Object.keys(ICONES).length} ícones gerados`);
