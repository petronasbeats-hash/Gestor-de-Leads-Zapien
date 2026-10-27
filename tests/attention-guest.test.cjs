'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomBytes, webcrypto} = require('node:crypto');
const {Readable} = require('node:stream');
const fs = require('node:fs');
const vm = require('node:vm');
const {memoryDb} = require('./helpers/attention-memory-db.cjs');
const {createAttentionStore} = require('../server/attention-store.cjs');
const {createAttentionService} = require('../server/attention-service.cjs');
const {createAttentionHttp} = require('../server/attention-http.cjs');
const leaseConfig = require('../lab/attention/fixtures/lease-config.json');
const secret = () => randomBytes(32).toString('base64url');
async function fixture() {
  const db = memoryDb(), store = createAttentionStore(db);
  let time = new Date('2026-10-27T18:30:00Z');
  const principal = {uid: 'advisor-demo', role: 'agent', organizationId: 'org-demo', propertyIds: ['yin', 'norte']};
  const properties = {yin: {nombre: 'Studio', activo: true, precio: 2800, unitType: 'STUDIO', propertyGroupId: 'adn-suites-studios', direccion: 'Private address'}, norte: {nombre: 'Other unit', activo: true, precio: 2500}};
  const service = createAttentionService({store, leaseConfig, invitationBaseUrl: 'https://example.test', now: () => new Date(time), readAvailability: async () => ({observedAt: time.toISOString(), properties})});
  const conversationId = 'attention-demo';
  await service.capture(principal, {requestId: conversationId, displayName: 'Private name', phone: '', propertyId: 'yin', source: 'marketplace_facebook', entryChannel: 'messenger'});
  await service.sendMessage(principal, {requestId: 'legacy-message', conversationId, text: 'Protected previous message'});
  const invite = async requestId => {
    const current = (await service.inspect(principal, conversationId)).conversation;
    const result = await service.invite(principal, {requestId, conversationId, expectedVersion: current.version});
    return new URL(result.url).hash.slice(1);
  };
  const token = await invite('invitation-demo'), browserSecret = secret();
  return {db, store, service, principal, conversationId, token, browserSecret, invite,
    open: (requestId = 'guest-open') => service.openGuest({requestId, token, secret: browserSecret}),
    view: () => service.guestView({token, secret: browserSecret}), advance: ms => {time = new Date(+time + ms);}};
}
test('guest opens without phone/Auth and receives no protected history, identity or journal', async () => {
  const f = await fixture();
  const preview = await f.service.previewInvitation(f.token);
  assert.equal(preview.accessMode, 'hype_business_guest'); assert.equal(preview.verificationRequired, false);
  await f.open(); const view = await f.view();
  assert.equal(view.identityStatus, 'unverified'); assert.deepEqual(view.messages, []);
  for (const privateValue of ['Private name', 'Private address', 'Protected previous message', 'journal', f.browserSecret, f.token, 'secretHash', 'advisor-demo']) assert.equal(JSON.stringify(view).includes(privateValue), false);
  const state = await f.store.read('org-demo');
  assert.equal(JSON.stringify(state).includes(f.browserSecret), false); assert.equal(JSON.stringify(state).includes(f.token), false);
  assert.equal(state.conversations[f.conversationId].context.identityStatus, 'unverified');
  assert.equal(state.conversations[f.conversationId].customerUid, undefined);
  assert.equal(state.conversations[f.conversationId].context.source, 'marketplace_facebook');
  assert.equal(state.conversations[f.conversationId].context.entryChannel, 'messenger');
});
test('guest messages and advisor replies use only the explicit thread; retries are atomic', async () => {
  const f = await fixture(), opened = await f.open();
  const input = {requestId: 'guest-message', token: f.token, secret: f.browserSecret, text: 'No tengo teléfono. Me interesa.'};
  await Promise.all(Array.from({length: 8}, () => f.service.guestMessage(input)));
  await f.service.sendMessage(f.principal, {requestId: 'reply', conversationId: f.conversationId, threadId: opened.threadId, text: 'Puedes continuar aquí.'});
  assert.deepEqual((await f.view()).messages.map(m => m.text), [input.text, 'Puedes continuar aquí.']);
  assert.equal((await f.service.inspect(f.principal, f.conversationId)).journal.filter(e => e.kind === 'message_recorded' && e.actorRole === 'guest').length, 1);
  await assert.rejects(f.service.guestMessage({...input, text: 'Changed retry'}), /COMMAND_ID_CONFLICT/);
  f.db.failNext();
  await assert.rejects(f.service.guestMessage({...input, requestId: 'failed-message'}), /DATABASE_OFFLINE/);
  const state = await f.store.read('org-demo');
  assert.equal(state.messages[f.conversationId]['failed-message'], undefined); assert.equal(state.journal['failed-message'], undefined);
});
test('one browser wins first-open race and repeated opens do not duplicate journal entries', async () => {
  const f = await fixture();
  const results = await Promise.allSettled(Array.from({length: 5}, (_, i) => f.service.openGuest({requestId: 'race-' + i, token: f.token, secret: secret()})));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(results.filter(r => r.status === 'rejected').every(r => /GUEST_LINK_IN_USE/.test(r.reason.message)));
  const second = await fixture();
  await second.open(); await second.open(); await second.open('open-again');
  const state = await second.store.read('org-demo');
  assert.equal(Object.values(state.journal).filter(e => e.kind === 'guest_connected').length, 1);
});
test('wrong secrets, old-mode invitations and forged identity/org/threads are rejected', async () => {
  const f = await fixture(); await f.open();
  await assert.rejects(f.service.guestView({token: f.token, secret: secret()}), /GUEST_ACCESS_REQUIRED/);
  await assert.rejects(f.service.guestMessage({requestId: 'forged', token: f.token, secret: secret(), text: 'x'}), /GUEST_ACCESS_REQUIRED/);
  await assert.rejects(f.service.guestView({token: f.token, secret: f.browserSecret, organizationId: 'other'}), /INVALID_FIELDS/);
  await assert.rejects(f.service.guestMessage({requestId: 'forged', token: f.token, secret: f.browserSecret, text: 'x', threadId: 'forged'}), /INVALID_FIELDS/);
  await assert.rejects(f.service.sendMessage(f.principal, {requestId: 'forged-reply', conversationId: f.conversationId, text: 'x', threadId: 'wrong'}), /GUEST_ACCESS_REQUIRED/);
  await assert.rejects(f.service.sendMessage({...f.principal, propertyIds: []}, {requestId: 'scope', conversationId: f.conversationId, text: 'x'}), /PROPERTY_FORBIDDEN/);
  const state = await f.store.read('org-demo'); delete state.conversations[f.conversationId].invitation.accessMode;
  f.db.data.set('atencion_v1/orgs/org-demo', state);
  assert.equal((await f.service.previewInvitation(f.token)).accessMode, 'verified_phone');
  await assert.rejects(f.service.openGuest({requestId: 'downgrade', token: f.token, secret: secret()}), /INVITATION_INVALID/);
});
test('rotation, revocation, expiry and phone changes invalidate guest access', async () => {
  const f = await fixture(), opened = await f.open();
  await f.service.guestMessage({requestId: 'before-rotation', token: f.token, secret: f.browserSecret, text: 'Previous thread'});
  const newToken = await f.invite('rotate'); await assert.rejects(f.view(), /INVITATION_INVALID/);
  const newSecret = secret(); await f.service.openGuest({requestId: 'new-open', token: newToken, secret: newSecret});
  assert.deepEqual((await f.service.guestView({token: newToken, secret: newSecret})).messages, []);
  await assert.rejects(f.service.sendMessage(f.principal, {requestId: 'old-reply', conversationId: f.conversationId, threadId: opened.threadId, text: 'x'}), /GUEST_ACCESS_REQUIRED/);
  const current = (await f.service.inspect(f.principal, f.conversationId)).conversation;
  await f.service.revoke(f.principal, {requestId: 'revoke', conversationId: f.conversationId, expectedVersion: current.version});
  await assert.rejects(f.service.guestView({token: newToken, secret: newSecret}), /INVITATION_INVALID/);
  const expired = await fixture(); await expired.open(); expired.advance(86400001); await assert.rejects(expired.view(), /INVITATION_INVALID/);
  const phone = await fixture(); await phone.open();
  const target = (await phone.service.inspect(phone.principal, phone.conversationId)).conversation;
  await phone.service.updateContact(phone.principal, {requestId: 'contact-change', conversationId: phone.conversationId, expectedVersion: target.version, phone: '2381234567'});
  await assert.rejects(phone.view(), /INVITATION_INVALID/);
});
test('shared conditions respect current property and version; no automatic cross-unit inheritance', async () => {
  const f = await fixture(); await f.open(); assert.equal((await f.view()).conditions, null);
  const current = (await f.service.inspect(f.principal, f.conversationId)).conversation;
  await f.service.shareConditions(f.principal, {requestId: 'share', conversationId: f.conversationId, expectedVersion: current.version});
  assert.equal((await f.view()).conditions.deposit, 2800);
  const changed = (await f.service.inspect(f.principal, f.conversationId)).conversation;
  await f.service.changeInterest(f.principal, {requestId: 'change', conversationId: f.conversationId, propertyId: 'norte', expectedVersion: changed.version});
  const view = await f.view(); assert.equal(view.sheet.propertyId, 'norte'); assert.equal(view.conditions, null);
});
async function http(handler, url, body) {
  const req = Readable.from([]); req.method = 'POST'; req.url = '/attention-api' + url; req.headers = {'content-type': 'application/json'}; req.rawBody = Buffer.from(JSON.stringify(body));
  const res = {headers: {}, setHeader(k, v) {this.headers[k] = v;}, end(raw) {this.body = JSON.parse(raw);}};
  await handler(req, res); return res;
}
test('guest HTTP needs no Auth provider but enforces link, browser secret and field allowlists', async () => {
  const f = await fixture();
  const handler = createAttentionHttp({service: f.service, authority: {agent() {throw Error('AUTHENTICATION_REQUIRED');}, customer() {throw Error('AUTHENTICATION_REQUIRED');}}});
  assert.equal((await http(handler, '/guest/open', {requestId: 'http-open', token: f.token, secret: f.browserSecret})).statusCode, 200);
  assert.equal((await http(handler, '/guest/view', {token: f.token, secret: secret()})).statusCode, 403);
  assert.equal((await http(handler, '/guest/message', {requestId: 'http-message', token: f.token, secret: f.browserSecret, text: 'Hola'})).statusCode, 200);
  assert.equal((await http(handler, '/guest/view', {token: f.token, secret: f.browserSecret, uid: 'advisor-demo'})).statusCode, 400);
  assert.equal((await http(handler, '/agent/capture', {organizationId: 'org-demo'})).statusCode, 401);
});
class Element {
  constructor() {this.children = []; this.handlers = {}; this.value = ''; this.hidden = false; this.disabled = false; this.classList = {toggle() {}};}
  append(...nodes) {this.children.push(...nodes);} replaceChildren(...nodes) {this.children = nodes;}
  addEventListener(name, callback) {this.handlers[name] = callback;}
}
test('actual customer script opens, sends and restores guest session without Firebase, phone or captcha', async () => {
  const f = await fixture(); const storage = new Map();
  const handler = createAttentionHttp({service: f.service, authority: {}});
  async function page() {
    const ids = [...fs.readFileSync(require.resolve('../atencion.html'), 'utf8').matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    const context = {document: {body: {dataset: {role: 'customer'}}, getElementById: id => {assert.ok(elements[id], id); return elements[id];}, querySelectorAll: () => [], createElement: () => new Element()},
      window: {SYNAPSE_ATTENTION_CONFIG: {firebase: {}, reservationOrigin: 'https://example.test'}}, location: {hash: '#' + f.token}, crypto: webcrypto, TextEncoder, Uint8Array, URL, Intl, Date,
      btoa: value => Buffer.from(value, 'binary').toString('base64'), localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
      fetch: async (url, request) => {const r = await http(handler, url.replace('/attention-api', ''), JSON.parse(request.body)); return {ok: r.statusCode === 200, json: async () => r.body};}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../web/attention/attention.js'), 'utf8'), context);
    for (let i = 0; i < 200; i++) {if (elements['access-state'].textContent?.includes('Invitado')) return elements; await new Promise(resolve => setTimeout(resolve, 5));}
    assert.fail('Customer page did not open guest session: ' + elements.status.textContent);
  }
  const first = await page(); assert.equal(first.verification.hidden, true); assert.equal(first['customer-chat'].hidden, false);
  assert.equal(Object.values((await f.store.read('org-demo')).journal).filter(e => e.kind === 'guest_connected').length, 0);
  first.message.value = 'Sin SMS, desde la interfaz real'; first['message-form'].handlers.submit({preventDefault() {}});
  for (let i = 0; i < 200; i++) {if ((await f.store.read('org-demo')).messages[f.conversationId] && Object.values((await f.store.read('org-demo')).messages[f.conversationId]).some(m => m.text === first.message.value || m.text === 'Sin SMS, desde la interfaz real')) break; await new Promise(resolve => setTimeout(resolve, 5));}
  const reloaded = await page(); assert.equal(reloaded.messages.children.length, 1); assert.equal(storage.size, 1);
  assert.equal(Object.values((await f.store.read('org-demo')).journal).filter(e => e.kind === 'guest_connected').length, 1);
});
