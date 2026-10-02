/* Habitat Lab: atomic slot claim prototype. Not deployed or wired into reservar.html.
   RTDB rules/server validation must be designed before production use. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports) module.exports=api;
  else root.HabitatSlotClaim=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  async function claimSlot({db,slotKey,citaId,propiedadId,unitId,availabilityVersion}){
    if(!db || !/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(slotKey) || !citaId)
      throw new Error("INVALID_SLOT_CLAIM");
    const ref=db.ref("citas_publicas/"+slotKey);
    const claim={
      citaId, propiedadId:propiedadId||null, unitId:unitId||null,
      availabilityVersion:availabilityVersion||null,
      intentType:"request_visit", status:"claiming"
    };
    const result=await ref.transaction(current=>(current===null || current.status==='released')?claim:undefined,undefined,false);
    if(!result.committed) return {claimed:false,reason:"SLOT_TAKEN"};
    return {claimed:true,claim};
  }
  async function releaseOwnedClaim({db,slotKey,citaId}){
    const ref=db.ref("citas_publicas/"+slotKey);
    // Never use read-then-remove: another claimant could acquire the slot between operations.
    // A tombstone is atomically written only if this caller still owns a pending claim.
    const result=await ref.transaction(current=>
      current && current.citaId===citaId && current.status==="claiming"
        ? {...current,status:"released"} : undefined
    ,undefined,false);
    return result.committed && result.snapshot.val()?.status==="released";
  }
  return {claimSlot,releaseOwnedClaim};
});
