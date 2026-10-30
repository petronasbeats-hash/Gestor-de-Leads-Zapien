'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {JSDOM}=createRequire(path.resolve(__dirname,'../lab/workspace/package.json'))('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fixture(t,options={}){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://synapse.example/inmuebles'}),w=dom.window,d=w.document;
 t.after(()=>w.close());
 const uploads=[];
 w.storage=options.noStorage?null:{ref:()=>({child:key=>({async put(file){uploads.push({key,name:file.name});if(options.reject?.includes(file.name))throw Error('Carga rechazada por permisos');},async getDownloadURL(){return 'https://images.example/'+uploads[uploads.length-1].name;}})})};
 w.auth={currentUser:options.signedOut?null:{uid:'owner'}};w.PHOTO_ROLES=['PORTADA'];w.escapeHtml=String;
 w.eval('let photoMetaDraft=[];'+html.slice(html.indexOf('function getFotosUrls(){'),html.indexOf("document.getElementById('btn-add-propiedad').addEventListener('click'")));
 return {w,d,uploads,async select(names){const input=d.getElementById('p-fotos-file');Object.defineProperty(input,'files',{configurable:true,value:names.map(name=>new w.File(['fixture'],name,{type:'image/jpeg'}))});input.dispatchEvent(new w.Event('change'));for(let i=0;i<100;i++){if(!d.getElementById('p-fotos-upload-status').textContent.startsWith('Subiendo'))return;await new Promise(r=>setTimeout(r,1));}assert.fail('Upload did not settle');}};
}
test('property editor exposes a native, labelled, keyboard-accessible photo selector',t=>{
 const f=fixture(t),input=f.d.getElementById('p-fotos-file');
 assert.equal(input.type,'file');assert.equal(input.multiple,true);assert.equal(input.accept,'image/*');
 assert.notEqual(f.w.getComputedStyle(input).display,'none');assert.equal(input.hidden,false);assert.notEqual(input.tabIndex,-1);
 assert.match(f.d.querySelector('label[for="p-fotos-file"]').textContent,/Seleccionar fotos/);
 assert.equal(f.d.getElementById('p-fotos-upload-status').getAttribute('role'),'status');
 assert.match(f.d.getElementById('p-fotos-help').textContent,/Guardar cambios/);
});
test('selected photos append to the current draft and remain explicitly pending property save',async t=>{
 const f=fixture(t);f.d.getElementById('p-fotos').value='https://images.example/existing.jpg';
 await f.select(['room.jpg','terrace.jpg']);
 assert.equal(f.uploads.length,2);assert.equal(f.d.getElementById('p-fotos').value,'https://images.example/existing.jpg\nhttps://images.example/room.jpg\nhttps://images.example/terrace.jpg');
 assert.equal(f.d.querySelectorAll('#p-fotos-thumbs img').length,3);
 assert.match(f.d.getElementById('p-fotos-upload-status').textContent,/2 de 2.*Guardar cambios/);
 assert.equal(f.d.getElementById('p-fotos-file').value,'');
});
test('failed and partially successful uploads retain an actionable status and preserve existing photos',async t=>{
 const f=fixture(t,{reject:['blocked.jpg']});f.d.getElementById('p-fotos').value='https://images.example/existing.jpg';
 await f.select(['blocked.jpg']);assert.equal(f.d.getElementById('p-fotos').value,'https://images.example/existing.jpg');
 assert.match(f.d.getElementById('p-fotos-upload-status').textContent,/No se cargó ninguna foto.*blocked.jpg.*permisos/);
 await f.select(['room.jpg','blocked.jpg']);assert.equal(f.d.getElementById('p-fotos').value,'https://images.example/existing.jpg\nhttps://images.example/room.jpg');
 assert.match(f.d.getElementById('p-fotos-upload-status').textContent,/1 de 2.*Guardar cambios.*blocked.jpg/);
});
test('missing storage or session leaves a visible reason without attempting uploads',async t=>{
 for(const options of [{noStorage:true},{signedOut:true}]){const f=fixture(t,options);await f.select(['room.jpg']);assert.equal(f.uploads.length,0);assert.match(f.d.getElementById('p-fotos-upload-status').textContent,/almacenamiento|sesión/);assert.equal(f.d.getElementById('p-fotos-file').value,'');}
});
