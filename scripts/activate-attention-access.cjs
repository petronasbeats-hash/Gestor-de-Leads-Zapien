'use strict';

// Run with the operator's already-authenticated Firebase CLI. No key files,
// exported Auth users, embedded UIDs, rule changes or legacy-data writes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {id} = require('../server/attention-store.cjs');

function administrator(rules) {
  const root = rules?.rules;
  if (!root || (root['.read'] !== undefined && root['.read'] !== false) || (root['.write'] !== undefined && root['.write'] !== false)) throw Error('RULES_REQUIRE_REVIEW');
  if (Object.keys(root).some(key => key.startsWith('$'))) throw Error('RULES_REQUIRE_REVIEW');
  for (const key of ['atencion_acl', 'atencion_v1', 'atencion_invites']) {
    const node = root[key];
    if (node !== undefined && (!node || typeof node !== 'object' || Object.entries(node).some(([field, value]) => !['.read', '.write'].includes(field) || value !== false))) throw Error('RULES_REQUIRE_REVIEW');
  }
  const expressions = [root.leads?.['.read'], root.leads?.['.write'], root.propiedades?.['.write']];
  const owners = expressions.map(expression => {
    if (typeof expression !== 'string') throw Error('ADMINISTRATOR_NOT_UNAMBIGUOUS');
    const match = expression.trim().match(/^auth\s*!=\s*null\s*&&\s*auth\.uid\s*={2,3}\s*(['"])([A-Za-z0-9_-]{1,128})\1$/);
    if (!match) throw Error('ADMINISTRATOR_NOT_UNAMBIGUOUS');
    return id(match[2]);
  });
  if (new Set(owners).size !== 1) throw Error('ADMINISTRATOR_NOT_UNAMBIGUOUS');
  return owners[0];
}

function prepare({rules, properties, existingAcl, organizationId, name}) {
  id(organizationId);
  if (typeof name !== 'string' || !name.trim() || name.length > 180) throw Error('INVALID_ORGANIZATION_NAME');
  if (existingAcl !== null) throw Error('EXISTING_ATTENTION_ACL_REQUIRES_REVIEW');
  const uid = administrator(rules);
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw Error('CATALOG_REQUIRED');
  const propertyIds = Object.fromEntries(Object.entries(properties)
    .filter(([, property]) => property && typeof property === 'object' && !Array.isArray(property) && property.activo !== false)
    .map(([propertyId]) => [id(propertyId), true]));
  if (!Object.keys(propertyIds).length) throw Error('PUBLISHED_CATALOG_REQUIRED');
  return {[organizationId]: {name: name.trim(), propertyIds, members: {[uid]: {enabled: true, role: 'agent'}}}};
}

function sameOrganization(actual, expected) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  return JSON.stringify(stable(actual)) === JSON.stringify(stable(expected));
}

function activate(options, io) {
  const {projectId, instanceId, organizationId, name, apply = false} = options;
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId) || instanceId !== projectId + '-default-rtdb') throw Error('INVALID_PROJECT_OR_INSTANCE');
  const patch = prepare({rules: io.read('/.settings/rules'), properties: io.read('/propiedades'),
    existingAcl: io.read('/atencion_acl'), organizationId, name});
  const expected = patch[organizationId];
  const receipt = {projectId, instanceId, organizationId, name: expected.name,
    properties: Object.keys(expected.propertyIds).length, agents: 1, role: 'agent', applied: false};
  if (!apply) return receipt;
  // Check immediately before this narrowly scoped PATCH. Other organizations are
  // never replaced. This CLI bootstrap is for the first, single-admin setup;
  // subsequent ACL management requires a separate authorized workflow.
  if (io.read('/atencion_acl') !== null) throw Error('EXISTING_ATTENTION_ACL_REQUIRES_REVIEW');
  io.update('/atencion_acl/orgs', patch);
  if (!sameOrganization(io.read('/atencion_acl/orgs/' + organizationId), expected)) throw Error('ACCESS_WRITE_REQUIRES_REVIEW');
  return {...receipt, applied: true};
}

function main(argv) {
  const options = {};
  const names = {'--project': 'projectId', '--instance': 'instanceId', '--organization': 'organizationId', '--name': 'name'};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply' && !options.apply) {options.apply = true; continue;}
    const key = names[argv[i]];
    if (!key || options[key] || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('INVALID_ARGUMENTS');
    options[key] = argv[++i];
  }
  if (!['projectId', 'instanceId', 'organizationId', 'name'].every(key => options[key])) throw Error('PROJECT_INSTANCE_ORGANIZATION_NAME_REQUIRED');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-attention-access-'));
  fs.chmodSync(directory, 0o700);
  const env = {...process.env};
  for (const key of ['FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB', 'FIREBASE_DEBUG_MODE']) delete env[key];
  const flags = ['--project', options.projectId, '--instance', options.instanceId];
  let sequence = 0;
  function cli(args) {
    try {execFileSync('firebase', args.concat(flags), {cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000});}
    catch {throw Error('FIREBASE_CLI_OPERATION_FAILED');}
  }
  try {
    const result = activate(options, {
      read(databasePath) {
        const file = path.join(directory, 'read-' + (++sequence) + '.json');
        cli(['database:get', databasePath, '--output', file]);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      },
      update(databasePath, patch) {
        const file = path.join(directory, 'access-patch.json');
        fs.writeFileSync(file, JSON.stringify(patch), {mode: 0o600});
        cli(['database:update', databasePath, file, '--force']);
      }
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
}
if (require.main === module) {try {main(process.argv.slice(2));} catch (error) {console.error(error.message); process.exitCode = 1;}}
module.exports = {administrator, prepare, activate};
