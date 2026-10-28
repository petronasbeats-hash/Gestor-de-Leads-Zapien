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
test('rotation, explicit revocation and expiry invalidate guest access', async () => {
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
});
test('adding a guest phone preserves the same private thread without verifying identity or extending access', async () => {
  const f=await fixture(); const opened=await f.open();
  await f.service.guestMessage({requestId:'guest-before-phone',token:f.token,secret:f.browserSecret,text:'Keep my conversation'});
  const before=(await f.service.inspect(f.principal,f.conversationId)).conversation;
  const result=await f.service.updateContact(f.principal,{requestId:'contact-change',conversationId:f.conversationId,expectedVersion:before.version,displayName:'New private name',phone:'2381234567'});
  assert.equal(result.invitationInvalidated,false);
  const after=(await f.service.inspect(f.principal,f.conversationId)).conversation;
  assert.deepEqual(after.invitation,before.invitation);assert.deepEqual(after.guestAccess,before.guestAccess);
  const view=await f.view();assert.equal(view.identityStatus,'unverified');assert.equal(view.messages[0].text,'Keep my conversation');
  assert.equal(JSON.stringify(view).includes('2381234567'),false);assert.equal(JSON.stringify(view).includes('New private name'),false);
  await assert.rejects(f.service.guestView({token:f.token,secret:secret()}),/GUEST_ACCESS_REQUIRED/);
  await f.service.sendMessage(f.principal,{requestId:'reply-after-phone',conversationId:f.conversationId,threadId:opened.threadId,text:'Same thread'});
  assert.equal((await f.view()).messages.length,2);
  f.advance(86400001);await assert.rejects(f.view(),/INVITATION_INVALID/);
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
  constructor() {this.children = []; this.handlers = {}; this.attrs={};this.value = ''; this.hidden = false; this.disabled = false; this.classList = {toggle() {},remove(){}};}
  append(...nodes) {this.children.push(...nodes);} replaceChildren(...nodes) {this.children = nodes;}
  addEventListener(name, callback) {this.handlers[name] = callback;}
  setAttribute(name,value){this.attrs[name]=value;}
}
test('customer defaults to sound, remembers mute and never unlocks from the mute click',async()=>{
  const f=await fixture(),storage=new Map(),page=await customerPage(f,storage);
  assert.equal(page['sound-toggle'].textContent,'Silenciar sonido');assert.equal(page['sound-toggle'].attrs['aria-pressed'],'true');
  await page._events.click({isTrusted:true,type:'click',target:page['sound-toggle']});assert.equal(page._audio.contexts,0);
  await page['sound-toggle'].handlers.click();assert.equal(page['sound-toggle'].attrs['aria-pressed'],'false');
  assert.equal(storage.get('synapse.attention.customerSound.v1'),'muted');
  await page._events.click({isTrusted:true,type:'click',target:page.message});assert.equal(page._audio.contexts,0);
  const reloaded=await customerPage(f,storage);assert.equal(reloaded['sound-toggle'].attrs['aria-pressed'],'false');
  await reloaded._events.keydown({isTrusted:true,type:'keydown',key:'a',target:reloaded.message});assert.equal(reloaded._audio.contexts,0);
  await reloaded['sound-toggle'].handlers.click();assert.equal(reloaded._audio.starts,1);assert.equal(reloaded['sound-toggle'].attrs['aria-pressed'],'true');
  assert.equal(storage.get('synapse.attention.customerSound.v1'),'enabled');
  await reloaded._events.click({isTrusted:true,type:'click',target:reloaded.message});assert.equal(reloaded._audio.fetches,1);assert.equal(reloaded._audio.starts,1);
});
test('customer retries automatic audio after a network failure and can mute during a download',async()=>{
  const f=await fixture();let fetches=0;
  const page=await customerPage(f,new Map(),{configureAudio(audio){const original=audio.fetch;audio.fetch=async()=>{if(++fetches===1)throw Error('offline');return original();};}});
  await page._events.keydown({isTrusted:true,type:'keydown',key:'Escape',target:page.message});assert.equal(page._audio.contexts,0);
  await page._events.click({isTrusted:true,type:'click',target:page.message});assert.equal(page._audio.starts,0);assert.match(page['sound-hint'].textContent,/reintentará/);
  await page._events.keydown({isTrusted:true,type:'keydown',key:'h',target:page.message});assert.equal(fetches,2);assert.equal(page._audio.starts,0);assert.match(page['sound-hint'].textContent,/Escucharás Nexo/);
  let release;
  const delayed=await customerPage(f,new Map(),{configureAudio(audio){const original=audio.fetch;audio.fetch=async()=>{await new Promise(resolve=>{release=resolve;});return original();};}});
  const loading=delayed._events.click({isTrusted:true,type:'click',target:delayed.message});await Promise.resolve();await Promise.resolve();
  await delayed['sound-toggle'].handlers.click();release();await loading;
  assert.equal(delayed['sound-toggle'].attrs['aria-pressed'],'false');assert.equal(delayed._audio.starts,0);assert.match(delayed['sound-hint'].textContent,/silenciado/);
});
async function customerPage(f, storage = new Map(), options = {}) {
  const handler = createAttentionHttp({service: f.service, authority: {}});
  const clock=require('./helpers/attention-ui-clock.cjs').uiClock(),audio=require('./helpers/attention-ui-clock.cjs').audioHost(),events={};
  options.configureAudio?.(audio);
  const ids = [...fs.readFileSync(require.resolve('../atencion.html'), 'utf8').matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const context = {document: {title:'Synapse Customer',visibilityState:'visible',hasFocus:()=>true,addEventListener:(name,fn)=>{events[name]=fn;},body: {dataset: {role: 'customer'}}, getElementById: id => {assert.ok(elements[id], id); return elements[id];}, querySelectorAll: () => [], createElement: () => new Element()},
    window: {SynapseAlerts:require('../shared/attention-alerts.js'),AudioContext:audio.AudioContext,fetch:audio.fetch,addEventListener:(name,fn)=>{events[name]=fn;},SYNAPSE_ATTENTION_CONFIG: {firebase: {}, reservationOrigin: 'https://example.test'}},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout, location: {hash: '#' + f.token}, crypto: webcrypto, TextEncoder, Uint8Array, URL, Intl, Date,
    btoa: value => Buffer.from(value, 'binary').toString('base64'), localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
    fetch: async (url, request) => {const r = await http(handler, url.replace('/attention-api', ''), JSON.parse(request.body)); return {ok: r.statusCode === 200, json: async () => r.body};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/attention/attention.js'), 'utf8'), context);
  elements._clock=clock;elements._audio=audio.state;elements._document=context.document;elements._events=events;
  for (let i = 0; i < 200; i++) {if (elements['access-state'].textContent?.includes('Invitado')) return elements; await new Promise(resolve => setTimeout(resolve, 5));}
  assert.fail('Customer page did not open guest session: ' + elements.status.textContent);
}
test('actual customer script opens, sends and restores guest session without Firebase, phone or captcha', async () => {
  const f = await fixture(); const storage = new Map();
  const page=()=>customerPage(f,storage);
  const first = await page(); assert.equal(first.verification.hidden, true); assert.equal(first['customer-chat'].hidden, false);
  assert.equal(Object.values((await f.store.read('org-demo')).journal).filter(e => e.kind === 'guest_connected').length, 0);
  first.message.value = 'Sin SMS, desde la interfaz real'; first['message-form'].handlers.submit({preventDefault() {}});
  for (let i = 0; i < 200; i++) {if ((await f.store.read('org-demo')).messages[f.conversationId] && Object.values((await f.store.read('org-demo')).messages[f.conversationId]).some(m => m.text === first.message.value || m.text === 'Sin SMS, desde la interfaz real')) break; await new Promise(resolve => setTimeout(resolve, 5));}
  const reloaded = await page(); assert.equal(reloaded.messages.children.length, 1); assert.equal(storage.size, 2);
  assert.equal(Object.values((await f.store.read('org-demo')).journal).filter(e => e.kind === 'guest_connected').length, 1);
  assert.equal(reloaded['sound-toggle'].attrs['aria-pressed'],'true');assert.equal(reloaded._audio.contexts,0);
  await reloaded._events.click({isTrusted:false,target:reloaded.message,type:'click'});assert.equal(reloaded._audio.contexts,0);
  await reloaded._events.keydown({isTrusted:true,target:reloaded.message,type:'keydown',key:'h'});assert.equal(reloaded._audio.contexts,1);assert.equal(reloaded._audio.starts,0);
  const current=(await f.service.inspect(f.principal,f.conversationId)).conversation;
  await f.service.sendMessage(f.principal,{requestId:'automatic-advisor-reply',conversationId:f.conversationId,threadId:current.invitation.threadId,text:'Respuesta automática visible, enviada por el asesor'});
  reloaded._document.visibilityState='hidden';reloaded.message.value='Customer unsent draft';
  await reloaded._clock.tick();assert.equal(reloaded.messages.children.length,2);assert.equal(reloaded['unread-summary'].textContent,'1 mensaje nuevo');assert.equal(reloaded._audio.starts,1);assert.equal(reloaded.message.value,'Customer unsent draft');
  await reloaded._clock.tick();assert.equal(reloaded._audio.starts,1);
  reloaded._document.visibilityState='visible';reloaded._events.focus();assert.equal(reloaded['unread-summary'].textContent,'Sin mensajes nuevos');
  const beforeChange=(await f.service.inspect(f.principal,f.conversationId)).conversation;
  await f.service.changeInterest(f.principal,{requestId:'automatic-property-change',conversationId:f.conversationId,propertyId:'norte',expectedVersion:beforeChange.version});
  await reloaded._clock.tick();const currentSheet=(await f.service.inspect(f.principal,f.conversationId)).sheet;
  assert.equal(reloaded.sheet.children[0].textContent,currentSheet.name);assert.equal(reloaded.message.value,'Customer unsent draft');
});
