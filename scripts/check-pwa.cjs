#!/usr/bin/env node
// Synapse PWA static gate. Run: node scripts/check-pwa.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
const admin = read('index.html');
const publicPage = read('reservar.html');
const sw = read('sw.js');
assert.equal(manifest.name, 'Synapse Core');
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.start_url.startsWith('/'));
assert.ok(manifest.scope.startsWith('/'));
assert.ok(manifest.icons.every(icon => icon.src.startsWith('/')), 'Icons must be absolute local paths');
for (const icon of manifest.icons) {
  assert.ok(fs.existsSync(icon.src.slice(1)), 'Missing icon file: ' + icon.src);
}
assert.ok(fs.existsSync('sw.js'), 'Missing service worker');
assert.ok(admin.includes('href="/manifest.webmanifest"'));
assert.ok(admin.includes("serviceWorker.register('/sw.js'"));
assert.ok(!publicPage.includes('href="/manifest.webmanifest"'), 'Public booking must not register administrative PWA');
assert.ok(!publicPage.includes("serviceWorker.register('/sw.js'"), 'Public booking must not register admin SW');
assert.ok(!publicPage.includes('rel="manifest"'), 'Public booking must not link admin manifest');
assert.ok(!/caches\.open\s*\(|cache\.put\s*\(|addAll\s*\(/.test(sw), 'Private data must not be cached');
assert.ok(!/addEventListener\s*\(\s*['"]fetch['"]/.test(sw), 'SW must not intercept Firebase/API traffic');
assert.ok(manifest.icons.length > 0);
console.log('PASS: PWA static checks');
const release = process.argv.includes('--release');
if (release) {
  assert.notEqual(manifest.scope, '/', 'RELEASE BLOCKED: admin scope includes public booking');
  assert.ok(manifest.icons.some(x => x.type === 'image/png' && x.sizes === '192x192'), 'RELEASE BLOCKED: PNG 192 missing');
  assert.ok(manifest.icons.some(x => x.type === 'image/png' && x.sizes === '512x512'), 'RELEASE BLOCKED: PNG 512 missing');
  console.log('PASS: PWA release prerequisites');
}
if (manifest.scope === '/') console.warn('BLOCKER: manifest scope includes /reservar; isolate admin route/origin before public launch.');
if (!manifest.icons.some(x => x.type === 'image/png' && x.sizes === '192x192')) console.warn('BLOCKER: missing PNG 192 icon for broad device support.');
if (!manifest.icons.some(x => x.type === 'image/png' && x.sizes === '512x512')) console.warn('BLOCKER: missing PNG 512 icon for broad device support.');
