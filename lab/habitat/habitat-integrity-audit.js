/* Read-only Habitat Lab integrity audit. No writes, deletes or PII output. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.HabitatIntegrity=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function inspect(slots,citas){
    const issues=[];
    const slotEntries=Object.entries(slots||{});
    const citaEntries=Object.entries(citas||{});
    const bySlot=new Map();
    for(const [id,cita] of citaEntries){
      if(!cita||!cita.fecha||!cita.hora)continue;
      const key=cita.fecha+"_"+cita.hora;
      if(!bySlot.has(key))bySlot.set(key,[]);
      bySlot.get(key).push(id);
    }
    for(const [key,slot] of slotEntries){
      if(!slot||typeof slot!=="object")continue;
      const ids=bySlot.get(key)||[];
      if(slot.status==="confirmed"&&slot.citaId){
        if(!citas||!citas[slot.citaId]){
          issues.push({type:"CONFIRMED_SLOT_WITHOUT_CITA",slotKey:key,citaId:slot.citaId});
        }else{
          const c=citas[slot.citaId];
          if(c.fecha+"_"+c.hora!==key)
            issues.push({type:"SLOT_CITA_TIME_MISMATCH",slotKey:key,citaId:slot.citaId});
        }
      }
      if(ids.length>1)
        issues.push({type:"DUPLICATE_CITAS_FOR_SLOT",slotKey:key,count:ids.length});
      if(ids.length&&slot.citaId&&!ids.includes(slot.citaId))
        issues.push({type:"SLOT_CITA_ID_MISMATCH",slotKey:key,citaId:slot.citaId});
    }
    for(const [key,ids] of bySlot){
      if(ids.length>1&&!slots?.[key])
        issues.push({type:"DUPLICATE_CITAS_FOR_SLOT",slotKey:key,count:ids.length});
      if(!slots?.[key])
        issues.push({type:"CITA_WITHOUT_SLOT",slotKey:key,count:ids.length});
    }
    return {slotCount:slotEntries.length,citaCount:citaEntries.length,issues};
  }
  async function audit(db){
    if(!db||typeof db.ref!=="function")throw Error("DB_REQUIRED");
    const [slots,citas]=await Promise.all([
      db.ref("citas_publicas").once("value"),
      db.ref("citas").once("value")
    ]);
    return inspect(slots.val()||{},citas.val()||{});
  }
  return {inspect,audit};
});
