'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),{webcrypto}=require('node:crypto'),{Readable}=require('node:stream');
const{JSDOM}=createRequire(path.resolve(__dirname,'../lab/workspace/package.json'))('jsdom');
const{database}=require('./helpers/workspace-db.cjs'),{createAttentionStore}=require('../server/attention-store.cjs'),{createAttentionService}=require('../server/attention-service.cjs'),{createAttentionHttp}=require('../server/attention-http.cjs');
const until=async fn=>{for(let n=0;n<250;n++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Attention booking UI did not settle');};
async function fixture(t,options={}){
 const root=path.resolve(__dirname,'..'),dom=new JSDOM(fs.readFileSync(path.join(root,'atencion-operador.html'),'utf8'),{url:'https://synapse.example/atencion-operador',runScripts:'outside-only'}),w=dom.window,d=w.document;
 const Fixed=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-28T18:00:00Z']));}static now(){return Date.parse('2026-10-28T18:00:00Z');}};w.Date=Fixed;Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;
 const db=database({leads:options.leads||{},citas:{},citas_publicas:{},telefonos_index:{},propiedades:{yin:{nombre:'Studio de prueba',activo:true,precio:2800}},disponibilidad:{horarios:{duracionMin:30,jue:{activo:true,inicio:'09:00',fin:'20:00'}},bloqueos:{}}});
 const principal={uid:'owner',organizationId:'org',role:'agent',propertyIds:['yin']},store=createAttentionStore(db),service=createAttentionService({store,invitationBaseUrl:'https://synapse.example',now:()=>new Fixed(),readAgendaEvent:async id=>db.data.citas[id],readAvailability:async()=>({properties:db.data.propiedades,observedAt:new Fixed().toISOString()})});
 for(const [requestId,name]of [['caseA','Alias A'],['caseB','Alias B']])await service.capture(principal,{requestId,displayName:name,phone:'2389999999',source:'marketplace_facebook',entryChannel:'messenger',propertyId:'yin'});
 const handler=createAttentionHttp({service,authority:{session:async()=>({organizations:[{id:'org',name:'Synapse Core'}]}),agent:async()=>principal}});
 const auth={currentUser:{uid:'owner',getIdToken:async()=>'token'},onAuthStateChanged(fn){this.changed=fn;queueMicrotask(()=>fn(this.currentUser));},async signOut(){this.currentUser=null;this.changed(null);}};
 const app={name:'[DEFAULT]',auth:()=>auth,database:()=>db};w.firebase={apps:[app]};w.SYNAPSE_ATTENTION_CONFIG={firebase:{},reservationOrigin:'https://synapse.example'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLElement.prototype.scrollIntoView=function(){};
 const clipboard=[],requests=[];Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>clipboard.push(text)}});
 let journalFail=options.journalFail;
 w.fetch=async(url,request)=>{requests.push(url);if(url.endsWith('/agent/visit')&&journalFail){journalFail=false;return{ok:false,json:async()=>({error:'SERVICE_UNAVAILABLE'})};}const req=Readable.from([]);req.method=request.method;req.url=url;req.headers={'content-type':'application/json',authorization:request.headers.Authorization};req.rawBody=Buffer.from(request.body||'');const res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};await handler(req,res);return{ok:res.statusCode===200,json:async()=>res.body};};
 for(const file of ['shared/attention-quick-replies.js','shared/workspace-model.js','shared/workspace-store.js','shared/visit-availability.js','shared/reservation-reference.js','shared/attention-booking.js','web/attention/booking.js','web/attention/attention.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const el=id=>d.getElementById(id);t.after(()=>w.close());await until(()=>el('status').textContent.includes('Sesión activa'));
 async function open(name='Alias A'){[...el('conversations').children].find(b=>b.textContent.startsWith(name)).click();await until(()=>el('customer-title').textContent===name&&!el('refresh').disabled);}
 await open();el('tab-visit').click();await until(()=>!el('visit-form').hidden&&!el('refresh').disabled);
 function set(id,value){el(id).value=value;el(id).dispatchEvent(new w.Event(id.startsWith('visit-')&&['visit-date','visit-time','visit-contact'].includes(id)?'change':'input',{bubbles:true}));}
 function fill(){set('visit-name','Persona ficticia');set('visit-phone','2389999999');set('visit-date','2026-10-29');set('visit-time','11:00');el('visit-confirmed').click();assert.equal(el('visit-confirmed').checked,true);}
 const submit=()=>el('visit-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return{w,d,db,el,open,set,fill,submit,clipboard,requests,service,principal,auth};
}
test('actual monitor confirms a visit, shows its folio, journals it and prepares without auto-sending',async t=>{
 const f=await fixture(t);f.fill();f.submit();await until(()=>!f.el('visit-receipt').hidden&&!f.el('refresh').disabled&&f.el('visit-journal').hidden);
 const e=Object.values(f.db.data.citas)[0];assert.equal(e.estado,'confirmada');assert.match(f.el('visit-receipt-title').textContent,/RSV-/);assert.equal(f.el('visit-form').hidden,true);assert.equal(f.el('visit-form').dataset.dirty,'false');assert.ok(f.el('visit-agenda').href.endsWith('/agenda?event='+e.id));assert.equal((await f.service.report(f.principal,'2026-10-28')).reservations[0],e.folio);
 f.el('visit-copy').click();await until(()=>f.clipboard.length===1&&!f.el('refresh').disabled);assert.match(f.clipboard[0],/Persona ficticia/);
 f.el('visit-prepare').click();await until(()=>!f.el('panel-conversation').hidden&&!f.el('refresh').disabled);assert.match(f.el('message').value,new RegExp(e.folio));assert.equal(f.requests.some(url=>url.endsWith('/agent/message')),false);
 assert.equal(Object.keys(f.db.data.citas).length,1);assert.equal(Object.keys(f.db.data.leads).length,1);
});
test('journal failure keeps the real folio and retries only the journal without a second reservation',async t=>{
 const f=await fixture(t,{journalFail:true});f.fill();f.submit();await until(()=>f.el('visit-status').textContent.includes('Completar bitácora')&&!f.el('refresh').disabled);assert.equal(Object.keys(f.db.data.citas).length,1);const folio=Object.values(f.db.data.citas)[0].folio;
 f.el('visit-journal').click();await until(()=>f.el('visit-journal').hidden&&!f.el('refresh').disabled);assert.equal(Object.keys(f.db.data.citas).length,1);assert.equal(Object.values(f.db.data.citas)[0].folio,folio);assert.equal((await f.service.report(f.principal,'2026-10-28')).reservations.length,1);
});
test('drafts stay with their attention and new availability does not silently preserve a stale time',async t=>{
 const f=await fixture(t);f.fill();await f.open('Alias B');f.el('tab-visit').click();await until(()=>f.el('visit-name').value==='Alias B'&&!f.el('refresh').disabled);f.set('visit-name','Persona B');
 await f.open('Alias A');f.el('tab-visit').click();await until(()=>f.el('visit-name').value==='Persona ficticia'&&!f.el('refresh').disabled);assert.equal(f.el('visit-time').value,'11:00');
 f.db.data.citas_publicas['2026-10-29_11:00']={citaId:'other'};f.el('visit-load').click();await until(()=>f.el('visit-time').value===''&&!f.el('refresh').disabled);assert.equal(Object.keys(f.db.data.citas).length,0);
 f.el('logout').click();await until(()=>f.el('workspace').hidden);assert.equal(f.el('visit-name').value,'');assert.equal(f.el('visit-confirmation').value,'');
});
test('existing contact selection is explicit and never changes its names or roles',async t=>{
 const lead={nombre:'Persona existente',telefono:'2389999999',tipo:'Propietario',_synapse:{categorias:['cliente'],version:2}},f=await fixture(t,{leads:{existing:lead}});
 assert.equal(f.el('visit-contact').value,'');assert.match(f.el('visit-matches').textContent,/coincidencia/);
 f.set('visit-contact','existing');assert.equal(f.el('visit-name').value,lead.nombre);f.set('visit-date','2026-10-29');f.set('visit-time','11:00');f.el('visit-confirmed').click();f.submit();await until(()=>!f.el('visit-receipt').hidden&&!f.el('refresh').disabled);assert.deepEqual(f.db.data.leads.existing,lead);assert.equal(Object.keys(f.db.data.leads).length,1);
});
test('copying re-reads the event and does not share a cancelled or unreadable stale confirmation',async t=>{
 const f=await fixture(t);f.fill();f.submit();await until(()=>!f.el('visit-receipt').hidden&&!f.el('refresh').disabled&&f.el('visit-journal').hidden);
 Object.values(f.db.data.citas)[0].estado='cancelada';f.el('visit-copy').click();await until(()=>f.el('visit-copy').hidden&&!f.el('refresh').disabled);assert.equal(f.clipboard.length,0);assert.equal(f.el('visit-confirmation').value,'');
});
