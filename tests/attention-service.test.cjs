'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createAttentionStore} = require('../server/attention-store.cjs');
const {createAttentionService} = require('../server/attention-service.cjs');
const {createFirebaseAuthority} = require('../server/attention-firebase-authority.cjs');
const {createAttentionHttp} = require('../server/attention-http.cjs');
const leaseConfig = require('../lab/attention/fixtures/lease-config.json');
const {Readable} = require('node:stream');

function memoryDb() {
  const data = new Map(), queues = new Map();
  let fail = false;
  const snapshot = value => ({val: () => structuredClone(value ?? null)});
  return {data, failNext() {fail = true;}, ref(path) {
    return {
      async get() { return snapshot(data.get(path)); },
      async set(value) { data.set(path, structuredClone(value)); },
      transaction(update) {
        const run = async () => {
          // Model the SDK's initial null callback before receiving remote state.
          let candidate = update(null);
          if (data.has(path)) candidate = update(structuredClone(data.get(path)));
          if (candidate === undefined) return {committed: false, snapshot: snapshot(data.get(path))};
          if (fail) {fail = false; throw Error('DATABASE_OFFLINE');}
          data.set(path, structuredClone(candidate));
          return {committed: true, snapshot: snapshot(candidate)};
        };
        const promise = (queues.get(path) || Promise.resolve()).then(run);
        queues.set(path, promise.catch(() => {}));
        return promise;
      }
    };
  }};
}
function fixture() {
  const db = memoryDb(), store = createAttentionStore(db);
  let timestamp = new Date('2026-10-27T03:30:00Z'), reads = 0, tokens = 0;
  const snapshot = {observedAt: timestamp.toISOString(), properties: {
    yin: {nombre: 'Studio ejemplo', activo: true, precio: 2800, propertyGroupId: 'adn-suites-studios', unitType: 'STUDIO', direccion: 'Domicilio privado'},
    norte: {nombre: 'Departamento ejemplo', activo: true, precio: 2500},
    hidden: {nombre: 'Inactivo', activo: false, precio: 1}
  }};
  const service = createAttentionService({store, leaseConfig, now: () => new Date(timestamp), invitationBaseUrl: 'https://example.test',
    randomToken: () => Buffer.alloc(32, ++tokens).toString('base64url'),
    readAvailability: async () => {reads++; return structuredClone(snapshot);}});
  const principal = {uid: 'agent-1', organizationId: 'org-A', role: 'agent', propertyIds: ['yin', 'norte', 'hidden']};
  const input = {requestId: 'capture-00000001', displayName: 'Cliente de prueba', surname: '', phone: '2381234567', source: 'marketplace_facebook', entryChannel: 'messenger', propertyId: 'yin', question: '¿Sigue disponible?'};
  return {db, store, service, principal, input, reads: () => reads, advance: ms => {timestamp = new Date(+timestamp + ms);}};
}
test('captura y bitácora se guardan juntas; reintentos no duplican ni cambian la fuente', async () => {
  const f = fixture();
  await f.service.capture(f.principal, f.input);
  const retry = await f.service.capture(f.principal, {...f.input});
  assert.equal(retry.replayed, true);
  const state = await f.store.read('org-A');
  assert.equal(Object.keys(state.conversations).length, 1);
  assert.equal(Object.keys(state.journal).length, 1);
  assert.equal(state.journal[f.input.requestId].actorRole, 'agent');
  assert.equal(f.reads(), 2);
  await assert.rejects(f.service.capture(f.principal, {...f.input, source: 'whatsapp'}), /COMMAND_ID_CONFLICT/);
  f.db.failNext();
  await assert.rejects(f.service.capture(f.principal, {...f.input, requestId: 'capture-00000002'}), /DATABASE_OFFLINE/);
  assert.equal((await f.store.read('org-A')).conversations['capture-00000002'], undefined);
  assert.equal((await f.store.read('org-A')).journal['capture-00000002'], undefined);
});
test('captura permite nombre/teléfono pendientes pero rechaza acceso de otra organización y propiedades fuera de alcance', async () => {
  const f = fixture();
  await f.service.capture(f.principal, {...f.input, displayName: '', phone: ''});
  await assert.rejects(f.service.inspect({...f.principal, organizationId: 'org-B'}, f.input.requestId), /CONVERSATION_NOT_FOUND/);
  await assert.rejects(f.service.capture({...f.principal, propertyIds: ['norte']}, f.input), /PROPERTY_FORBIDDEN/);
  await assert.rejects(f.service.capture(f.principal, {...f.input, propertyId: 'hidden'}), /PROPERTY_NOT_PUBLISHED/);
  await assert.rejects(f.service.capture({...f.principal, role: 'customer'}, f.input), /AGENT_REQUIRED/);
  await assert.rejects(f.service.capture(f.principal, {...f.input, authority: f.principal}), /INVALID_FIELDS/);
  await assert.rejects(f.service.capture(f.principal, {...f.input, requestId: '__proto__'}), /INVALID_IDENTIFIER/);
});
test('cambios simultáneos tienen un ganador y conservan inmueble/fuente de origen', async () => {
  const f = fixture(); await f.service.capture(f.principal, f.input);
  const results = await Promise.allSettled(['interest-1', 'interest-2'].map(requestId => f.service.changeInterest(f.principal, {requestId, conversationId: f.input.requestId, propertyId: 'norte', expectedVersion: 1})));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /VERSION_CONFLICT/);
  const current = (await f.service.inspect(f.principal, f.input.requestId)).conversation;
  assert.equal(current.context.currentPropertyId, 'norte');
  assert.equal(current.context.originalPropertyId, 'yin');
  assert.equal(current.context.source, 'marketplace_facebook');
  assert.equal(current.context.entryChannel, 'messenger');
  assert.equal(current.context.currentChannel, 'synapse_attention');
});
test('enlace muestra ficha pública, exige verificar titularidad y no contiene datos personales', async () => {
  const f = fixture(); await f.service.capture(f.principal, f.input);
  const invitation = await f.service.invite(f.principal, {requestId: 'invite-1', conversationId: f.input.requestId, expectedVersion: 1});
  const token = new URL(invitation.url).hash.slice(1);
  assert.equal(new URL(invitation.url).search, '');
  const preview = await f.service.previewInvitation(token);
  const serialized = JSON.stringify(preview);
  for (const privateValue of ['2381234567', 'Cliente de prueba', 'Domicilio privado', 'journal', 'tokenHash', 'agent-1']) assert.equal(serialized.includes(privateValue), false);
  assert.equal(JSON.stringify(await f.store.read('org-A')).includes(token), false);
  assert.equal(preview.sheet.requirements, undefined);
  assert.equal(preview.sheet.deposit, undefined);
  assert.equal((await f.service.report(f.principal, '2026-10-26')).pending.length, 1);
  await assert.rejects(f.service.claim({uid: 'customer-1', role: 'customer'}, {requestId: 'claim-1', token}), /CUSTOMER_VERIFICATION_REQUIRED/);
  await assert.rejects(f.service.claim({uid: 'customer-1', role: 'customer', verifiedPhone: '+522381234568'}, {requestId: 'claim-1', token}), /CUSTOMER_VERIFICATION_REQUIRED/);
  const customer = {uid: 'customer-1', role: 'customer', verifiedPhone: '+522381234567'};
  const claim = await f.service.claim(customer, {requestId: 'claim-1', token});
  const view = await f.service.customerView(customer, token);
  assert.equal(view.conversationId, claim.conversationId);
  assert.equal(view.journal, undefined);
  await assert.rejects(f.service.customerView({...customer, uid: 'customer-2'}, token), /CUSTOMER_VERIFICATION_REQUIRED/);
  await f.service.sendMessage(customer, {requestId: 'message-customer-1', token, conversationId: claim.conversationId, text: 'Me interesa.'});
  await f.service.sendMessage(f.principal, {requestId: 'message-agent-1', conversationId: claim.conversationId, text: 'Te comparto los requisitos.'});
  assert.equal((await f.service.customerView(customer, token)).messages.length, 2);
  assert.equal((await f.service.inspect(f.principal, claim.conversationId)).journal.filter(e => e.kind === 'message_recorded').length, 2);
});
test('enlaces rotados, revocados o vencidos no permiten recuperar conversación', async () => {
  const f = fixture(); await f.service.capture(f.principal, f.input);
  const invite = requestId => f.service.invite(f.principal, {requestId, conversationId: f.input.requestId, expectedVersion: requestId === 'i1' ? 1 : 2});
  const first = await invite('i1'), second = await invite('i2');
  await assert.rejects(f.service.previewInvitation(new URL(first.url).hash.slice(1)), /INVITATION_INVALID/);
  await f.service.revoke(f.principal, {requestId: 'revoke-1', conversationId: f.input.requestId, expectedVersion: 3});
  await assert.rejects(f.service.previewInvitation(new URL(second.url).hash.slice(1)), /INVITATION_INVALID/);
  const third = await f.service.invite(f.principal, {requestId: 'i3', conversationId: f.input.requestId, expectedVersion: 4});
  f.advance(86400001);
  await assert.rejects(f.service.previewInvitation(new URL(third.url).hash.slice(1)), /INVITATION_INVALID/);
});
test('compartir requisitos respeta unidad y no hereda ADN tras cambiar interés', async () => {
  const f = fixture(); await f.service.capture(f.principal, f.input);
  const invitation = await f.service.invite(f.principal, {requestId: 'i1', conversationId: f.input.requestId, expectedVersion: 1});
  const token = new URL(invitation.url).hash.slice(1), customer = {uid: 'customer-1', role: 'customer', verifiedPhone: '+522381234567'};
  await f.service.claim(customer, {requestId: 'claim-1', token});
  assert.equal((await f.service.customerView(customer, token)).conditions, null);
  await f.service.shareConditions(f.principal, {requestId: 'conditions-1', conversationId: f.input.requestId, expectedVersion: 3});
  assert.equal((await f.service.customerView(customer, token)).conditions.deposit, 2800);
  await f.service.changeInterest(f.principal, {requestId: 'interest-1', conversationId: f.input.requestId, propertyId: 'norte', expectedVersion: 4});
  assert.equal((await f.service.customerView(customer, token)).conditions, null);
  await assert.rejects(f.service.shareConditions(f.principal, {requestId: 'conditions-2', conversationId: f.input.requestId, expectedVersion: 5}), /CONDITIONS_NOT_CONFIGURED/);
});
test('resumen importado con fecha desconocida conserva ese hecho; reporte privado por organización', async () => {
  const f = fixture(); await f.service.capture(f.principal, f.input);
  await f.service.summarize(f.principal, {requestId: 'summary-1', conversationId: f.input.requestId, summary: 'Conversación importada sin fecha', nextAction: {description: 'Resolver pregunta de servicios', status: 'pending'}});
  const entry = (await f.service.inspect(f.principal, f.input.requestId)).journal.find(e => e.id === 'summary-1');
  assert.equal(entry.occurredAt, null); assert.equal(entry.dateBasis, 'recorded');
  const report = await f.service.report(f.principal, '2026-10-26');
  assert.equal(report.pending.length, 1); assert.equal(report.reservations.length, 0);
  assert.equal((await f.service.report({...f.principal, organizationId: 'org-B'}, '2026-10-26')).summaries, 0);
});
test('autoridad valida token revocado y obtiene organización/unidades del servidor', async () => {
  const db = memoryDb();
  db.data.set('atencion_acl/orgs/org-A', {members: {'agent-1': {enabled: true, role: 'agent', propertyIds: {yin: true}}}, propertyIds: {yin: true, norte: true}});
  const seen = [];
  const authority = createFirebaseAuthority({db, auth: {async verifyIdToken(token, checkRevoked) {seen.push({token, checkRevoked}); if (token !== 'valid') throw Error('revoked'); return {uid: 'agent-1'};}}});
  assert.deepEqual((await authority.agent('Bearer valid', 'org-A')).propertyIds, ['yin']);
  assert.equal(seen[0].checkRevoked, true);
  await assert.rejects(authority.agent('Bearer valid', 'org-B'), /ORGANIZATION_FORBIDDEN/);
  await assert.rejects(authority.agent('Bearer expired', 'org-A'), /AUTHENTICATION_REQUIRED/);
});
test('lector real en español conecta con el servicio; cambiar teléfono revoca acceso anterior', async () => {
  const f = fixture();
  await f.service.capture(f.principal, f.input);
  const invitation = await f.service.invite(f.principal, {requestId: 'invite-1', conversationId: f.input.requestId, expectedVersion: 1});
  const token = new URL(invitation.url).hash.slice(1), customer = {uid: 'customer-1', role: 'customer', verifiedPhone: '+522381234567'};
  await f.service.claim(customer, {requestId: 'claim-1', token});
  await f.service.updateContact(f.principal, {requestId: 'contact-1', conversationId: f.input.requestId, expectedVersion: 3, displayName: 'Cliente de prueba', surname: '', phone: '2381234568'});
  await assert.rejects(f.service.customerView(customer, token), /INVITATION_INVALID/);
  const {createLiveAvailabilityReader} = require('../server/live-availability-reader.cjs');
  const readAvailability = createLiveAvailabilityReader({readValue: async p => p === 'propiedades' ? {yin: {activo: true, nombre: 'Test', precio: 2800}} : p === 'disponibilidad/horarios' ? {lun: {activo: true}} : null});
  const realService = createAttentionService({store: f.store, readAvailability, invitationBaseUrl: 'https://example.test'});
  assert.equal((await realService.catalog(f.principal)).properties[0].propertyId, 'yin');
});
test('HTTP limita cuerpo, no filtra errores internos y nunca anuncia reservas habilitadas', async () => {
  const handler = createAttentionHttp({service: {}, authority: {async session() {throw Error('secret details');}}});
  async function request(method, url, raw = '', type = 'application/json') {
    const req = Readable.from([Buffer.from(raw)]); req.method = method; req.url = url; req.headers = {'content-type': type};
    const res = {headers: {}, setHeader(k, v) {this.headers[k] = v;}, end(body) {this.body = JSON.parse(body);}};
    await handler(req, res); return res;
  }
  assert.equal((await request('GET', '/attention-api/health')).body.booking, false);
  assert.equal((await request('GET', '/agent/session')).statusCode, 401);
  assert.equal((await request('POST', '/anything', '{')).statusCode, 400);
  assert.equal((await request('POST', '/anything', 'x'.repeat(16385))).statusCode, 413);
  assert.equal((await request('POST', '/anything', '{}', 'text/plain')).statusCode, 415);
  assert.equal((await request('POST', '/anything', '{}')).statusCode, 404);
});
module.exports = {memoryDb};
