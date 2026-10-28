(function(root,factory){const model=typeof module==='object'&&module.exports?require('./workspace-model.js'):root.SynapseWorkspace;const inventory=typeof module==='object'&&module.exports?require('./property-inventory.js'):root.SynapsePropertyInventory;const api=factory(model,inventory);if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseWorkspaceStore=api;})(typeof globalThis==='undefined'?this:globalThis,function(M,P){
  'use strict';
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  async function digest(value){const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
  function create(db,{uid,getUid=()=>uid,now=()=>new Date(),hash=digest}={}){
    M.id(uid);let queue=Promise.resolve();
    function session(){if(getUid()!==uid)throw Error('AUTHENTICATION_REQUIRED');}
    const serial=action=>{const run=queue.catch(()=>{}).then(()=>{session();return action();});queue=run;return run;};
    async function context(operation,input){session();return{uid,requestId:M.id(input.requestId),now:now().toISOString(),hash:await hash({uid,operation,input})};}
    async function tx(path,reduce,{allowEmpty=false}={}){
      session();let failure,value,empty=false;
      const result=await db.ref(path).transaction(current=>{
        failure=undefined;value=undefined;empty=current===null;
        // A null callback can precede loading remote data. Returning null is a
        // no-op seed; the server CAS loads any real root before the reducer runs.
        if(current===null&&!allowEmpty)return null;
        try{session();const next=reduce(M.clone(current||{}));value=next.value;return next.state;}
        catch(error){failure=error;return undefined;}
      },undefined,false);
      session();if(failure)throw failure;if(!result.committed)throw Error('TRANSACTION_NOT_COMMITTED');if(empty&&!allowEmpty&&result.snapshot.val()===null)throw Error('CONTACT_NOT_FOUND');return value;
    }
    async function contactCommand(kind,input){const ctx=await context(kind,input);return tx('leads',state=>{const r=kind==='contact'?M.saveContact(state,input,ctx):kind==='operation'?M.saveOperation(state,input,ctx):kind==='followup'?M.completeFollowup(state,input,ctx):M.advanceOperation(state,input,ctx,events);return{state:r.state,value:r.receipt};},{allowEmpty:kind==='contact'&&input.expectedVersion===0});}
    let events=[];
    async function root(){const snap=await db.ref('leads').get();session();return snap.val()||{};}
    function own(v,key){return v&&v.citaId===key;}
    async function saveEventInternal(input){
      const ctx=await context('event',input),event=M.eventInput(input,ctx),key=event.id,lockKey='_agenda_'+key;
      const [h,b,c,l]=await Promise.all(['disponibilidad/horarios','disponibilidad/bloqueos','citas','leads'].map(p=>db.ref(p).get()));session();
      const horario=h.val();if(!horario||!Number.isFinite(Number(horario.duracionMin)))throw Error('AVAILABILITY_UNAVAILABLE');
      const contactos=l.val()||{},citas=c.val()||{},old=citas[key],r=M.range(event,horario.duracionMin);
      for(const contactId of event.participantes)if(!contactos[contactId])throw Error('CONTACT_NOT_FOUND');
      if(event.tipoEvento==='visita'&&M.active(event)&&!event.participantes.some(i=>{try{return!!M.phone(contactos[i].telefono);}catch{return false;}}))throw Error('PHONE_REQUIRED');
      if(event.tipoEvento==='visita'&&M.active(event)){const prop=(await db.ref('propiedades/'+event.propiedadId).get()).val();session();if(!prop||prop.activo===false)throw Error('PROPERTY_NOT_PUBLISHED');if(!P.canVisit(prop))throw Error('PROPERTY_NOT_AVAILABLE');}
      if(event.operationRef&&!contactos[event.operationRef.ownerContactId]?._synapse?.operaciones?.[event.operationRef.id])throw Error('OPERATION_NOT_FOUND');
      if(old?._agenda?.sync==='pending'&&old._agenda.lastRequestId!==ctx.requestId)throw Error('SYNC_PENDING');
      if(old?._agenda?.lastRequestId!==ctx.requestId){
        if((old?.version||0)!==input.expectedVersion||Boolean(old)!==Boolean(input.existing))throw Error('VERSION_CONFLICT');
        if(old&&(old.fecha!==event.fecha||old.hora!==event.hora||old.horaFin&&old.horaFin!==event.horaFin||event.estado==='cancelada'&&old.estado!=='cancelada')&&!event.motivo)throw Error('CHANGE_REASON_REQUIRED');
        if(r&&Object.entries(citas).some(([k,v])=>k!==key&&M.overlap(r,M.range(v,horario.duracionMin))))throw Error('SCHEDULE_CONFLICT');
        if(r&&(b.val()?.[event.fecha]||[]).some(t=>M.overlap(r,{date:event.fecha,start:M.minutes(t),end:M.minutes(t)+horario.duracionMin})))throw Error('SCHEDULE_CONFLICT');
      }
      const keys=M.slotKeys(event,horario),desired=new Set(keys),claim={agenda:true,citaId:key,...(event.tipoEvento==='visita'&&event.propiedadId?{propiedadId:event.propiedadId}:{}),estado:'ocupado',inicioMin:r?.start||0,finMin:r?.end||0,agendaRequestId:ctx.requestId};let before={},committed=false;
      await tx('citas_publicas',state=>{
        let reviewedLegacy;
        const legacyKey=old&&old.fecha+'_'+old.hora,legacy=legacyKey&&state[legacyKey];
        if(legacy&&!legacy.citaId){
          const knownShape=Object.keys(legacy).every(k=>['propiedadId','folio'].includes(k));
          const unique=Object.entries(citas).every(([id,c])=>id===key||!M.overlap(M.publicRange(legacyKey,legacy,horario.duracionMin),M.range(c,horario.duracionMin)));
          if(input.ackLegacySlot!==true||!knownShape||!old.propiedadId||legacy.propiedadId!==old.propiedadId||!unique)throw Error('LEGACY_SLOT_REVIEW');
          reviewedLegacy={...legacy};state[legacyKey]={...legacy,citaId:key};
        }
        const lock=state[lockKey];if(lock&&lock.requestId!==ctx.requestId&&Date.parse(lock.expiresAt)>Date.parse(ctx.now))throw Error('EVENT_BUSY');
        if(r&&M.publicConflict(state,event,horario.duracionMin))throw Error('SCHEDULE_CONFLICT');
        before=Object.fromEntries(Object.entries(state).filter(([,v])=>own(v,key)));if(reviewedLegacy)before[legacyKey]=reviewedLegacy;
        if(reviewedLegacy)state[legacyKey]={...state[legacyKey],agendaRequestId:ctx.requestId};
        state[lockKey]={agendaLock:true,requestId:ctx.requestId,expiresAt:new Date(Date.parse(ctx.now)+120000).toISOString()};
        for(const slot of keys){if(state[slot]&&!own(state[slot],key))throw Error('SCHEDULE_CONFLICT');state[slot]=claim;}
        return{state};
      },{allowEmpty:true});
      try{
        const saved=await tx('citas/'+key,state=>{
          const exists=Object.keys(state).length>0;
          if(state._agenda?.lastRequestId===ctx.requestId){if(state._agenda.hash!==ctx.hash)throw Error('COMMAND_CONFLICT');return{state,value:state};}
          if((state.version||0)!==input.expectedVersion||exists!==Boolean(input.existing))throw Error('VERSION_CONFLICT');
          const data={...state,...event,creado:state.creado||ctx.now,historial:{...state.historial,[ctx.requestId]:{tipo:exists?'agenda_actualizada':'agenda_creada',fecha:ctx.now,actorUid:uid,estado:event.estado,motivo:event.motivo,resultado:event.resultado,legacySlotReviewed:input.ackLegacySlot===true,anterior:exists?{fecha:state.fecha||'',hora:state.hora||'',horaFin:state.horaFin||'',estado:state.estado||''}:null}},_agenda:{sync:'pending',lastRequestId:ctx.requestId,hash:ctx.hash,pendingInput:input}};
          return{state:data,value:data};
        },{allowEmpty:!input.existing});
        committed=true;
        await tx('citas_publicas',state=>{
          if(state[lockKey]?.requestId!==ctx.requestId)throw Error('SYNC_PENDING');
          for(const slot of keys)if(!own(state[slot],key)||state[slot].agendaRequestId!==ctx.requestId)throw Error('SYNC_PENDING');
          for(const [slot,value] of Object.entries(state))if(own(value,key)){
            if(desired.has(slot)){const v={...claim};delete v.agendaRequestId;state[slot]=v;}
            else delete state[slot];
          }
          delete state[lockKey];return{state};
        });
        await tx('citas/'+key,state=>{if(state._agenda?.lastRequestId!==ctx.requestId)throw Error('SYNC_PENDING');state._agenda={sync:'ready',lastRequestId:ctx.requestId,hash:ctx.hash};return{state};});
        return{id:key,version:saved.version,pendingSync:false};
      }catch(error){
        if(committed)return{id:key,version:event.version,pendingSync:true};
        // Only undo this request's derived occupancy. Other reservations survive.
        try{await tx('citas_publicas',state=>{for(const [slot,v]of Object.entries(state))if(own(v,key)&&v.agendaRequestId===ctx.requestId){if(before[slot])state[slot]=before[slot];else delete state[slot];}if(state[lockKey]?.requestId===ctx.requestId)delete state[lockKey];return{state};},{allowEmpty:true});}catch{}
        throw error;
      }
    }
    async function closeHistoricalInternal(input){
      const ctx=await context('historical-close',input),key=M.id(input.id),lockKey='_agenda_'+key;
      if(!['realizada','cancelada','no_asistio'].includes(input.resolution))throw Error('EVENT_STATUS_INVALID');
      const result=M.text(input.result,2000,true),occurredDate=input.occurredDate?M.validDate(input.occurredDate):'';
      if(input.resolution!=='cancelada'&&!occurredDate&&input.unknownDate!==true)throw Error('CLOSURE_DATE_REQUIRED');
      if(occurredDate>M.calendarDate(now()))throw Error('EVENT_NOT_OCCURRED');
      const [privateSnap,hSnap]=await Promise.all([db.ref('citas').get(),db.ref('disponibilidad/horarios').get()]);session();
      const events=privateSnap.val()||{},old=events[key];if(!old)throw Error('EVENT_NOT_FOUND');
      const replay=old._agenda?.lastRequestId===ctx.requestId;
      if(replay&&old._agenda.hash!==ctx.hash)throw Error('COMMAND_CONFLICT');
      if(replay&&old._agenda.sync==='ready')return{id:key,version:old.version,pendingSync:false,occupancyReviewRequired:old._agenda.occupancyReviewRequired===true};
      if(!replay&&old._agenda?.sync==='pending')throw Error('SYNC_PENDING');
      if(!replay&&await hash(old)!==input.expectedFingerprint)throw Error('VERSION_CONFLICT');
      const snapshotJson=JSON.stringify(canonical(old));let before={},unresolved=false,committed=false;
      await tx('citas_publicas',state=>{
        unresolved=false;const lock=state[lockKey];if(lock&&lock.requestId!==ctx.requestId&&Date.parse(lock.expiresAt)>Date.parse(ctx.now))throw Error('EVENT_BUSY');
        const legacyKey=old.fecha+'_'+old.hora,legacy=state[legacyKey];
        before=Object.fromEntries(Object.entries(state).filter(([,v])=>own(v,key)));
        if(legacy&&!legacy.citaId){
          const duration=Number(hSnap.val()?.duracionMin),shape=legacy&&typeof legacy==='object'&&Object.keys(legacy).every(k=>['propiedadId','folio'].includes(k));
          const range=Number.isFinite(duration)&&duration>0?M.publicRange(legacyKey,legacy,duration):null;
          const unique=range&&Object.entries(events).every(([id,event])=>id===key||!M.overlap(range,M.range(event,duration)));
          if(input.ackLegacySlot===true&&shape&&unique&&old.propiedadId&&legacy.propiedadId===old.propiedadId){before[legacyKey]=legacy;state[legacyKey]={...legacy,citaId:key};}
          else unresolved=true;
        }
        state[lockKey]={agendaLock:true,requestId:ctx.requestId,expiresAt:new Date(Date.parse(ctx.now)+120000).toISOString()};
        for(const [slot,value]of Object.entries(state))if(own(value,key))state[slot]={...value,agendaRequestId:ctx.requestId};
        return{state};
      },{allowEmpty:true});
      try{
        const saved=await tx('citas/'+key,state=>{
          if(state._agenda?.lastRequestId===ctx.requestId){if(state._agenda.hash!==ctx.hash)throw Error('COMMAND_CONFLICT');return{state,value:state};}
          if(JSON.stringify(canonical(state))!==snapshotJson)throw Error('VERSION_CONFLICT');
          const data={...state,estado:input.resolution,resultado:result,version:(state.version||0)+1,updatedAt:ctx.now,updatedBy:uid,
            historial:{...state.historial,[ctx.requestId]:{tipo:'agenda_cierre_historico',fecha:ctx.now,actorUid:uid,estado:input.resolution,resultado:result,fechaReal:occurredDate||null,fechaRealDesconocida:input.resolution!=='cancelada'&&!occurredDate,estadoAnterior:state.estado||null,legacySlotReviewed:input.ackLegacySlot===true}},
            _agenda:{sync:'pending',pendingKind:'historical-close',lastRequestId:ctx.requestId,hash:ctx.hash,pendingInput:input,occupancyReviewRequired:unresolved}};
          return{state:data,value:data};
        });committed=true;
        await tx('citas_publicas',state=>{
          if(state[lockKey]?.requestId!==ctx.requestId)throw Error('SYNC_PENDING');
          for(const [slot,value]of Object.entries(state))if(own(value,key)){
            if(value.agendaRequestId!==ctx.requestId)throw Error('SYNC_PENDING');delete state[slot];
          }
          delete state[lockKey];return{state};
        });
        await tx('citas/'+key,state=>{if(state._agenda?.lastRequestId!==ctx.requestId)throw Error('SYNC_PENDING');state._agenda={sync:'ready',lastRequestId:ctx.requestId,hash:ctx.hash,occupancyReviewRequired:unresolved};return{state};});
        return{id:key,version:saved.version,pendingSync:false,occupancyReviewRequired:unresolved};
      }catch(error){
        if(committed)return{id:key,version:replay?old.version:(old.version||0)+1,pendingSync:true};
        try{await tx('citas_publicas',state=>{for(const [slot,value]of Object.entries(state))if(own(value,key)&&value.agendaRequestId===ctx.requestId){if(before[slot])state[slot]=before[slot];else delete state[slot];}if(state[lockKey]?.requestId===ctx.requestId)delete state[lockKey];return{state};},{allowEmpty:true});}catch{}
        throw error;
      }
    }
    return{
      saveContact:input=>serial(async()=>{
        const old=(await root())[input.id],result=await contactCommand('contact',input);session();
        const current=M.phone(input.telefono);let oldPhone='';try{oldPhone=M.phone(old?.telefono||'');}catch{}
        try{if(current)await db.ref('telefonos_index/'+current).transaction(v=>v==null||v===input.id?input.id:undefined,undefined,false);if(oldPhone&&oldPhone!==current)await db.ref('telefonos_index/'+oldPhone).transaction(v=>v===input.id?null:undefined,undefined,false);}catch{return{...result,indexPending:true};}return result;
      }),
      completeFollowup:input=>serial(()=>contactCommand('followup',input)),
      saveOperation:input=>serial(()=>contactCommand('operation',input)),
      advance:input=>serial(async()=>{events=Object.entries((await db.ref('citas').get()).val()||{}).map(([id,e])=>({id,...e}));session();return contactCommand('advance',input);}),
      saveEvent:input=>serial(()=>saveEventInternal(input)),
      closeHistoricalEvent:input=>serial(()=>closeHistoricalInternal(input)),
      repairEvent:key=>serial(async()=>{const e=(await db.ref('citas/'+M.id(key)).get()).val();session();if(!e?._agenda?.pendingInput)throw Error('EVENT_NOT_PENDING');return e._agenda.pendingKind==='historical-close'?closeHistoricalInternal(e._agenda.pendingInput):saveEventInternal(e._agenda.pendingInput);}),
      releaseOrphan:key=>serial(async()=>{M.id(key);if((await db.ref('citas/'+key).get()).val())throw Error('EVENT_EXISTS');const at=now().getTime();return tx('citas_publicas',state=>{const lock=state['_agenda_'+key];if(lock&&Date.parse(lock.expiresAt)>at||Object.values(state).some(v=>own(v,key)&&Date.parse(v.claimExpiresAt)>at))throw Error('EVENT_BUSY');for(const [slot,v]of Object.entries(state))if(own(v,key))delete state[slot];delete state['_agenda_'+key];return{state};},{allowEmpty:true});})
    };
  }
  return Object.freeze({create,digest});
});
