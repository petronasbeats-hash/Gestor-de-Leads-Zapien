(function(root,factory){const M=typeof module==='object'&&module.exports?require('./workspace-model.js'):root.SynapseWorkspace;const api=factory(M);if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseRadar=api;})(typeof globalThis==='undefined'?this:globalThis,function(M){
  'use strict';
  function date(value){try{return M.validDate(value);}catch{return '';}}
  function build({leads={},citas={},privateActions=[]}={},now=new Date()){
    const today=M.calendarDate(now),time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
    const events=Object.entries(citas).filter(([,e])=>e&&typeof e==='object').map(([id,e])=>({id,...e})),items=[];
    const bucket=d=>!d?'undated':d<today?'overdue':d===today?'today':'upcoming';
    const rank={repair:0,overdue:1,today:2,upcoming:3,undated:4};
    function add(item){item.bucket=item.kind==='repair'?'repair':bucket(item.date);item.rank=rank[item.bucket];items.push(item);}
    for(const e of events){
      const day=date(e.fecha),title=e.titulo||e.propiedadNombre||e.nombre||'Compromiso';
      // Closed activities are history, even if a legacy occupancy marker still needs review.
      // Never release or reinterpret that marker while projecting daily actions.
      if(!M.active(e)&&e._agenda?.occupancyReviewRequired&&e._agenda?.sync!=='pending')continue;
      if(e._agenda?.sync==='pending'){add({id:'event:'+e.id,kind:'repair',eventId:e.id,title,action:'Completar sincronización',detail:'La ocupación requiere revisión antes de confirmar.',date:day,time:e.hora||''});continue;}
      if(!M.active(e))continue;
      const started=day&&(day<today||day===today&&e.hora&&e.hora<=time);
      const provisional=e.estado==='hold',task=e.tipoEvento==='tarea';
      add({id:'event:'+e.id,kind:'event',eventId:e.id,title,action:provisional?'Revisar apartado':task?'Completar tarea':started?'Registrar resultado':e.estado==='confirmada'?'Preparar compromiso':'Confirmar compromiso',detail:provisional?'Apartado provisional; revisa su vigencia.':M.eventKinds[e.tipoEvento]||'Cita registrada',date:day,time:e.hora||'',nextState:!provisional&&((task&&day&&day<=today)||started)?'realizada':!task&&!provisional&&!started&&e.estado!=='confirmada'?'confirmada':null});
    }
    for(const c of M.contacts(leads)){
      const action=typeof c.raw.proximaAccion==='string'?c.raw.proximaAccion.trim():'';
      if(!action)continue;
      add({id:'followup:'+c.id,kind:'followup',contactId:c.id,title:action,action:'Abrir seguimiento',detail:c.nombre+' · Seguimiento registrado en su ficha',date:date(c.raw.fechaProximaAccion),time:''});
    }
    for(const op of M.operations(leads)){
      const flow=M.pipeline(op,events,now);if(flow.current.mode==='fin')continue;
      // A scheduled event already has its own actionable card. A completed
      // event leaves the operation action available to advance its stage.
      if(flow.current.mode==='evento'&&flow.event&&M.active(flow.event))continue;
      add({id:'operation:'+op.ownerContactId+':'+op.id,kind:'operation',operationId:op.id,ownerContactId:op.ownerContactId,title:op.referencia,action:flow.canAdvance&&flow.next?'Revisar avance a '+flow.next.label:flow.current.mode==='evento'&&flow.event?.estado==='realizada'?'Revisar realización del evento':flow.action,detail:flow.current.label+' · '+Object.entries(op.participantes).map(([id,p])=>(leads[id]?.nombre||'Contacto')+' · '+p.roles.join(', ')).join(' / '),date:'',time:''});
    }
    const actionIds=new Set();
    for(const item of Array.isArray(privateActions)?privateActions:[]){
      if(!item||!['territory','destaca','attention'].includes(item.kind)||![item.recordId,item.organizationId].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v))||typeof item.description!=='string'||!item.description.trim())continue;
      const id=item.kind+':'+item.organizationId+':'+item.recordId;if(actionIds.has(id))continue;actionIds.add(id);
      const attention=item.kind==='attention';
      add({id,kind:item.kind,recordId:item.recordId,organizationId:item.organizationId,title:item.description,detail:(item.title||'Registro')+' · '+(attention?'Atención':item.kind==='territory'?'Territorio':'Destaca'),action:attention?'Atender cliente':item.kind==='territory'?'Revisar captación':'Revisar recomendación',date:date(item.dueDate),time:'',href:(attention?'/atencion-operador':item.kind==='territory'?'/territorio':'/destaca')+'?organization='+encodeURIComponent(item.organizationId)+(attention?'&conversation=':item.kind==='territory'?'&capture=':'&recommendation=')+encodeURIComponent(item.recordId)+(attention?'&panel='+(item.actionType==='followup'?'journal':'conversation'):'&panel=followup')});
    }
    items.sort((a,b)=>a.rank-b.rank||String(a.date+' '+a.time).localeCompare(b.date+' '+b.time)||a.title.localeCompare(b.title,'es'));
    const counts={all:items.length,repair:0,overdue:0,today:0,upcoming:0,undated:0};for(const item of items)counts[item.bucket]++;
    return{today,items,counts};
  }
  function reminders(citas={},now=new Date()){
    const today=M.calendarDate(now),parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':');
    const clock=Number(parts[0])*60+Number(parts[1]),rows=[];
    for(const [id,event]of Object.entries(citas)){
      if(!event||!M.active(event)||event.estado==='hold'||event.tipoEvento==='tarea'||event._agenda?.sync==='pending'||!date(event.fecha))continue;
      let minute;try{minute=M.minutes(event.hora);}catch{continue;}
      const left=Math.round((Date.parse(event.fecha+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/60000)+minute-clock;
      if(left<0||left>1440)continue;rows.push({id,title:event.titulo||event.propiedadNombre||event.nombre||'Compromiso',date:event.fecha,time:event.hora,minutes:left});
    }
    return rows.sort((a,b)=>a.minutes-b.minutes||a.id.localeCompare(b.id));
  }
  return Object.freeze({build,reminders});
});
