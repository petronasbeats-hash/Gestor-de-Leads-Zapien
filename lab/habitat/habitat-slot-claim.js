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
      citaId,
      propiedadId:propiedadId||null,
      unitId:unitId||null,
      availabilityVersion:availabilityVersion||null,
      intentType:"request_visit",
      status:"confirmed"
    };
    const result=await ref.transaction(current=>current===null?claim:undefined,undefined,false);
    if(!result.committed) return {claimed:false,reason:"SLOT_TAKEN"};
    return {claimed:true,claim};
  }

  async function finalizeClaim(){
    // Claim is final at the moment the atomic transaction succeeds.
    return true;
  }

  async function releaseOwnedClaim(){
    // Fail closed. Client-side conditional rollback is not reliable in this
    // emulator/client combination and must move behind trusted server authority.
    throw new Error("ROLLBACK_REQUIRES_SERVER_AUTHORITY");
  }

  return {claimSlot,finalizeClaim,releaseOwnedClaim};
});
