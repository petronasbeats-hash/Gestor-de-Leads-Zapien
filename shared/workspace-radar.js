(function(root,factory){const M=typeof module==='object'&&module.exports?require('./workspace-model.js'):root.SynapseWorkspace;const api=factory(M);if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseRadar=api;})(typeof globalThis==='undefined'?this:globalThis,function(M){
  'use strict';
  function date(value){try{return M.validDate(value);}catch{return '';}}
  function build({leads={},citas={}}={},now=new Date()){
    const today=M.calendarDate(now),time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
    const events=Object.entries(citas).filter(([,e])=>e&&typeof e==='object').map(([id,e])=>({id,...e})),items=[];
    const bucket=d=>!d?'undated':d<today?'overdue':d===today?'today':'upcoming';
    const rank={repair:0,overdue:1,today:2,upcoming:3,undated:4};
    function add(item){item.bucket=item.kind==='repair'?'repair':bucket(item.date);item.rank=rank[item.bucket];items.push(item);}
    for(const e of events){
      const day=date(e.fecha),title=e.titulo||e.propiedadNombre||e.nombre||'Compromiso';
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
    items.sort((a,b)=>a.rank-b.rank||String(a.date+' '+a.time).localeCompare(b.date+' '+b.time)||a.title.localeCompare(b.title,'es'));
    const counts={all:items.length,repair:0,overdue:0,today:0,upcoming:0,undated:0};for(const item of items)counts[item.bucket]++;
    return{today,items,counts};
  }
  return Object.freeze({build});
});
