(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./workspace-model.js'):root.SynapseWorkspace,node?require('./workspace-store.js'):root.SynapseWorkspaceStore,node?require('./visit-availability.js'):root.SynapseVisitAvailability,node?require('./reservation-reference.js'):root.SynapseReservationReference);if(node)module.exports=api;else root.SynapseAttentionBooking=api;})(typeof globalThis==='undefined'?this:globalThis,function(M,S,A,F){
  'use strict';
  const sources={marketplace_facebook:'Marketplace Facebook',facebook:'Facebook',whatsapp:'WhatsApp',casa_login:'Casa Login',hype_synapse_experience:'HYPE by Synapse Experience',directa:'Directa'};
  function create(db,{uid,getUid=()=>uid,now=()=>new Date(),hash=S.digest}={}){
    const store=S.create(db,{uid,getUid,now,hash});let tail=Promise.resolve();
    const session=()=>{if(getUid()!==uid)throw Error('AUTHENTICATION_REQUIRED');};
    function scope(context){session();M.id(context.organizationId);M.id(context.conversationId);M.id(context.propertyId);}
    async function identity(context){scope(context);return 'AV_'+(await hash({organizationId:context.organizationId,conversationId:context.conversationId})).slice(0,40);}
    async function read(context){
      scope(context);const paths=['propiedades','disponibilidad/horarios','disponibilidad/bloqueos','citas_publicas','leads','citas'];
      const values=await Promise.all(paths.map(async p=>(await db.ref(p).get()).val()));session();
      const [propiedades,horario,bloqueos,ocupados,leads,citas]=values,snapshot={propiedades,horario,bloqueos:bloqueos||{},ocupados:ocupados||{}};
      A.duration(snapshot);if(!propiedades[context.propertyId]||propiedades[context.propertyId].activo===false)throw Error('PROPERTY_NOT_PUBLISHED');
      const eventId=await identity(context),event=citas?.[eventId]||null;
      if(event&&(event.attentionRef?.organizationId!==context.organizationId||event.attentionRef?.conversationId!==context.conversationId))throw Error('BOOKING_REFERENCE_CONFLICT');
      return{snapshot,leads:leads||{},citas:citas||{},event,eventId,observedAt:now().toISOString(),days:A.windowDays(now()).map(date=>({date,times:A.slots(snapshot,context.propertyId,date,now())})).filter(d=>d.times.length)};
    }
    function candidates(data,phone,propertyId){
      const ids=new Set(M.contacts(data.leads).filter(c=>{try{return M.phone(c.telefono)===phone;}catch{return false;}}).map(c=>c.id));
      return Object.entries(data.citas).filter(([,e])=>M.active(e)&&e.propiedadId===propertyId&&(e.participantes?.some(id=>ids.has(id))||ids.has(e.leadId)||(()=>{try{return !!e.telefono&&M.phone(e.telefono)===phone;}catch{return false;}})())).map(([id,event])=>({id,...event}));
    }
    async function bookInternal(context,input){
      scope(context);if(input.confirmed!==true)throw Error('BOOKING_CONFIRMATION_REQUIRED');
      const name=M.text(input.name,180,true),phone=M.phone(input.phone);if(!phone)throw Error('PHONE_REQUIRED');
      const data=await read(context);if(data.event)return{event:data.event,replayed:true,pendingSync:data.event._agenda?.sync==='pending'};
      if(candidates(data,phone,context.propertyId).length)throw Error('EXISTING_VISIT_REVIEW');
      if(!data.days.some(d=>d.date===input.date&&d.times.includes(input.time)))throw Error('SLOT_NOT_AVAILABLE');
      let contactId=input.contactId?M.id(input.contactId):'AC_'+data.eventId.slice(3);
      if(input.contactId){const c=data.leads[contactId];if(!c)throw Error('CONTACT_NOT_FOUND');if(M.phone(c.telefono)!==phone||c.nombre.trim()!==name)throw Error('CONTACT_DETAILS_MISMATCH');}
      else{
        const c=data.leads[contactId];
        if(c){if(!c._synapse?.commands?.['contact_'+data.eventId]||M.phone(c.telefono)!==phone||c.nombre!==name)throw Error('CONTACT_DETAILS_MISMATCH');}
        else await store.saveContact({id:contactId,requestId:'contact_'+data.eventId,expectedVersion:0,nombre:name,telefono:phone,email:'',fuente:sources[context.source]||context.source||'Directa',canal:context.entryChannel||'',categorias:['prospecto'],especialidad:'',notas:''});
      }
      session();const property=data.snapshot.propiedades[context.propertyId],dur=A.duration(data.snapshot);
      const eventRequestId='visit_'+data.eventId+'_'+(await hash({name,phone,contactId,date:input.date,time:input.time})).slice(0,16);
      const eventInput={id:data.eventId,requestId:eventRequestId,expectedVersion:0,existing:false,tipoEvento:'visita',titulo:('Visita · '+name+' · '+String(property.nombre||'Inmueble')).slice(0,240),fecha:input.date,hora:input.time,horaFin:M.time(M.minutes(input.time)+dur),estado:'confirmada',bloqueaDisponibilidad:true,bufferAntesMin:0,bufferDespuesMin:0,participantes:[contactId],propiedadId:context.propertyId,folio:F.fromCitaId(data.eventId),notas:'Nombre, teléfono y horario confirmados por el asesor en Atención.',attentionRef:{organizationId:context.organizationId,conversationId:context.conversationId,agentUid:uid,source:context.source,entryChannel:context.entryChannel,originalPropertyId:context.originalPropertyId||context.propertyId}};
      // Read all public sources again immediately before the existing Agenda
      // claim. A contact created before a failure stays in Directory for retry.
      const fresh=await read(context);if(fresh.event)return{event:fresh.event,replayed:true,pendingSync:fresh.event._agenda?.sync==='pending'};
      if(!fresh.days.some(d=>d.date===input.date&&d.times.includes(input.time)))throw Error('SLOT_NOT_AVAILABLE');
      let receipt;
      try{receipt=await store.saveEvent(eventInput);}
      catch(error){
        // A lost response must not turn a committed visit into a second booking.
        const saved=(await db.ref('citas/'+data.eventId).get()).val();session();
        if(!saved||saved.attentionRef?.organizationId!==context.organizationId||saved.attentionRef?.conversationId!==context.conversationId)throw error;
        return{event:saved,replayed:true,pendingSync:saved._agenda?.sync==='pending'};
      }
      const event=(await db.ref('citas/'+receipt.id).get()).val();session();if(!event)throw Error('BOOKING_NOT_REGISTERED');
      return{event,pendingSync:receipt.pendingSync,replayed:false};
    }
    return{read,candidates,book(context,input){const operation=tail.catch(()=>{}).then(()=>bookInternal(context,input));tail=operation;return operation;},async repair(context){const data=await read(context);if(!data.event)throw Error('BOOKING_NOT_REGISTERED');await store.repairEvent(data.eventId);return read(context);}};
  }
  function confirmation(event,leads,properties){
    if(!event||event._agenda?.sync!=='ready'||event.estado!=='confirmada')throw Error('SYNC_PENDING');
    const date=new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(event.fecha+'T12:00:00Z'));
    const names=(event.participantes||[]).map(id=>leads[id]?.nombre).filter(Boolean).join(', ');
    return ['¡Tu visita está confirmada!','📅 '+date+' · '+event.hora+' a '+event.horaFin,'🏠 '+(properties[event.propiedadId]?.nombre||event.titulo),names?'👤 '+names:'','Folio Synapse: '+event.folio,'Si necesitas cambiar el horario, avísame por este mismo medio.'].filter(Boolean).join('\n');
  }
  return Object.freeze({create,confirmation});
});
