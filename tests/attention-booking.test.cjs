'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const M=require('../shared/workspace-model.js'),A=require('../shared/visit-availability.js'),B=require('../shared/attention-booking.js'),R=require('../shared/workspace-radar.js');
const{database}=require('./helpers/workspace-db.cjs'),{createAttentionStore}=require('../server/attention-store.cjs'),{createAttentionService}=require('../server/attention-service.cjs');
const now=()=>new Date('2026-10-28T18:00:00Z');
const context={organizationId:'org',conversationId:'conversation',propertyId:'yin',originalPropertyId:'yin',source:'marketplace_facebook',entryChannel:'messenger'};
const input={name:'Persona de prueba',phone:'2389999999',contactId:'',date:'2026-10-29',time:'11:00',confirmed:true};
function setup(extra={}){const db=database({leads:{},citas:{},citas_publicas:{},telefonos_index:{},propiedades:{yin:{nombre:'Studio de prueba',activo:true,precio:2800}},disponibilidad:{horarios:{duracionMin:30,jue:{activo:true,rangos:[{inicio:'09:00',fin:'20:00'}]},vie:{activo:true,inicio:'09:00',fin:'20:00'}},bloqueos:{}},...extra});return{db,booking:B.create(db,{uid:'owner',now})};}
test('a visit links one Directory contact, Agenda event, canonical RSV folio and Radar action',async()=>{
 const f=setup(),before=await f.booking.read(context);assert.ok(before.days[0].times.includes('11:00'));
 const saved=await f.booking.book(context,input),e=saved.event;assert.equal(e.estado,'confirmada');assert.match(e.folio,/^RSV-/);assert.equal(e._agenda.sync,'ready');assert.equal(e.attentionRef.organizationId,'org');assert.equal(e.attentionRef.source,'marketplace_facebook');assert.equal(Object.keys(f.db.data.leads).length,1);assert.deepEqual(f.db.data.leads[e.participantes[0]]._synapse.categorias,['prospecto']);
 assert.equal(R.build(f.db.data,now()).items.filter(item=>item.eventId===e.id).length,1);
 assert.match(B.confirmation(e,f.db.data.leads,f.db.data.propiedades),new RegExp(e.folio));assert.match(B.confirmation(e,f.db.data.leads,f.db.data.propiedades),/Persona de prueba/);
 const publicJson=JSON.stringify(f.db.data.citas_publicas);for(const privateValue of ['Persona de prueba','2389999999','conversation','marketplace_facebook','owner'])assert.ok(!publicJson.includes(privateValue));
 const retry=await f.booking.book(context,input);assert.equal(retry.replayed,true);assert.equal(retry.event.id,e.id);assert.equal(Object.keys(f.db.data.citas).length,1);assert.equal(Object.keys(f.db.data.leads).length,1);
});
test('existing contacts require an explicit choice and retain roles, notes and identity',async()=>{
 const leads={person:{nombre:input.name,telefono:input.phone,notas:'Historia existente',tipo:'Propietario',unknown:{keep:true},_synapse:{version:4,categorias:['cliente','proveedor']}}},f=setup({leads});
 await assert.rejects(f.booking.book(context,input),/DUPLICATE_CONTACT/);assert.equal(Object.keys(f.db.data.citas).length,0);
 await f.booking.book(context,{...input,contactId:'person'});assert.equal(Object.keys(f.db.data.leads).length,1);assert.deepEqual(f.db.data.leads.person,leads.person);
 const g=setup({leads});await assert.rejects(g.booking.book(context,{...input,contactId:'person',phone:'2381111111'}),/CONTACT_DETAILS_MISMATCH/);assert.equal(Object.keys(g.db.data.citas).length,0);
});
test('same phone and property with a legacy active visit requires review rather than a second booking',async()=>{
 const f=setup({leads:{legacy:{nombre:input.name,telefono:input.phone}},citas:{prior:{nombre:input.name,telefono:input.phone,propiedadId:'yin',leadId:'legacy',fecha:'2026-10-30',hora:'13:00',estado:'pendiente'}}});
 await assert.rejects(f.booking.book(context,{...input,contactId:'legacy'}),/EXISTING_VISIT_REVIEW/);assert.equal(Object.keys(f.db.data.citas).length,1);
});
test('fresh occupancy, blocks, inactive properties and off-window days prevent saving',async()=>{
 for(const alter of [f=>f.db.data.citas_publicas['2026-10-29_11:00']={citaId:'other'},f=>f.db.data.disponibilidad.bloqueos['2026-10-29']=['11:00'],f=>f.db.data.propiedades.yin.activo=false]){
  const f=setup();await f.booking.read(context);alter(f);await assert.rejects(f.booking.book(context,input),/SLOT_NOT_AVAILABLE|PROPERTY_NOT_PUBLISHED/);assert.deepEqual(f.db.data.citas,{});assert.deepEqual(f.db.data.leads,{});
 }
 const f=setup();await assert.rejects(f.booking.book(context,{...input,date:'2026-10-28'}),/SLOT_NOT_AVAILABLE/);await assert.rejects(f.booking.book(context,{...input,confirmed:false}),/BOOKING_CONFIRMATION_REQUIRED/);
});
test('shared availability uses occupied intervals, partial blocks, travel and local business dates',()=>{
 const snapshot={horario:{duracionMin:30,bufferMin:10,velocidadKmH:25,jue:{activo:true,inicio:'09:00',fin:'13:00'}},propiedades:{a:{lat:18.46,lng:-97.38},b:{lat:18.5,lng:-97.42}},bloqueos:{'2026-10-29':['09:15']},ocupados:{'2026-10-29_11:10':{inicioMin:670,finMin:710,propiedadId:'b'}}};
 const times=A.slots(snapshot,'a','2026-10-29',now());assert.ok(!times.includes('09:00'));assert.ok(!times.includes('09:30'));assert.ok(!times.includes('11:00'));assert.ok(!times.includes('11:30'));assert.ok(!times.includes('12:00'));assert.ok(times.includes('12:30'));
 assert.equal(A.windowDays(new Date('2026-10-29T02:00:00Z'))[0],'2026-10-29');assert.equal(A.windowDays(now()).length,14);
});
test('a private save failure keeps the contact for recovery and releases only its own occupancy',async()=>{
 const f=setup({citas_publicas:{'2026-10-29_15:00':{citaId:'untouched'}}});f.db.failWhen(path=>path.startsWith('citas/'));
 await assert.rejects(f.booking.book(context,input),/DATABASE_OFFLINE/);assert.equal(Object.keys(f.db.data.leads).length,1);assert.deepEqual(f.db.data.citas,{});assert.equal(f.db.data.citas_publicas['2026-10-29_15:00'].citaId,'untouched');assert.equal(f.db.data.citas_publicas['2026-10-29_11:00'],undefined);
 await f.booking.book(context,input);assert.equal(Object.keys(f.db.data.leads).length,1);assert.equal(Object.keys(f.db.data.citas).length,1);
});
test('a lost private save response reuses the event and exposes pending synchronization for explicit repair',async()=>{
 const f=setup(),original=f.db.ref.bind(f.db);let failed=false;
 f.db.ref=path=>{const ref=original(path);return path.startsWith('citas/')?{...ref,async transaction(reducer,...args){const r=await ref.transaction(reducer,...args);if(!failed){failed=true;throw Error('LOST_RESPONSE');}return r;}}:ref;};
 const result=await f.booking.book(context,input);assert.equal(result.pendingSync,true);assert.equal(Object.keys(f.db.data.citas).length,1);assert.throws(()=>B.confirmation(result.event,f.db.data.leads,f.db.data.propiedades),/SYNC_PENDING/);
 const repaired=await f.booking.repair(context);assert.equal(repaired.event._agenda.sync,'ready');assert.equal(Object.keys(f.db.data.citas).length,1);assert.ok(f.db.data.citas_publicas['2026-10-29_11:00']);
});
test('two tabs creating visits for the same conversation cannot produce two events',async()=>{
 const f=setup(),other=B.create(f.db,{uid:'owner',now});const results=await Promise.allSettled([f.booking.book(context,input),other.book(context,{...input,time:'12:00'})]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(Object.keys(f.db.data.citas).length,1);assert.equal(Object.keys(f.db.data.leads).length,1);
 const e=Object.values(f.db.data.citas)[0];assert.equal(e._agenda.sync,'ready');const keys=Object.keys(f.db.data.citas_publicas);assert.equal(keys.length,1);assert.equal(keys[0],e.fecha+'_'+e.hora);
});
test('read failures and a changed authentication session stop all booking writes',async()=>{
 const f=setup(),original=f.db.ref.bind(f.db);f.db.ref=path=>path==='disponibilidad/bloqueos'?{async get(){throw Error('PERMISSION_DENIED');}}:original(path);
 await assert.rejects(f.booking.read(context),/PERMISSION_DENIED/);assert.equal(f.db.writes.length,0);
 let uid='owner';const g=setup(),booking=B.create(g.db,{uid,getUid:()=>uid,now,hash:async value=>{uid=null;return createHash('sha256').update(JSON.stringify(value)).digest('hex');}});
 await assert.rejects(booking.book(context,input),/AUTHENTICATION_REQUIRED/);assert.equal(g.db.writes.length,0);
});
test('server journal accepts only a committed, scoped Agenda event and records its actual folio once',async()=>{
 const f=setup(),saved=await f.booking.book(context,input),store=createAttentionStore(f.db),principal={uid:'owner',role:'agent',organizationId:'org',propertyIds:['yin']};
 const service=createAttentionService({store,now,invitationBaseUrl:'https://example.test',readAvailability:async()=>({properties:f.db.data.propiedades,observedAt:now().toISOString()}),readAgendaEvent:async id=>f.db.data.citas[id]});
 await service.capture(principal,{requestId:'conversation',propertyId:'yin',displayName:'Alias de origen',source:'marketplace_facebook',entryChannel:'messenger'});
 const command={requestId:'journal-'+saved.event.id,conversationId:'conversation',eventId:saved.event.id};
 await assert.rejects(service.recordVisit({...principal,uid:'different'},command),/BOOKING_REFERENCE_CONFLICT/);
 f.db.data.citas[saved.event.id]._agenda.sync='pending';await assert.rejects(service.recordVisit(principal,command),/BOOKING_NOT_READY/);f.db.data.citas[saved.event.id]._agenda.sync='ready';
 await service.recordVisit(principal,command);await service.recordVisit(principal,command);await service.recordVisit(principal,{...command,requestId:'other-request'});
 const inspected=await service.inspect(principal,'conversation');assert.equal(inspected.conversation.visit.eventId,saved.event.id);assert.equal(inspected.journal.filter(e=>e.kind==='reservation_registered').length,1);assert.deepEqual((await service.report(principal,'2026-10-28')).reservations,[saved.event.folio]);assert.equal(Object.keys(f.db.data.citas).length,1);
 await assert.rejects(service.recordVisit(principal,{...command,folio:'invented'}),/INVALID_FIELDS/);
});
