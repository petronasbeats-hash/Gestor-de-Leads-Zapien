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

    // Emulator-compatible ownership rollback:
    // atomically mark the owned claim as released first.
    const mark=await ref.transaction(current=>{
      if(!current || current.citaId!==citaId || current.status!=="claiming") return;
      return {...current,status:"released"};
    });

    if(!mark.committed) return false;
    const value = mark.snapshot && typeof mark.snapshot.val==="function"
      ? mark.snapshot.val() : null;
    return !!value && value.citaId===citaId && value.status==="released";
  }
  return {claimSlot,releaseOwnedClaim};
});
