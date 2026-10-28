'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {messageStats,createTracker,createSound,signatureAsset}=require('../shared/attention-alerts.js');
const {audioHost}=require('./helpers/attention-ui-clock.cjs');
test('incoming metadata distinguishes advisor/client roles and never carries message text',()=>{
  const messages=[{id:'a',actorRole:'guest',text:'private',recordedAt:'2026-10-27T12:00:00Z'},{id:'b',actorRole:'agent',text:'protected',recordedAt:'2026-10-27T12:01:00Z'},{id:'c',actorRole:'customer',text:'private 2',recordedAt:'2026-10-27T12:02:00Z'}];
  assert.deepEqual(messageStats(messages,['customer','guest']),{count:2,sinceReply:1,lastId:'c',lastAt:'2026-10-27T12:02:00Z'});
  assert.deepEqual(messageStats(messages,['agent']),{count:1,sinceReply:0,lastId:'b',lastAt:'2026-10-27T12:01:00Z'});
  assert.ok(!JSON.stringify(messageStats(messages,['agent'])).includes('protected'));
});
test('device read markers survive reload, isolate accounts, ignore retries and do not ring for old history',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const first=createTracker(storage,'agent-a/org-a');
  assert.deepEqual(first.observe('case-a',{count:4,sinceReply:1}),{fresh:0,unread:1});
  assert.deepEqual(first.observe('case-a',{count:5,sinceReply:2}),{fresh:1,unread:2});
  assert.deepEqual(first.observe('case-a',{count:5,sinceReply:2}),{fresh:0,unread:2});
  first.read('case-a',4);assert.equal(first.unread('case-a'),1);first.read('case-a',99);assert.equal(first.unread('case-a'),0);
  const reloaded=createTracker(storage,'agent-a/org-a');assert.deepEqual(reloaded.observe('case-a',{count:5,sinceReply:2}),{fresh:0,unread:0});
  const other=createTracker(storage,'agent-b/org-a');assert.equal(other.observe('case-a',{count:5,sinceReply:2}).unread,2);
  const blocked=createTracker({getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}},'blocked');assert.equal(blocked.observe('case-a',{count:1,sinceReply:1}).unread,1);
});
test('Synapse signature only plays after explicit activation; muting suppresses the same motif',async()=>{
  const host=audioHost(),sound=createSound(host);assert.equal(sound.play(),false);assert.equal(host.state.contexts,0);
  assert.equal(host.state.fetches,0);
  await sound.enable();assert.equal(host.state.starts,1);assert.equal(sound.enabled,true);
  assert.equal(host.state.played[0].duration,.98);
  assert.deepEqual(host.state.played[0].bytes,require('node:fs').readFileSync(require.resolve('../assets/audio/synapse-nexo-v1.wav')));
  sound.play();assert.equal(host.state.starts,2);sound.mute();assert.equal(sound.play(),false);assert.equal(host.state.starts,2);assert.equal(host.state.stops,2);
  await sound.enable();assert.equal(host.state.fetches,1);assert.equal(host.state.decodes,1);assert.equal(host.state.starts,3);
  await assert.rejects(createSound({}).enable(),/AUDIO_UNAVAILABLE/);
});
test('Nexo download failures can retry and logout cancels pending activation',async()=>{
  const host=audioHost();const fetch=host.fetch;let fail=true;
  host.fetch=async url=>{assert.equal(url,signatureAsset);if(fail){fail=false;return{ok:false};}return fetch();};
  const sound=createSound(host);await assert.rejects(sound.enable(),/AUDIO_UNAVAILABLE/);assert.equal(sound.enabled,false);assert.equal(host.state.starts,0);
  await sound.enable();assert.equal(host.state.starts,1);
  const delayed=audioHost();const original=delayed.fetch;let release;
  delayed.fetch=async()=>{await new Promise(resolve=>{release=resolve;});return original();};
  const canceled=createSound(delayed),activation=canceled.enable();await Promise.resolve();await Promise.resolve();
  canceled.mute();release();assert.equal(await activation,false);assert.equal(canceled.enabled,false);assert.equal(delayed.state.starts,0);
});
test('inbox counts stay within authorized property scope and expose no message body',async()=>{
  const {memoryDb}=require('./helpers/attention-memory-db.cjs'),{createAttentionStore}=require('../server/attention-store.cjs'),{createAttentionService}=require('../server/attention-service.cjs');
  const db=memoryDb(),store=createAttentionStore(db);
  db.data.set('atencion_v1/orgs/org-a',{conversations:{allowed:{id:'allowed',context:{currentPropertyId:'property-a'}},denied:{id:'denied',context:{currentPropertyId:'property-b'}}},messages:{allowed:{first:{id:'first',actorRole:'guest',recordedAt:'2026-10-27T12:00:00Z',text:'PRIVATE_MESSAGE_CONTENT'}},denied:{other:{id:'other',actorRole:'guest',recordedAt:'2026-10-27T12:00:00Z',text:'DENIED_MESSAGE'}}}});
  const service=createAttentionService({store,readAvailability:async()=>{throw Error('NOT_USED_FOR_INBOX');},invitationBaseUrl:'https://example.test'});
  const rows=await service.list({uid:'agent-a',organizationId:'org-a',role:'agent',propertyIds:['property-a']});
  assert.equal(rows.length,1);assert.equal(rows[0].id,'allowed');assert.equal(rows[0].inbox.count,1);assert.ok(!JSON.stringify(rows).includes('PRIVATE_MESSAGE_CONTENT'));assert.ok(!JSON.stringify(rows).includes('DENIED_MESSAGE'));
});
test('automatic reads wait for a local transaction without blocking another organization',async()=>{
  const {createAttentionStore}=require('../server/attention-store.cjs');
  let writing=false,release;const gate=new Promise(resolve=>{release=resolve;});let root={conversations:{case1:{id:'case1'}}};
  const store=createAttentionStore({ref:path=>({get:async()=>({val:()=>path.endsWith('/other')?{other:true}:writing?null:root}),transaction:async update=>{writing=true;const next=update(root);await gate;root=next;writing=false;return{committed:true,snapshot:{val:()=>root}};}})});
  const write=store.apply('org','request','agent',{operation:'test'},state=>({state:{...state,noticeReady:true},receipt:{status:'recorded'}}));
  await Promise.resolve();await Promise.resolve();assert.equal(writing,true);
  let readFinished=false;const read=store.read('org').then(value=>{readFinished=true;return value;});
  assert.deepEqual(await store.read('other'),{other:true});assert.equal(readFinished,false);
  release();await write;const result=await read;assert.equal(result.noticeReady,true);assert.ok(result.conversations.case1);
});
