'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {build} = require('../scripts/build-attention-release.cjs');
test('release exige sitio explícito y dependencias existentes; no reemplaza salidas anteriores', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-release-test-'));
  try {
    const legacy = path.join(temp, 'legacy'); fs.mkdirSync(legacy);
    const options = {'--site': 'synapse-core', '--legacy-root': legacy, '--out': path.join(temp, 'output')};
    assert.throws(() => build({...options, '--site': ''}), /INVALID_SITE/);
    assert.throws(() => build(options), /LEGACY_DEPENDENCY_MISSING/);
    assert.equal(fs.existsSync(options['--out']), false);
    fs.mkdirSync(path.join(legacy, 'assets/js'), {recursive: true});
    fs.writeFileSync(path.join(legacy, '404.html'), '<p>Fixture 404</p>');
    fs.writeFileSync(path.join(legacy, 'leia.html'), '<p>Fixture legacy page</p>');
    fs.writeFileSync(path.join(legacy, 'assets/js/reprogramar-ui.v1.js'), '// Test fixture; never a production dependency.');
    fs.writeFileSync(path.join(legacy, 'assets/firebase-debug.log'), 'must not publish');
    const result = build(options);
    assert.equal(result.site, 'synapse-core');
    const config = JSON.parse(fs.readFileSync(path.join(result.output, 'firebase.json')));
    assert.equal(config.database, undefined);
    assert.equal(config.hosting.public, 'public');
    assert.equal(config.hosting.site, 'synapse-core');
    assert.equal(fs.existsSync(path.join(result.output, 'public/core-contracts')), false);
    assert.equal(fs.existsSync(path.join(result.output, 'public/assets/firebase-debug.log')), false);
    assert.equal(fs.existsSync(path.join(result.output, 'functions/server/attention-service.cjs')), true);
    assert.equal(fs.existsSync(path.join(result.output, 'public/atencion-operador.html')), true);
    assert.equal(fs.existsSync(path.join(result.output, 'public/shared/attention-alerts.js')), true);
    assert.equal(fs.existsSync(path.join(result.output, 'functions/shared/attention-alerts.js')), true);
    assert.deepEqual(fs.readFileSync(path.join(result.output, 'public/assets/audio/synapse-nexo-v1.wav')),fs.readFileSync(path.join(__dirname,'../assets/audio/synapse-nexo-v1.wav')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(result.output, 'release-manifest.json'))).capabilities.booking, false);
    assert.match(fs.readFileSync(path.join(result.output, 'functions/.env.gestor-leads-zapien'), 'utf8'), /ATTENTION_PUBLIC_ORIGIN=https:\/\/synapse-core.web.app\n/);
    assert.throws(() => build(options), /OUTPUT_ALREADY_EXISTS/);
    for (const attentionOrigin of ['http://synapse-core.web.app', 'https://other.web.app', 'https://synapse-core--preview.web.app.evil.example', 'https://synapse-core--preview.web.app/path', 'https://user@synapse-core.web.app', 'https://synapse-core.web.app:8443', 'https://synapse-core.web.app?next=other']) {
      assert.throws(() => build({...options, '--out': path.join(temp, 'invalid'), '--attention-origin': attentionOrigin}), /INVALID_ATTENTION_ORIGIN/);
      assert.equal(fs.existsSync(path.join(temp, 'invalid')), false);
    }
    const attentionOrigin = 'https://synapse-core--atencion-validacion-example.web.app';
    const preview = build({...options, '--out': path.join(temp, 'preview'), '--attention-origin': attentionOrigin});
    assert.equal(preview.attentionOrigin, attentionOrigin);
    const manifest = JSON.parse(fs.readFileSync(path.join(preview.output, 'release-manifest.json')));
    assert.equal(manifest.attentionOrigin, attentionOrigin);
    assert.equal(manifest.reservationOrigin, 'https://synapse-core.web.app');
    const publicConfig = fs.readFileSync(path.join(preview.output, 'public/web/attention/config.js'), 'utf8');
    assert.match(publicConfig, /"reservationOrigin":"https:\/\/synapse-core.web.app"/);
    assert.ok(fs.readFileSync(path.join(preview.output, 'functions/.env.gestor-leads-zapien'), 'utf8').includes('ATTENTION_PUBLIC_ORIGIN=' + attentionOrigin + '\n'));
  } finally {fs.rmSync(temp, {recursive: true, force: true});}
});
