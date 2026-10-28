(function(root,factory){const model=typeof module==='object'&&module.exports?require('./workspace-model.js'):root.SynapseWorkspace;const api=factory(model);if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseWorkspaceStore=api;})(typeof globalThis==='undefined'?this:globalThis,function(M){
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
    async function contactCommand(kind,input){const ctx=await context(kind,input);return tx('leads',state=>{const r=kind==='contact'?M.saveContact(state,input,ctx):kind==='operation'?M.saveOperation(state,input,ctx):M.advanceOperation(state,input,ctx,events);return{state:r.state,value:r.receipt};},{allowEmpty:kind==='contact'&&input.expectedVersion===0});}
    let events=[];
    async function root(){const snap=await db.ref('leads').get();session();return snap.val()||{};}
    function own(v,key){return v&&v.citaId===key;}
    async function saveEventInternal(input){
      const ctx=await context('event',input),event=M.eventInput(input,ctx),key=event.id,lockKey='_agenda_'+key;
      const [h,b,c,l]=await Promise.all(['disponibilidad/horarios','disponibilidad/bloqueos','citas','leads'].map(p=>db.ref(p).get()));session();
      const horario=h.val();if(!horario||!Number.isFinite(Number(horario.duracionMin)))throw Error('AVAILABILITY_UNAVAILABLE');
      const contactos=l.val()||{},citas=c.val()||{},old=citas[key],r=M.range(event,horario.duracionMin);
      for(const contactId of event.participantes)if(!contactos[contactId])throw Error('CONTACT_NOT_FOUND');
      if(event.tipoEvento==='visita'&&!event.participantes.some(i=>{try{return!!M.phone(contactos[i].telefono);}catch{return false;}}))throw Error('PHONE_REQUIRED');
      if(event.tipoEvento==='visita'){const prop=(await db.ref('propiedades/'+event.propiedadId).get()).val();session();if(!prop||prop.activo===false)throw Error('PROPERTY_NOT_PUBLISHED');}
      if(event.operationRef&&!contactos[event.operationRef.ownerContactId]?._synapse?.operaciones?.[event.operationRef.id])throw Error('OPERATION_NOT_FOUND');
      if(old?._agenda?.sync==='pending'&&old._agenda.lastRequestId!==ctx.requestId)throw Error('SYNC_PENDING');
      if(old?._agenda?.lastRequestId!==ctx.requestId){
        if((old?.version||0)!==input.expectedVersion||Boolean(old)!==Boolean(input.existing))throw Error('VERSION_CONFLICT');
        if(old&&(old.fecha!==event.fecha||old.hora!==event.hora||old.horaFin&&old.horaFin!==event.horaFin||event.estado==='cancelada'&&old.estado!=='cancelada')&&!event.motivo)throw Error('CHANGE_REASON_REQUIRED');
        if(r&&Object.entries(citas).some(([k,v])=>k!==key&&M.overlap(r,M.range(v,horario.duracionMin))))throw Error('SCHEDULE_CONFLICT');
        if(r&&(b.val()?.[event.fecha]||[]).some(t=>M.overlap(r,{date:event.fecha,start:M.minutes(t),end:M.minutes(t)+horario.duracionMin})))throw Error('SCHEDULE_CONFLICT');
      }
      const keys=M.slotKeys(event,horario),desired=new Set(keys),claim={agenda:true,citaId:key,estado:'ocupado',inicioMin:r?.start||0,finMin:r?.end||0,agendaRequestId:ctx.requestId};let before={},committed=false;
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
          const data={...state,...event,creado:state.creado||ctx.now,historial:{...state.historial,[ctx.requestId]:{tipo:exists?'agenda_actualizada':'agenda_creada',fecha:ctx.now,actorUid:uid,estado:event.estado,motivo:event.motivo,legacySlotReviewed:input.ackLegacySlot===true,anterior:exists?{fecha:state.fecha||'',hora:state.hora||'',horaFin:state.horaFin||'',estado:state.estado||''}:null}},_agenda:{sync:'pending',lastRequestId:ctx.requestId,hash:ctx.hash,pendingInput:input}};
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
    return{
      saveContact:input=>serial(async()=>{
        const old=(await root())[input.id],result=await contactCommand('contact',input);session();
        const current=M.phone(input.telefono);let oldPhone='';try{oldPhone=M.phone(old?.telefono||'');}catch{}
        try{if(current)await db.ref('telefonos_index/'+current).transaction(v=>v==null||v===input.id?input.id:undefined,undefined,false);if(oldPhone&&oldPhone!==current)await db.ref('telefonos_index/'+oldPhone).transaction(v=>v===input.id?null:undefined,undefined,false);}catch{return{...result,indexPending:true};}return result;
      }),
      saveOperation:input=>serial(()=>contactCommand('operation',input)),
      advance:input=>serial(async()=>{events=Object.entries((await db.ref('citas').get()).val()||{}).map(([id,e])=>({id,...e}));session();return contactCommand('advance',input);}),
      saveEvent:input=>serial(()=>saveEventInternal(input)),
      repairEvent:key=>serial(async()=>{const e=(await db.ref('citas/'+M.id(key)).get()).val();session();if(!e?._agenda?.pendingInput)throw Error('EVENT_NOT_PENDING');return saveEventInternal(e._agenda.pendingInput);}),
      releaseOrphan:key=>serial(async()=>{M.id(key);if((await db.ref('citas/'+key).get()).val())throw Error('EVENT_EXISTS');const at=now().getTime();return tx('citas_publicas',state=>{const lock=state['_agenda_'+key];if(lock&&Date.parse(lock.expiresAt)>at||Object.values(state).some(v=>own(v,key)&&Date.parse(v.claimExpiresAt)>at))throw Error('EVENT_BUSY');for(const [slot,v]of Object.entries(state))if(own(v,key))delete state[slot];delete state['_agenda_'+key];return{state};},{allowEmpty:true});})
    };
  }
  return Object.freeze({create,digest});
});
