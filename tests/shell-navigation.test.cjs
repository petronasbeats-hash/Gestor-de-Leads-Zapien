'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {JSDOM}=createRequire(path.resolve(__dirname,'../lab/workspace/package.json'))('jsdom');
const root=path.resolve(__dirname,'..'),script=fs.readFileSync(path.join(root,'web/shell/navigation.js'),'utf8');
function shell(t,route,html='<body><div id="synapse-shell"></div>'){
 const dom=new JSDOM(html,{url:'https://synapse.example'+route,runScripts:'outside-only'});t.after(()=>dom.window.close());dom.window.eval(script);return dom;
}
test('one primary menu groups operations under Directory and settings outside daily work',t=>{
 for(const [route,current] of [['/','radar'],['/operaciones','contacts'],['/contactos','contacts'],['/agenda/horarios','agenda'],['/inmuebles','properties'],['/territorio','territory'],['/destaca','destaca'],['/configuracion','settings']]){
  const {window:w}=shell(t,route),d=w.document;
  assert.deepEqual([...d.querySelectorAll('.synapse-primary a')].map(a=>a.textContent),['Radar','Atención','Agenda','Directorio','Inmuebles','Territorio','Destaca']);
  assert.equal(d.querySelectorAll('[aria-current=page]').length,1);assert.equal(d.querySelector('[aria-current=page]').id,'nav-'+current);
  assert.ok([...d.querySelectorAll('.synapse-primary a')].every(a=>!a.target));
 }
});
test('menu blocks leaving an open dialog and native page-leave warning protects an unsent agent response',t=>{
 const {window:w}=shell(t,'/atencion-operador','<body data-role="agent"><div id="synapse-shell"></div><textarea id="message"></textarea><textarea id="summary"></textarea><dialog open tabindex="-1"></dialog>'),d=w.document;
 const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});d.getElementById('nav-contacts').dispatchEvent(click);assert.equal(click.defaultPrevented,true);
 d.querySelector('dialog').removeAttribute('open');
 const clean=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(clean);assert.equal(clean.defaultPrevented,false);
 d.getElementById('message').value='Unsent customer response';const dirty=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(dirty);assert.equal(dirty.defaultPrevented,true);
 d.getElementById('message').value='';const sent=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(sent);assert.equal(sent.defaultPrevented,false);
});
test('existing admin routes open exactly the property or availability tool; maintenance keeps old tools reachable',t=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),admin=fs.readFileSync(path.join(root,'web/shell/admin-navigation.js'),'utf8');
 for(const [route,tool,title] of [['/inmuebles','propiedades','Inmuebles'],['/agenda/horarios','disponibilidad','Agenda · Horarios y bloqueos'],['/configuracion',null,'Configuración'],['/administracion?legacy=1',null,'Administración anterior']]){
  const {window:w}=shell(t,route,html),d=w.document;let clicks=[];
  d.getElementById('view-tab-citas').addEventListener('click',()=>clicks.push('citas'));
  d.querySelectorAll('.admin-tab-btn').forEach(b=>b.addEventListener('click',()=>clicks.push(b.dataset.tab)));
  w.eval(admin);assert.equal(d.getElementById('admin-module-title').textContent,title);
  assert.deepEqual(clicks,tool?['citas',tool]:[]);
  assert.equal(d.getElementById('configuration-home').hidden,route!=='/configuracion');
  assert.equal(d.getElementById('p-nombre').closest('details').id,'property-editor');
  assert.equal(d.getElementById('property-editor').closest('.property-workbench')?.className,'property-workbench');
  assert.ok(d.querySelector('a[href="/administracion?legacy=1"]'));
 }
});

test('progressive navigation collapses without storing client data and keeps grouped functions reachable',t=>{const{window:w}=shell(t,'/'),d=w.document;assert.deepEqual([...d.querySelectorAll('.shell-group>summary')].map(e=>e.textContent),['Día a día','Gestión']);d.querySelector('.shell-collapse').click();assert.equal(d.body.classList.contains('shell-collapsed'),true);assert.equal(w.localStorage.getItem('synapse.shell.v1'),'collapsed');assert.equal(d.querySelector('.shell-new').getAttribute('href'),'/atencion-operador?new=1');d.querySelector('.shell-collapse').click();assert.equal(d.body.classList.contains('shell-collapsed'),false);});
