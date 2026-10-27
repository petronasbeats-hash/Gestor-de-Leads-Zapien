'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
function mount(){
  const template=fs.readFileSync(path.join(__dirname,'preview.fragment.html'),'utf8');
  const core=fs.readFileSync(path.join(__dirname,'continuity-contract.js'),'utf8');
  const data=fs.readFileSync(path.join(__dirname,'fixtures/public-snapshot.json'),'utf8');
  const fragment=template.replace('/* CONTINUITY_CORE */',core).replace('/* PUBLIC_SNAPSHOT */',data);
  const script=fragment.match(/<script>([\s\S]*?)<\/script>/)[1];
  const selectIds=new Set(['sc-source','sc-channel','sc-property','sc-day','sc-initial-question']);
  class Element{
    constructor(id){this.id=id;this.value='';this.textContent='';this.children=[];this.handlers={};this.attrs={};this.hidden=false;this.disabled=false;}
    append(...nodes){for(const node of nodes){this.children.push(node);if(selectIds.has(this.id)&&!this.value)this.value=node.value;}}
    replaceChildren(...nodes){this.children=[];if(selectIds.has(this.id))this.value='';this.append(...nodes);}
    addEventListener(type,handler){this.handlers[type]=handler;}
    setAttribute(name,value){this.attrs[name]=value;}
    async trigger(type){return this.handlers[type]({preventDefault(){}});}
  }
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const root={querySelector:selector=>get(selector.slice(1)),classList:{toggle(){}}};
  get('sc-initial-question').value='¿Sigue disponible?';
  vm.runInNewContext(script,{document:{getElementById:()=>root,createElement:()=>new Element()},crypto,URL,Intl,console},{timeout:1000});
  return get;
}
test('Carga las once publicaciones y los días consultados de Reservar',()=>{const e=mount();assert.equal(e('sc-property').children.length,11);assert.match(e('sc-property-name').textContent,/YIN 05/);assert.equal(e('sc-day').value,'2026-10-27');assert.equal(e('sc-times').children[0].textContent,'09:00');});
test('Las fechas exportadas corresponden al día activo del calendario de Tehuacán',()=>{const data=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/public-snapshot.json'),'utf8'));const dayKeys=['dom','lun','mar','mie','jue','vie','sab'];for(const days of Object.values(data.slotsByProperty))for(const day of days){assert.equal(data.horario[dayKeys[new Date(day.dateKey+'T12:00:00Z').getUTCDay()]].activo,true);}});
test('Invitación sin teléfono, continuidad y reserva requieren datos al final',async()=>{
  const e=mount();e('sc-name').value='Contacto de prueba';
  await e('sc-start-form').trigger('submit');
  assert.equal(e('sc-invite').hidden,false);assert.match(e('sc-link-label').textContent,/DEMO_/);
  assert.ok(!e('sc-link-label').textContent.includes('Contacto de prueba'));
  await e('sc-open-invite').trigger('click');assert.equal(e('sc-entry-pane').hidden,true);
  await e('sc-times').children[0].trigger('click');assert.equal(e('sc-identity').hidden,false);
  await e('sc-booking-form').trigger('submit');assert.match(e('sc-book-status').textContent,/número de contacto/);
  e('sc-book-phone').value='2380000000';
  await e('sc-booking-form').trigger('submit');
  assert.match(e('sc-folio').textContent,/^DEMO-RSV-/);assert.match(e('sc-next').textContent,/Dar seguimiento al folio/);
  const folio=e('sc-folio').textContent;const count=e('sc-messages').children.length;
  await e('sc-booking-form').trigger('submit');assert.equal(e('sc-folio').textContent,folio);assert.equal(e('sc-messages').children.length,count);
  await e('sc-agent-view').trigger('click');assert.equal(e('sc-origin').textContent,'Marketplace Facebook');assert.equal(e('sc-origin-channel').textContent,'Messenger');
});
test('Cambiar día limpia el horario y la pregunta frecuente prepara una respuesta',async()=>{
  const e=mount();await e('sc-times').children[0].trigger('click');assert.equal(e('sc-identity').hidden,false);
  e('sc-day').value='2026-10-30';await e('sc-day').trigger('change');assert.equal(e('sc-identity').hidden,true);
  await e('sc-faq').children[0].trigger('click');assert.match(e('sc-message').value,/publicación/);
});
test('Conserva el origen al cambiar el inmueble de interés',async()=>{
  const e=mount();await e('sc-start-form').trigger('submit');const original=e('sc-original-property').textContent;
  e('sc-property').value=e('sc-property').children[0].value;await e('sc-property').trigger('change');
  assert.equal(e('sc-original-property').textContent,original);assert.notEqual(e('sc-property-name').textContent,original);assert.equal(e('sc-origin').textContent,'Marketplace Facebook');
});
