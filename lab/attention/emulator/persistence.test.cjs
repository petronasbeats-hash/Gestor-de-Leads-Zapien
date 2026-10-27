'use strict';
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const path = require('node:path');
const {randomUUID, randomBytes} = require('node:crypto');
const dependency = createRequire(path.resolve(__dirname, '../../../attention-functions/package.json'));
const {initializeApp, deleteApp} = dependency('firebase-admin/app');
const {getDatabase} = dependency('firebase-admin/database');
const {createAttentionStore} = require('../../../server/attention-store.cjs');
const {createAttentionService} = require('../../../server/attention-service.cjs');

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:19020' || process.env.GCLOUD_PROJECT !== 'demo-synapse-attention') throw Error('ISOLATED_EMULATOR_REQUIRED');
// The SDK forwards local ws:// connections through HTTP_PROXY without honoring
// NO_PROXY. Respect the host's explicit loopback exemption in this isolated
// demo-only test process; HTTPS/external proxy settings remain untouched.
if ((process.env.NO_PROXY || process.env.no_proxy || '').split(',').includes('127.0.0.1')) {
  delete process.env.HTTP_PROXY;
  delete process.env.http_proxy;
}
async function main() {
  const probe = await fetch('http://127.0.0.1:19020/.json?ns=demo-synapse-attention-default-rtdb');
  assert.equal(probe.status, 401);
  console.log('RTDB emulator reachable; direct reads denied');
  const app = initializeApp({projectId: 'demo-synapse-attention', databaseURL: 'https://demo-synapse-attention-default-rtdb.firebaseio.com'});
  try {
    const db = getDatabase(app), store = createAttentionStore(db);
    const organizationId = 'org-' + randomUUID();
    const principal = {uid: 'agent-test', role: 'agent', organizationId, propertyIds: ['property-a', 'property-b']};
    const service = createAttentionService({store, invitationBaseUrl: 'https://example.test', readAvailability: async () => ({observedAt: new Date().toISOString(), propiedades: {'property-a': {activo: true, nombre: 'Test A', precio: 2800}, 'property-b': {activo: true, nombre: 'Test B', precio: 2500}}})});
    const input = {requestId: randomUUID(), displayName: 'Emulator test only', source: 'marketplace_facebook', entryChannel: 'messenger', propertyId: 'property-a'};
    const initial = await service.capture(principal, input);
    assert.equal(initial.status, 'captured');
    const state = await store.read(organizationId);
    assert.equal(Object.keys(state.conversations).length, 1);
    assert.equal(Object.keys(state.journal).length, 1);
    console.log('PASS E1: captura y journal persistidos en RTDB emulado');
    await Promise.all(Array.from({length: 8}, () => service.capture(principal, input)));
    assert.equal(Object.keys((await store.read(organizationId)).journal).length, 1);
    console.log('PASS E2: ocho reintentos conservan una captura y un evento');
    const race = await Promise.allSettled(['a', 'b'].map(suffix => service.changeInterest(principal, {requestId: randomUUID() + suffix, conversationId: input.requestId, propertyId: 'property-b', expectedVersion: 1})));
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(race.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await store.read(organizationId)).conversations[input.requestId].version, 2);
    console.log('PASS E3: cambios concurrentes con una sola versión ganadora');
    await assert.rejects(service.inspect({...principal, organizationId: 'other-org'}, input.requestId), /CONVERSATION_NOT_FOUND/);
    console.log('PASS E4: otra organización no recupera la atención');
    const response = await fetch('http://127.0.0.1:19020/atencion_v1/orgs/' + organizationId + '.json?ns=demo-synapse-attention-default-rtdb');
    assert.equal(response.status, 401);
    const directWrite = await fetch('http://127.0.0.1:19020/atencion_v1/orgs/' + organizationId + '/journal/forged.json?ns=demo-synapse-attention-default-rtdb', {method: 'PUT', body: JSON.stringify({summary: 'forged'})});
    assert.equal(directWrite.status, 401);
    console.log('PASS E5: lectura y escritura directas sin autorización denegadas');
    const invitation = await service.invite(principal, {requestId: randomUUID(), conversationId: input.requestId, expectedVersion: 2});
    const token = new URL(invitation.url).hash.slice(1), secret = randomBytes(32).toString('base64url');
    const opened = await service.openGuest({requestId: randomUUID(), token, secret});
    await service.guestMessage({requestId: randomUUID(), token, secret, text: 'Guest emulator message'});
    await service.sendMessage(principal, {requestId: randomUUID(), conversationId: input.requestId, threadId: opened.threadId, text: 'Advisor emulator reply'});
    assert.equal((await service.guestView({token, secret})).messages.length, 2);
    assert.equal(JSON.stringify(await store.read(organizationId)).includes(secret), false);
    console.log('PASS E6: invitado sin teléfono, mensaje y respuesta persistidos sin guardar secreto plano');
    await assert.rejects(service.openGuest({requestId: randomUUID(), token, secret: randomBytes(32).toString('base64url')}), /GUEST_LINK_IN_USE/);
    await assert.rejects(service.guestView({token, secret: randomBytes(32).toString('base64url')}), /GUEST_ACCESS_REQUIRED/);
    console.log('PASS E7: otro navegador no reclama ni recupera la sesión del invitado');
    const latest = (await service.inspect(principal, input.requestId)).conversation;
    await service.revoke(principal, {requestId: randomUUID(), conversationId: input.requestId, expectedVersion: latest.version});
    await assert.rejects(service.guestView({token, secret}), /INVITATION_INVALID/);
    console.log('PASS E8: revocación invalida el acceso de invitado');
  } finally { await deleteApp(app); }
}
const deadline = setTimeout(() => {console.error('EMULATOR_TEST_DEADLINE'); process.exit(1);}, 45000);
main().catch(error => {console.error(error.message); process.exitCode = 1;}).finally(() => clearTimeout(deadline));
