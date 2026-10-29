'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {Readable} = require('node:stream');
const {memoryDb} = require('./helpers/attention-memory-db.cjs');
const {createAttentionStore} = require('../server/attention-store.cjs');
const {createAttentionService} = require('../server/attention-service.cjs');
const {createAttentionHttp} = require('../server/attention-http.cjs');
const leaseConfig = require('../lab/attention/fixtures/lease-config.json');
const lease = require('../shared/lease-continuity.js');
const replies = require('../shared/attention-quick-replies.js');
const alerts = require('../shared/attention-alerts.js');
const {uiClock,audioHost} = require('./helpers/attention-ui-clock.cjs');
const yin = {nombre:'YIN 05', precio:2800, activo:true, unitId:'yin-05', propertyGroupId:'adn-suites-studios', unitType:'STUDIO', descripcion:'Private address never sent in quick replies'};
const other = {nombre:'Other property', precio:2500, activo:true};
test('prepared replies follow unit-specific terms, exclusions and unknown information', () => {
  const forYin = replies.forProperty(lease.propertySheet('yin',yin,leaseConfig),'https://example.test/reservar?unidad=yin-05');
  const service = forYin.find(item=>item.id==='services').text;
  assert.match(service,/No incluye: Sky Terrace, Jardín Botánico/); assert.match(service,/Agua/);
  assert.match(forYin.find(item=>item.id==='deposit').text,/2,800/);
  assert.match(forYin.find(item=>item.id==='visit').text,/unidad=yin-05/);
  assert.ok(!JSON.stringify(forYin).includes('Private address'));
  assert.ok(forYin.every(item=>item.text.length<=2000));
  assert.equal(new Set(forYin.map(item=>item.id)).size,forYin.length);
  const forOther=replies.forProperty(lease.propertySheet('other',other,leaseConfig),'https://example.test/reservar');
  assert.match(forOther.find(item=>item.id==='deposit').text,/confirmar/);
  assert.ok(!JSON.stringify(forOther).includes('Sky Terrace'));
  assert.match(forOther.find(item=>item.id==='requirements').text,/confirmar/);
  assert.ok(!forYin.find(item=>item.id==='availability').text.includes('Sí está disponible'));
});
test('reply bank rejects unsafe URLs and requires a selected property', () => {
  assert.deepEqual(replies.forProperty(null,'bad'),[]);
  assert.throws(()=>replies.forProperty(lease.propertySheet('yin',yin,leaseConfig),'javascript:alert(1)'),/INVALID_RESERVATION_URL/);
});
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.attrs={};this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.open=false;this._classes=new Set();this.classList={add:(...names)=>names.forEach(name=>this._classes.add(name)),remove:(...names)=>names.forEach(name=>this._classes.delete(name)),toggle:(name,force)=>{const result=force===undefined?!this._classes.has(name):force;if(result)this._classes.add(name);else this._classes.delete(name);return result;},contains:name=>this._classes.has(name)};}
  append(...nodes){for(const item of nodes){this.children.push(item);if(this.tag==='select'&&this.children.length===1)this.value=item.value;}}
  replaceChildren(...nodes){this.children=[];if(this.tag==='select')this.value='';this.append(...nodes);}
  addEventListener(name,handler){this.handlers[name]=handler;}
  setAttribute(name,value){this.attrs[name]=value;} focus(){this.focused=true;} showModal(){this.open=true;} close(){this.open=false;} reset(){if(this.onReset)this.onReset();}
  fire(name,event={}){assert.ok(this.handlers[name],name+' handler');return this.handlers[name]({preventDefault(){},...event});}
}
async function until(check){for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('UI condition not reached');}
async function fixture(options={}){
  const clock=uiClock(),audio=audioHost(),storage=new Map(),events={};
  const db=memoryDb(),store=createAttentionStore(db),principal={uid:'agent-test',organizationId:'org-demo',role:'agent',propertyIds:['yin','other']};
  const service=createAttentionService({store,leaseConfig,invitationBaseUrl:'https://example.test',readAvailability:async()=>({observedAt:new Date().toISOString(),properties:{yin,other}})});
  for(const [requestId,propertyId,displayName] of [['case-a','yin','Client A'],['case-b','other','Client B']])await service.capture(principal,{requestId,propertyId,displayName,source:'marketplace_facebook',entryChannel:'messenger'});
  const handler=createAttentionHttp({service,authority:{session:async()=>({organizations:[{id:'org-demo',name:'Synapse Core'}]}),agent:async(bearer,org)=>{assert.equal(bearer,'Bearer test-token');assert.equal(org,'org-demo');return principal;}}});
  const html=fs.readFileSync(require.resolve('../atencion-operador.html'),'utf8'),elements={},all=[];
  for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.hidden=/\bhidden\b/.test(match[0]);el.checked=/\bchecked\b/.test(match[0]);elements[match[2]]=el;all.push(el);}
  elements.source.value='marketplace_facebook';elements['entry-channel'].value='messenger';elements.question.value='¿Sigue disponible?';elements.capture.onReset=()=>{for(const key of ['display-name','surname','phone'])elements[key].value='';};
  const body=new Element('body');body.dataset={role:'agent'};const requests=[];
  const auth={currentUser:{uid:'agent-test',getIdToken:async()=>'test-token'},onAuthStateChanged(callback){this.callback=callback;queueMicrotask(()=>callback(this.currentUser));},async signOut(){this.currentUser=null;this.callback(null);}};
  const context={document:{title:'Synapse Test',visibilityState:'visible',focused:true,hasFocus(){return this.focused;},addEventListener:(name,fn)=>{events[name]=fn;},body,getElementById:id=>{assert.ok(elements[id],id);return elements[id];},querySelectorAll:()=>all.filter(el=>['button','select'].includes(el.tag)),createElement:tag=>{const el=new Element(tag);all.push(el);return el;}},window:{addEventListener:(name,fn)=>{events[name]=fn;},AudioContext:audio.AudioContext,fetch:audio.fetch,SYNAPSE_ATTENTION_CONFIG:{firebase:{},reservationOrigin:'https://example.test'},SynapseQuickReplies:replies,SynapseAlerts:alerts},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,firebase:{apps:[],initializeApp:()=>({auth:()=>auth})},location:{hash:'',search:options.search||''},crypto:webcrypto,URL,URLSearchParams,Intl,Date,fetch:async(url,request)=>{requests.push({url,body:request.body&&JSON.parse(request.body)});const req=Readable.from([]);req.method=request.method;req.url=url;req.headers={'content-type':'application/json',authorization:request.headers.Authorization};req.rawBody=Buffer.from(request.body||'');const res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};await handler(req,res);return{ok:res.statusCode===200,json:async()=>res.body};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/attention/attention.js'),'utf8'),context);
  await until(()=>elements.status.textContent?.includes('Sesión activa'));
  async function open(name){const button=elements.conversations.children.find(el=>el.textContent.startsWith(name));assert.ok(button);button.fire('click');await until(()=>elements['customer-title'].textContent===name&&!elements.refresh.disabled);}
  return{elements,body,requests,store,open,auth,service,clock,audio:audio.state,storage,document:context.document,events,principal};
}
test('operator panels prepare editable replies without sending and isolate drafts per attention',async()=>{
  const f=await fixture(),e=f.elements;await f.open('Client A');
  assert.equal(e['panel-conversation'].hidden,false);assert.equal(e['panel-property'].hidden,true);
  e['reply-preset'].value='services';e['prepare-reply'].fire('click');
  const aDraft=e.message.value;assert.match(aDraft,/No incluye: Sky Terrace/);
  assert.equal(f.requests.filter(r=>r.url.endsWith('/agent/message')).length,0);
  e['tab-property'].fire('click');assert.equal(e['panel-property'].hidden,false);assert.equal(e['panel-conversation'].hidden,true);assert.equal(e.message.value,aDraft);
  e['tab-contact'].fire('keydown',{key:'ArrowRight'});assert.equal(e['tab-journal'].attrs['aria-selected'],'true');
  await f.open('Client B');assert.equal(e.message.value,'');assert.equal(e['panel-conversation'].hidden,false);
  e['reply-preset'].value='deposit';e['prepare-reply'].fire('click');assert.match(e.message.value,/confirmar/);assert.ok(!e.message.value.includes('2,800'));
  await f.open('Client A');assert.equal(e.message.value,aDraft);
  e['message-form'].fire('submit');await until(()=>f.requests.some(r=>r.url.endsWith('/agent/message'))&&!e.refresh.disabled);
  const messages=(await f.store.read('org-demo')).messages;assert.equal(Object.values(messages['case-a']).length,1);assert.equal(messages['case-b'],undefined);assert.equal(e.message.value,'');
});
test('new-attention/report dialogs are explicit and logout clears private drafts',async()=>{
  const f=await fixture(),e=f.elements;await f.open('Client A');e.message.value='Private unsent draft';
  e['new-attention'].fire('click');assert.equal(e['capture-dialog'].open,true);assert.equal(f.requests.filter(r=>r.url.endsWith('/agent/capture')).length,0);
  e['close-capture'].fire('click');assert.equal(e['capture-dialog'].open,false);
  e['open-report'].fire('click');assert.equal(e['report-dialog'].open,true);e.report.fire('click');await until(()=>e['report-result'].children.length>0&&!e.refresh.disabled);
  e['report-result'].children.find(el=>el.tag==='button').fire('click');await until(()=>!e['report-dialog'].open&&!e.refresh.disabled);
  e.logout.fire('click');await until(()=>e.workspace.hidden);assert.equal(e.message.value,'');assert.equal(f.body.classList.contains('operator-ready'),false);
});
test('guest connection refresh retains the current share text without rotating the link',async()=>{
  const f=await fixture(),e=f.elements;await f.open('Client A');
  e.invite.fire('click');await until(()=>e['share-text'].value.includes('https://')&&!e.refresh.disabled);
  const shared=e['share-text'].value,token=new URL(shared.split('\n')[1]).hash.slice(1);
  const browserSecret=require('node:crypto').randomBytes(32).toString('base64url');
  await f.service.openGuest({requestId:'guest-connect',token,secret:browserSecret});
  e.refresh.fire('click');await until(()=>e['access-state'].textContent.includes('Invitado conectado')&&!e.refresh.disabled);
  assert.equal(e['share-text'].value,shared);assert.equal((await f.service.previewInvitation(token)).accessMode,'hype_business_guest');
});
async function guestWriter(f,conversationId){
  const current=(await f.service.inspect(f.principal,conversationId)).conversation;
  const invitation=await f.service.invite(f.principal,{requestId:'invite-'+conversationId,conversationId,expectedVersion:current.version});
  const token=new URL(invitation.url).hash.slice(1),secret=require('node:crypto').randomBytes(32).toString('base64url');
  await f.service.openGuest({requestId:'open-'+conversationId,token,secret});
  return (requestId,text)=>f.service.guestMessage({requestId,token,secret,text});
}
test('automatic advisor notices count incoming messages, play once and preserve all unsent fields',async()=>{
  const f=await fixture(),e=f.elements;await f.open('Client A');
  e.message.value='Unsent answer';e['contact-name'].value='Unsent contact edit';e.summary.value='Unsent private journal';
  assert.equal(f.audio.contexts,0);await e['sound-toggle'].fire('click');assert.equal(f.audio.starts,1);
  const write=await guestWriter(f,'case-b');await write('incoming-1','New client question');
  await f.clock.tick();assert.equal(e['unread-summary'].textContent,'1 mensaje nuevo');assert.equal(f.audio.starts,2);assert.match(f.document.title,/^\(1\)/);
  assert.equal(e.message.value,'Unsent answer');assert.equal(e['contact-name'].value,'Unsent contact edit');assert.equal(e.summary.value,'Unsent private journal');
  await write('incoming-1','New client question');await f.clock.tick();assert.equal(f.audio.starts,2);assert.equal(e['unread-summary'].textContent,'1 mensaje nuevo');
  e['next-unread'].fire('click');await until(()=>e['customer-title'].textContent==='Client B'&&!e.refresh.disabled);
  assert.equal(e['unread-summary'].textContent,'Sin mensajes nuevos');assert.equal(e.messages.children.length,1);
  await f.open('Client A');assert.equal(e.message.value,'Unsent answer');
  await e['sound-toggle'].fire('click');await write('incoming-2','Muted client question');await f.clock.tick();
  assert.equal(f.audio.starts,2);assert.equal(e['unread-summary'].textContent,'1 mensaje nuevo');
  assert.ok([...f.storage.values()].every(value=>!value.includes('Client')&&!value.includes('question')));
});
test('a background response is unread until the visible conversation is read; logout stops polling and sound',async()=>{
  const f=await fixture(),e=f.elements;await f.open('Client A');const write=await guestWriter(f,'case-a');
  await e['sound-toggle'].fire('click');f.document.visibilityState='hidden';e.message.value='Still typing';
  await write('background-1','Background reply');await f.clock.tick();
  assert.equal(e['unread-summary'].textContent,'1 mensaje nuevo');assert.equal(e.message.value,'Still typing');assert.equal(e.messages.children.length,1);
  f.document.visibilityState='visible';f.events.focus();assert.equal(e['unread-summary'].textContent,'Sin mensajes nuevos');
  await f.clock.tick();assert.equal(f.audio.starts,2);
  e.logout.fire('click');await until(()=>e.workspace.hidden);assert.equal(f.clock.size,0);assert.equal(f.document.title,'Synapse Test');assert.equal(e['sound-toggle'].attrs['aria-pressed'],'false');
});

test('reading a question keeps Radar pending; explicit external response closes it without sending a Synapse message',async()=>{
 const f=await fixture(),e=f.elements,write=await guestWriter(f,'case-a');await write('question-external','Question needing an answer');await f.open('Client A');assert.equal((await f.service.pending(f.principal,{})).items.find(i=>i.conversationId==='case-a').actionType,'reply');assert.match(e['response-status'].textContent,/1 mensaje/);
 e['external-channel'].value='messenger';e['external-result'].value='Answered in the original Messenger conversation.';e['record-external-reply'].fire('click');await until(()=>e.status.textContent?.includes('Respuesta externa registrada')&&!e.refresh.disabled);assert.equal((await f.service.pending(f.principal,{})).items.some(i=>i.conversationId==='case-a'),false);assert.equal(f.requests.filter(r=>r.url.endsWith('/agent/message')).length,0);assert.equal((await f.store.read('org-demo')).messages['case-a']['question-external'].answeredBy.channel,'messenger');
});
test('agent records the agreed preferred channel while preserving source and the active guest invitation',async()=>{
 const f=await fixture(),e=f.elements;await guestWriter(f,'case-a');await f.open('Client A');const before=(await f.service.inspect(f.principal,'case-a')).conversation;e['agent-preferred-channel'].value='whatsapp';e['save-preferred-channel'].fire('click');await until(()=>e.status.textContent?.includes('Medio preferido guardado')&&!e.refresh.disabled);const after=(await f.service.inspect(f.principal,'case-a')).conversation;assert.equal(after.context.preferredChannel,'whatsapp');assert.equal(after.context.entryChannel,'messenger');assert.equal(after.context.source,'marketplace_facebook');assert.deepEqual(after.invitation,before.invitation);assert.match(e['response-status'].textContent,/WhatsApp/);
});

test('Radar deep link opens the authorized conversation directly in its follow-up panel without sending',async()=>{
 const f=await fixture({search:'?organization=org-demo&conversation=case-b&panel=journal'});assert.equal(f.elements['customer-title'].textContent,'Client B');assert.equal(f.elements['panel-journal'].hidden,false);assert.equal(f.elements['panel-conversation'].hidden,true);assert.equal(f.requests.some(r=>r.url.endsWith('/agent/message')),false);assert.equal(f.elements['attention-followup'].hidden,false);
});
