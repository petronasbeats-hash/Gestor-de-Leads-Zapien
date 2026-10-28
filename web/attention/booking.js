'use strict';
window.SynapseAttentionVisitUI = (() => {
  const M=window.SynapseWorkspace,B=window.SynapseAttentionBooking,$=id=>document.getElementById(id);
  const messages={
    PERMISSION_DENIED:'Tu cuenta puede atender conversaciones, pero no tiene acceso a la Agenda y al Directorio internos. Usa la cuenta de administración para reservar.',
    'permission-denied':'Tu cuenta no tiene acceso a la Agenda y al Directorio internos. Usa la cuenta de administración para reservar.',
    AUTHENTICATION_REQUIRED:'Inicia sesión de nuevo para consultar la agenda.',
    SLOT_NOT_AVAILABLE:'Ese horario ya no está disponible. Actualiza los horarios y elige otro.',
    SCHEDULE_CONFLICT:'El horario acaba de ocuparse. Actualiza los horarios y elige otro.',
    BOOKING_CONFIRMATION_REQUIRED:'Confirma con el cliente su nombre, teléfono y horario antes de reservar.',
    CONTACT_DETAILS_MISMATCH:'Los datos no coinciden con el contacto elegido. Revísalos en Directorio y vuelve a consultar.',
    DUPLICATE_CONTACT:'Encontramos un contacto con ese nombre o teléfono. Elígelo en Directorio; no se creó otra persona.',
    PHONE_INVALID:'Escribe un teléfono mexicano de diez dígitos.',PHONE_REQUIRED:'Confirma el teléfono del cliente antes de reservar.',
    INVALID_TEXT:'Revisa el nombre completo y los datos del cliente.',
    EXISTING_VISIT_REVIEW:'Ya existe una visita activa que podría corresponder a este contacto e inmueble. Revísala en Agenda antes de crear otra.',
    PROPERTY_SCOPE_CHANGED:'El inmueble de la atención cambió. Actualiza la atención y revisa la cita antes de continuar.',
    PROPERTY_NOT_AVAILABLE:'El inmueble está en contrato o mantenimiento. Revisa su estado en Inmuebles antes de reservar.',
    PROPERTY_NOT_PUBLISHED:'El inmueble ya no está publicado. Actualiza la atención antes de continuar.',
    BOOKING_REFERENCE_CONFLICT:'La referencia de esta cita requiere revisión. Abre Agenda antes de continuar.',
    SYNC_PENDING:'La cita ya está guardada y tiene folio. Completa su sincronización antes de confirmar el horario.',
    BOOKING_NOT_READY:'Revisa el estado y la sincronización de la cita en Agenda.',
    AVAILABILITY_UNAVAILABLE:'No pudimos consultar toda la disponibilidad. Actualiza antes de reservar.'
  };
  function message(error){return messages[error.code]||messages[error.message]||'No se pudo completar la acción. Conserva los datos y vuelve a consultar; si la cita se guardó, aparecerá con el mismo folio.';}
  function mount({db,auth,run,record,hasRecord,prepare,validate}){
    let controller,uid,context,data,event,currentKey='',loaded=false;const drafts=new Map();
    const ids=['visit-name','visit-phone','visit-contact','visit-date','visit-time'];
    const note=(text,error=false)=>{$('visit-status').textContent=text;$('visit-status').classList.toggle('error',error);};
    const key=c=>c?c.organizationId+'/'+c.conversationId+'/'+c.propertyId:'';
    function remember(){if(currentKey&&loaded&&!event)drafts.set(currentKey,{values:Object.fromEntries(ids.map(id=>[id,$(id).value])),confirmed:$('visit-confirmed').checked,dirty:$('visit-form').dataset.dirty==='true'});}
    function select(next){
      if(key(next)===currentKey)return;remember();context=next;currentKey=key(next);data=null;event=null;loaded=false;
      $('visit-form').hidden=true;$('visit-form').dataset.dirty='false';$('visit-receipt').hidden=true;$('visit-existing').replaceChildren();$('visit-existing').hidden=true;$('visit-confirmation').value='';note('Consulta los horarios vigentes para preparar la visita.');
    }
    function reset(){drafts.clear();currentKey='';context=null;data=null;event=null;loaded=false;controller=null;uid=null;for(const id of ids)$(id).replaceChildren?.();$('visit-form').reset();$('visit-form').dataset.dirty='false';$('visit-form').hidden=true;$('visit-receipt').hidden=true;$('visit-confirmation').value='';$('visit-existing').replaceChildren();$('visit-existing').hidden=true;note('Abre esta pestaña para consultar los horarios.');}
    function client(){const user=auth.currentUser;if(!user)throw Error('AUTHENTICATION_REQUIRED');if(uid!==user.uid){uid=user.uid;controller=B.create(db,{uid,getUid:()=>auth.currentUser?.uid});}return controller;}
    function options(el,rows,selected){el.replaceChildren();for(const [value,text]of rows){const o=document.createElement('option');o.value=value;o.textContent=text;el.append(o);}if(rows.some(([value])=>value===selected))el.value=selected;}
    function renderTimes(selected){const times=data.days.find(d=>d.date===$('visit-date').value)?.times||[];options($('visit-time'),[['','Elige un horario'],...times.map(time=>[time,time])],selected||'');}
    function renderMatches(){
      if(!data)return;let phone='';try{phone=M.phone($('visit-phone').value);}catch{}
      const matches=M.duplicates(data.leads,{nombre:$('visit-name').value,telefono:phone});
      $('visit-matches').textContent=matches.length?matches.length+' coincidencia(s). Revisa el contacto antes de crear uno nuevo.':'Si ya lo tienes registrado, elígelo para conservar una sola ficha.';
      const previous=phone?client().candidates(data,phone,context.propertyId):[];$('visit-existing').replaceChildren();$('visit-existing').hidden=!previous.length;
      for(const e of previous){const p=document.createElement('p'),a=document.createElement('a');a.href='/agenda?event='+encodeURIComponent(e.id);a.textContent=(e.folio||'Cita registrada')+' · '+e.fecha+' · '+e.hora+' · revisar en Agenda';p.append(a);$('visit-existing').append(p);}
    }
    function renderReceipt(){
      $('visit-form').hidden=true;$('visit-form').dataset.dirty='false';$('visit-receipt').hidden=false;
      $('visit-receipt-title').textContent='Folio Synapse · '+event.folio;
      const ready=event._agenda?.sync==='ready'&&event.estado==='confirmada';
      $('visit-receipt-state').textContent=event.fecha+' · '+event.hora+' a '+event.horaFin+' · '+(M.statuses[event.estado]||event.estado)+(event._agenda?.sync==='pending'?' · Sincronización pendiente':'');
      $('visit-confirmation').value=ready?B.confirmation(event,data.leads,data.snapshot.propiedades):'';
      $('visit-copy').hidden=!ready;$('visit-prepare').hidden=!ready;$('visit-journal').hidden=!ready||hasRecord(event);
      $('visit-repair').hidden=event._agenda?.sync!=='pending';$('visit-agenda').href='/agenda?event='+encodeURIComponent(event.id);
      note(event.propiedadId!==context.propertyId?'Esta atención ya tiene una visita para otro inmueble. Revísala en Agenda antes de cambiarla.':ready?'Cita guardada en Agenda. Puedes revisar y compartir su confirmación.':'La cita ya existe. Su estado actual se muestra aquí; los cambios se realizan en Agenda.');
    }
    async function load(){
      if(!context)return;remember();const requested=context,requestedKey=currentKey;note('Consultando catálogo, horarios y agenda…');
      try{
        const result=await client().read(requested);if(currentKey!==requestedKey||auth.currentUser?.uid!==uid)return;
        data=result;event=result.event;loaded=true;
        if(event){renderReceipt();return true;}
        const draft=drafts.get(currentKey);
        options($('visit-contact'),[['','Crear contacto nuevo'],...M.contacts(data.leads).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(c=>[c.id,c.nombre+' · '+(c.telefono||'sin teléfono')])],draft?.values['visit-contact']||'');
        $('visit-name').value=draft?.values['visit-name']??context.name??'';$('visit-phone').value=draft?.values['visit-phone']??context.phone??'';
        options($('visit-date'),[['','Elige un día'],...data.days.map(d=>[d.date,new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(d.date+'T12:00:00Z'))])],draft?.values['visit-date']||'');renderTimes(draft?.values['visit-time']);
        $('visit-confirmed').checked=draft?.confirmed===true;$('visit-form').dataset.dirty=String(draft?.dirty===true);$('visit-form').hidden=false;$('visit-receipt').hidden=true;renderMatches();
        note(data.days.length?'Horarios consultados: '+new Date(data.observedAt).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})+'.':'Por ahora no hay horarios en los próximos 14 días. Revisa horarios y bloqueos en Agenda.');
        return true;
      }catch(error){if(currentKey===requestedKey){loaded=false;event=null;$('visit-form').hidden=true;$('visit-receipt').hidden=true;note(message(error),true);}return false;}
    }
    async function journal(){await record(context,event);$('visit-journal').hidden=true;note('Cita y folio vinculados a la bitácora de esta atención.');}
    $('visit-load').addEventListener('click',()=>run(load));
    $('visit-date').addEventListener('change',()=>{if(data)renderTimes();$('visit-confirmed').checked=false;});
    $('visit-contact').addEventListener('change',()=>{const c=data?.leads[$('visit-contact').value];if(c){$('visit-name').value=c.nombre;$('visit-phone').value=c.telefono||'';}$('visit-confirmed').checked=false;renderMatches();});
    $('visit-form').addEventListener('input',e=>{$('visit-form').dataset.dirty='true';if(e.target.id!=='visit-confirmed')$('visit-confirmed').checked=false;renderMatches();});
    $('visit-form').addEventListener('change',e=>{$('visit-form').dataset.dirty='true';if(e.target.id!=='visit-confirmed')$('visit-confirmed').checked=false;});
    $('visit-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
      if(!context||!data)return;remember();const selected=context;
      try{
        await validate(selected);
        const result=await client().book(selected,{name:$('visit-name').value,phone:$('visit-phone').value,contactId:$('visit-contact').value,date:$('visit-date').value,time:$('visit-time').value,confirmed:$('visit-confirmed').checked});
        data=await client().read(selected);event=data.event||result.event;loaded=true;drafts.delete(currentKey);renderReceipt();
        if(event._agenda?.sync==='ready'&&event.estado==='confirmada')try{await journal();}catch{note('La cita ya está guardada con su folio. Pulsa Completar bitácora para terminar la vinculación; no reserves otra vez.',true);$('visit-journal').hidden=false;}
      }catch(error){note(message(error),true);}
    });});
    $('visit-journal').addEventListener('click',()=>run(async()=>{try{await journal();}catch(error){note('La cita está guardada. No se pudo completar la bitácora: '+message(error),true);}}));
    $('visit-repair').addEventListener('click',()=>run(async()=>{try{data=await client().repair(context);event=data.event;renderReceipt();if(event._agenda?.sync==='ready'&&event.estado==='confirmada')await journal();}catch(error){note(message(error),true);}}));
    $('visit-copy').addEventListener('click',()=>run(async()=>{if(!await load())return;if(event?._agenda?.sync!=='ready'||event.estado!=='confirmada')return;await navigator.clipboard.writeText($('visit-confirmation').value);note('Confirmación copiada. Compártela por el canal acordado.');}));
    $('visit-prepare').addEventListener('click',()=>run(async()=>{if(!await load())return;if(event?._agenda?.sync==='ready'&&event.estado==='confirmada')prepare($('visit-confirmation').value);}));
    return{select,reset,load};
  }
  return Object.freeze({mount});
})();
