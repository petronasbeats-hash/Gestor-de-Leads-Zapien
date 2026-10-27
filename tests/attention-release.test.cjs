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
    assert.equal(JSON.parse(fs.readFileSync(path.join(result.output, 'release-manifest.json'))).capabilities.booking, false);
    assert.throws(() => build(options), /OUTPUT_ALREADY_EXISTS/);
  } finally {fs.rmSync(temp, {recursive: true, force: true});}
});
