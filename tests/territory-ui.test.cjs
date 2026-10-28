'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),{webcrypto}=require('node:crypto');
const dep=createRequire(path.resolve(__dirname,'../lab/workspace/package.json')),{JSDOM}=dep('jsdom'),{IDBFactory}=dep('fake-indexeddb');
const D=require('../web/territory/local-drafts.js'),{database}=require('./helpers/workspace-db.cjs'),{createTerritoryService}=require('../server/territory-service.cjs'),{createAttentionHttp}=require('../server/attention-http.cjs');
const until=async fn=>{for(let n=0;n<400;n++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Territory UI did not settle');};
async function fixture(t,{indexedDB=new IDBFactory(),db=database(),fail=false}={}){
 const root=path.resolve(__dirname,'..'),dom=new JSDOM(fs.readFileSync(path.join(root,'territorio.html'),'utf8'),{url:'https://synapse.example/territorio',runScripts:'outside-only'}),w=dom.window,d=w.document;w.structuredClone=structuredClone;Object.defineProperty(w,'crypto',{value:webcrypto});Object.defineProperty(w,'indexedDB',{value:indexedDB});w.confirm=()=>true;
 const revoked=[],active=new Set();let sequence=0;w.URL.createObjectURL=()=>{const u='blob:fixture-'+(++sequence);active.add(u);return u;};w.URL.revokeObjectURL=u=>{revoked.push(u);active.delete(u);};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let gpsCalls=0;Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(resolve){gpsCalls++;resolve({coords:{latitude:18,longitude:-97,accuracy:20}});}}});
 const principal={uid:'agent',organizationId:'org',role:'agent',propertyIds:[]},service=createTerritoryService({db}),handler=createAttentionHttp({service:{},territoryService:service,authority:{session:async()=>({organizations:[{id:'org',name:'Fixture'}]}),agent:async()=>principal}});
 const auth={currentUser:{uid:'agent',getIdToken:async()=>'token'},onAuthStateChanged(fn){this.changed=fn;queueMicrotask(()=>fn(this.currentUser));},async signOut(){this.currentUser=null;this.changed(null);}};const app={auth:()=>auth};w.firebase={apps:[app],app:()=>app};w.SYNAPSE_ATTENTION_CONFIG={firebase:{}};
 const requests=[];let offline=fail,loseReply=false;
 w.fetch=async(url,request)=>{requests.push({url,body:request.body});if(offline&&url.includes('/territory/'))throw Error('Offline');const req={url,method:request.method||'GET',headers:{'content-type':'application/json',authorization:request.headers.Authorization},rawBody:Buffer.from(request.body||'')},res={setHeader(){},end(raw){this.body=JSON.parse(raw)}};await handler(req,res);if(loseReply&&url.endsWith('/save')){loseReply=false;throw Error('Reply lost');}return {ok:res.statusCode===200,json:async()=>res.body};};
 for(const f of ['shared/territory-model.js','web/territory/local-drafts.js','web/territory/territory.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
 const el=id=>d.getElementById(id);t.after(()=>w.close());await until(()=>!el('territory-workspace').hidden&&(el('status').textContent.includes('actualizadas')||el('status').textContent.includes('conexión')));
 function set(id,value){el(id).value=value;el(id).dispatchEvent(new w.Event('input',{bubbles:true}));}
 const submit=()=>el('capture-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 async function settle(){await until(()=>!el('save-local').disabled);}
 return {w,d,el,db,service,principal,auth,indexedDB,requests,set,submit,settle,active,revoked,gpsCalls:()=>gpsCalls,offline:v=>offline=v,loseReply:()=>loseReply=true};
}
test('IndexedDB drafts preserve original blobs and isolate accounts and organizations',async()=>{
 const indexedDB=new IDBFactory(),a=D.create({indexedDB,organizationId:'org',uid:'A'}),b=D.create({indexedDB,organizationId:'org',uid:'B'}),c=D.create({indexedDB,organizationId:'other',uid:'A'});
 await a.put({id:'capture',files:{photo:new Blob(['original'],{type:'image/jpeg'})}});assert.equal(await (await a.list())[0].files.photo.text(),'original');assert.deepEqual(await b.list(),[]);assert.deepEqual(await c.list(),[]);await Promise.all([a.close(),b.close(),c.close()]);
 await assert.rejects(D.create({indexedDB:null,organizationId:'org',uid:'A'}).list(),/UNAVAILABLE/);
});
test('offline capture, original photo, reload and sync keep separate locations and never upload image bytes',async t=>{
 const f=await fixture(t);assert.equal(f.gpsCalls(),0);f.el('new-capture').click();f.set('capture-name','PRIVATE_FIELD');f.set('contact-name','PRIVATE_CONTACT');
 f.el('tab-location').click();f.el('capture-gps').click();await f.settle();assert.equal(f.gpsCalls(),1);assert.equal(f.el('property-lat').value,'');f.set('property-lat','19');f.set('property-lng','-98');
 f.el('tab-photos').click();Object.defineProperty(f.el('photo-files'),'files',{value:[new File(['ORIGINAL_PRIVATE_BYTES'],'original.jpg',{type:'image/jpeg'})]});f.el('photo-files').dispatchEvent(new f.w.Event('change'));await f.settle();
 const editorUrl=f.el('capture-photos').querySelector('img').src;f.offline(true);f.el('save-local').click();await f.settle();assert.ok(f.active.has(editorUrl));assert.match(f.el('status').textContent,/guardados/);f.el('close-capture').click();
 const g=await fixture(t,{indexedDB:f.indexedDB,db:f.db});g.el('capture-list').querySelector('button').click();assert.equal(g.el('capture-name').value,'PRIVATE_FIELD');assert.equal(g.el('capture-lat').value,'18');assert.equal(g.el('property-lat').value,'19');assert.equal(g.el('capture-photos').querySelectorAll('img').length,1);
 g.submit();await g.settle();assert.match(g.el('status').textContent,/Datos y seguimiento guardados/);const saved=(await g.service.list(g.principal,{})).captures[0];assert.equal(saved.captureLocation.lat,18);assert.equal(saved.propertyLocation.lat,19);assert.equal(saved.photos[0].photoLocation,null);assert.ok(!JSON.stringify(g.requests).includes('ORIGINAL_PRIVATE_BYTES'));
 g.el('close-capture').click();g.el('view-photos').click();assert.equal(g.el('photo-library').hidden,false);assert.equal(g.el('photo-library').querySelectorAll('img').length,1);g.el('logout').click();await until(()=>g.el('territory-workspace').hidden);for(const token of ['PRIVATE_FIELD','PRIVATE_CONTACT'])assert.ok(!g.d.body.textContent.includes(token));assert.equal(g.el('capture-name').value,'');assert.equal(g.active.size,0);
});
test('lost save response reuses request id and creates one history event',async t=>{
 const f=await fixture(t);f.el('new-capture').click();f.set('capture-name','Retry fixture');f.loseReply();f.submit();await f.settle();assert.match(f.el('status').textContent,/conexión/);f.submit();await f.settle();assert.match(f.el('status').textContent,/Datos y seguimiento guardados/);const saves=f.requests.filter(r=>r.url.endsWith('/save')).map(r=>JSON.parse(r.body));assert.equal(saves.length,2);assert.equal(saves[0].requestId,saves[1].requestId);const c=(await f.service.list(f.principal,{})).captures[0];assert.equal(c.version,1);assert.equal(Object.keys(c.history).length,1);
});
test('stale edit keeps a separate local copy before opening remote version, and tabs support keyboard',async t=>{
 const f=await fixture(t);f.el('new-capture').click();f.set('capture-name','Original');f.submit();await f.settle();let capture=(await f.service.list(f.principal,{})).captures[0];await f.service.save(f.principal,{requestId:'another-device',expectedVersion:1,capture:{...capture,title:'Remote edit'}});
 f.set('capture-name','Local edit');f.submit();await f.settle();assert.equal(f.el('resolve-conflict').hidden,false);f.el('resolve-conflict').click();await f.settle();assert.equal(f.el('capture-name').value,'Remote edit');assert.match(f.el('capture-list').textContent,/Local edit · copia local/);assert.equal((await f.service.list(f.principal,{})).captures.length,1);
 f.el('tab-record').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.el('panel-location').hidden,false);assert.equal(f.d.activeElement.id,'tab-location');assert.equal(f.el('tab-record').tabIndex,-1);
});
test('invalid photo coordinates reveal photo panel and cannot silently save old location',async t=>{
 const f=await fixture(t);f.el('new-capture').click();Object.defineProperty(f.el('photo-files'),'files',{value:[new File(['fixture'],'fixture.jpg',{type:'image/jpeg'})]});f.el('photo-files').dispatchEvent(new f.w.Event('change'));await f.settle();const lat=f.el('capture-photos').querySelector('input[type=number]');lat.value='18';lat.dispatchEvent(new f.w.Event('input'));f.el('tab-record').click();f.el('save-local').click();await f.settle();assert.equal(f.el('panel-photos').hidden,false);assert.equal(f.el('capture-photos').querySelector('details').open,true);assert.equal(f.el('capture-list').querySelectorAll('article').length,0);
});
test('a late GPS callback after sign out cannot refill private location fields',async t=>{
 const f=await fixture(t);let resolveGps;Object.defineProperty(f.w.navigator.geolocation,'getCurrentPosition',{value:resolve=>{resolveGps=resolve;}});f.el('new-capture').click();f.el('capture-gps').click();await until(()=>Boolean(resolveGps));await f.auth.signOut();resolveGps({coords:{latitude:18.111,longitude:-97.222,accuracy:10}});await f.settle();assert.equal(f.el('capture-lat').value,'');assert.equal(f.el('capture-lng').value,'');assert.equal(f.el('territory-workspace').hidden,true);
});
