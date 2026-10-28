(function(root,factory){const M=typeof module==='object'&&module.exports?require('./workspace-model.js'):root.SynapseWorkspace;const P=typeof module==='object'&&module.exports?require('./property-inventory.js'):root.SynapsePropertyInventory;const api=factory(M,P);if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseVisitAvailability=api;})(typeof globalThis==='undefined'?this:globalThis,function(M,P){
  'use strict';
  const days=['dom','lun','mar','mie','jue','vie','sab'];
  function travel(a,b,h){
    if(!a||!b||a===b||[a.lat,a.lng,b.lat,b.lng].some(v=>v==null||v===''||!Number.isFinite(Number(v))))return 0;
    const rad=n=>n*Math.PI/180,dlat=rad(Number(b.lat)-Number(a.lat)),dlng=rad(Number(b.lng)-Number(a.lng));
    const q=Math.sin(dlat/2)**2+Math.cos(rad(Number(a.lat)))*Math.cos(rad(Number(b.lat)))*Math.sin(dlng/2)**2;
    const km=6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));
    return Math.ceil(km/(Number(h.velocidadKmH)||25)*60+(Number.isFinite(Number(h.bufferMin))&&h.bufferMin!==null?Number(h.bufferMin):10));
  }
  function duration(snapshot){const n=Number(snapshot?.horario?.duracionMin);if(!Number.isInteger(n)||n<=0||n>240||!snapshot.propiedades||!snapshot.bloqueos||!snapshot.ocupados)throw Error('AVAILABILITY_UNAVAILABLE');return n;}
  function slots(snapshot,propertyId,date,now=new Date()){
    M.validDate(date);const dur=duration(snapshot),h=snapshot.horario,p=snapshot.propiedades[propertyId];
    if(!p||p.activo===false)throw Error('PROPERTY_NOT_PUBLISHED');if(!P.canVisit(p))return [];
    const cfg=h[days[new Date(date+'T12:00:00Z').getUTCDay()]];if(!cfg?.activo)return[];
    const spans=cfg.rangos||[{inicio:cfg.inicio||'09:00',fin:cfg.fin||'18:00'}],blocks=snapshot.bloqueos[date]||[];
    if(!Array.isArray(spans)||!Array.isArray(blocks))throw Error('AVAILABILITY_UNAVAILABLE');
    const occupied=Object.entries(snapshot.ocupados).map(([key,value])=>({range:M.publicRange(key,value,dur),property:value?.propiedadId})).filter(e=>e.range?.date===date),result=new Set();
    for(const span of spans){if(!span.inicio||!span.fin)continue;for(let start=M.minutes(span.inicio),end=M.minutes(span.fin);start+dur<=end;start+=dur){
      const time=M.time(start),range={date,start,end:start+dur};
      if(new Date(date+'T'+time+':00-06:00')<=now||blocks.some(t=>M.overlap(range,{date,start:M.minutes(t),end:M.minutes(t)+dur}))||M.candidateBlocked(snapshot.ocupados,date,start,start+dur))continue;
      if(occupied.some(e=>{const t=travel(p,snapshot.propiedades[e.property],h);return t>0&&(e.range.end<=start?start-e.range.end<t:start+dur<=e.range.start?e.range.start-start-dur<t:false);}))continue;
      result.add(time);
    }}return [...result].sort();
  }
  function windowDays(now=new Date()){
    const today=M.calendarDate(now),dates=[];for(let n=1;n<=14;n++){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);dates.push(d.toISOString().slice(0,10));}return dates;
  }
  return Object.freeze({slots,windowDays,duration});
});
