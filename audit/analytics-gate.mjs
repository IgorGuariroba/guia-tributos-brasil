#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/index.template.html', 'utf8');
const artifact = readFileSync('public/index.html', 'utf8');
for (const html of [source, artifact]) {
  assert.match(html, /guia-tributos:buscas-sem-resultado/);
  assert.match(html, /localStorage\.setItem/);
  assert.doesNotMatch(html, /document\.cookie|navigator\.sendBeacon|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(html, /google-analytics|googletagmanager|plausible|hotjar/i);
}
assert.match(source, /sem cookies, identificadores ou conexão externa/);
console.log('Analytics: contador local agregado, sem cookies, identificadores ou terceiros.');
