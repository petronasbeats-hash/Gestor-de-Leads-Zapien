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
    const result=await ref.transaction(current=>current===null?claim:undefined,undefined,false);
    if(!result.committed) return {claimed:false,reason:"SLOT_TAKEN"};
    return {claimed:true,claim};
  }
  async function releaseOwnedClaim({db,slotKey,citaId}){
    const ref=db.ref("citas_publicas/"+slotKey);
    const snap=await ref.once("value");
    const current=snap.val();
    if(!current) return true;
    if(current.citaId!==citaId || current.status!=="claiming") return false;

    // Emulator-safe rollback: once ownership is verified, remove the exact claim.
    // Production must enforce equivalent ownership constraints in RTDB rules/server authority.
    await ref.remove();

    const verify=await ref.once("value");
    return verify.val()===null;
  }
  return {claimSlot,releaseOwnedClaim};
});
