'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {administrator, prepare, activate} = require('../scripts/activate-attention-access.cjs');
const expression = "auth != null && auth.uid == 'synthetic-owner'";
const rules = {rules: {leads: {'.read': expression, '.write': expression}, propiedades: {'.write': expression}}};
const properties = {'publication-1': {activo: true}, 'publication-2': {activo: false}, 'publication-3': {nombre: 'Legacy publication'}};
const options = {projectId: 'demo-synapse', instanceId: 'demo-synapse-default-rtdb', organizationId: 'org-demo', name: 'Demo'};
const input = {rules, properties, existingAcl: null, organizationId: options.organizationId, name: options.name};
test('Derives only the single existing administrator, excludes inactive publications', () => {
  const patch = prepare(input)['org-demo'];
  assert.deepEqual(patch.members, {'synthetic-owner': {enabled: true, role: 'agent'}});
  assert.deepEqual(patch.propertyIds, {'publication-1': true, 'publication-3': true});
  assert.equal(administrator(rules), 'synthetic-owner');
});
test('Refuses ambiguous owners, permissive expressions, inherited rules and invalid identifiers', () => {
  const changed = structuredClone(rules); changed.rules.propiedades['.write'] = "auth != null && auth.uid == 'another-owner'";
  assert.throws(() => administrator(changed), /UNAMBIGUOUS/);
  changed.rules.propiedades['.write'] = expression + ' || true';
  assert.throws(() => administrator(changed), /UNAMBIGUOUS/);
  assert.throws(() => administrator({rules: {...rules.rules, '.read': true}}), /REVIEW/);
  assert.throws(() => administrator({rules: {...rules.rules, atencion_acl: {'.read': true}}}), /REVIEW/);
  assert.throws(() => administrator({rules: {...rules.rules, '$any': {'.read': true}}}), /REVIEW/);
  assert.throws(() => prepare({...input, organizationId: '__proto__'}), /IDENTIFIER/);
});
test('Refuses any existing ACL and an empty published catalog', () => {
  assert.throws(() => prepare({...input, existingAcl: {orgs: {}}}), /EXISTING/);
  assert.throws(() => prepare({...input, properties: {}}), /CATALOG/);
});
function mock() {
  let stored = null; const writes = [];
  return {writes, read(databasePath) {
    if (databasePath === '/.settings/rules') return rules;
    if (databasePath === '/propiedades') return properties;
    if (databasePath === '/atencion_acl') return stored;
    if (databasePath === '/atencion_acl/orgs/org-demo') return stored?.orgs?.['org-demo'];
    throw Error('UNEXPECTED_READ');
  }, update(databasePath, patch) {writes.push({databasePath, patch}); stored = {orgs: patch};}};
}
test('Defaults to read-only preparation without any database writes or UID in receipt', () => {
  const io = mock(); const receipt = activate(options, io);
  assert.equal(receipt.applied, false); assert.equal(io.writes.length, 0);
  assert.equal(JSON.stringify(receipt).includes('synthetic-owner'), false);
});
test('Applies only one ACL patch, verifies read-back and refuses replay/changed project', () => {
  const io = mock(); const receipt = activate({...options, apply: true}, io);
  assert.equal(receipt.applied, true); assert.equal(io.writes.length, 1);
  assert.equal(io.writes[0].databasePath, '/atencion_acl/orgs');
  assert.throws(() => activate({...options, apply: true}, io), /EXISTING/);
  assert.throws(() => activate({...options, instanceId: 'other-instance'}, mock()), /INSTANCE/);
});
test('Detects changed ACL before write and a failed read-back', () => {
  const io = mock(); const read = io.read; let aclReads = 0;
  io.read = p => p === '/atencion_acl' && ++aclReads === 2 ? {orgs: {}} : read(p);
  assert.throws(() => activate({...options, apply: true}, io), /EXISTING/); assert.equal(io.writes.length, 0);
  const invalid = mock(); const original = invalid.read;
  invalid.read = p => p === '/atencion_acl/orgs/org-demo' ? null : original(p);
  assert.throws(() => activate({...options, apply: true}, invalid), /WRITE_REQUIRES_REVIEW/);
});
