"use strict";
// Emulator-only Admin SDK booking. Not an HTTP endpoint or production service.
// Uses a dedicated namespace subtree and synthetic LAB identifiers.
const MARKER="habitat-admin-booking-lab-v01";
function guard(input){
  if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_9100_REQUIRED");
  if(!/^LAB-ADMIN-[A-Z0-9-]+$/.test(input.requestId))throw Error("LAB_REQUEST_ONLY");
  if(!/^2099-\d\d-\d\d_\d\d:\d\d$/.test(input.slotKey))throw Error("LAB_SLOT_ONLY");
  if(!/^LAB-HAB-[A-Z0-9-]+$/.test(input.unitId))throw Error("LAB_UNIT_ONLY");
}
async function book(db,input,failAt){
  guard(input);
  const {requestId,slotKey,unitId}=input;
  const fingerprint=JSON.stringify([slotKey,unitId]);
  const base=db.ref("lab_admin_booking");
  const request=base.child("requests/"+requestId);
  const citaId="LAB-CITA-"+requestId;
  // Reserve the request fingerprint first: a reused ID with different payload\n  // must not claim a second slot.\n  const identity=await request.transaction(current=>{\n    if(current&&current.fingerprint!==fingerprint)return;\n    return current||{fingerprint,slotKey,unitId,citaId,status:"processing",marker:MARKER};\n  },undefined,false);\n  if(!identity.committed)throw Error("IDEMPOTENCY_CONFLICT");\n  // One atomic slot transaction is the exclusion boundary. Every execution
  // of a repeated request has the same owner and deterministic cita ID.
  const slot=base.child("slots/"+slotKey);
  const claim=await slot.transaction(current=>{
    if(current===null)return {requestId,citaId,unitId,status:"processing",marker:MARKER};
    if(current.marker===MARKER&&current.requestId===requestId&&
       current.citaId===citaId&&current.unitId===unitId)return current;
    return;
  },undefined,false);
  if(!claim.committed)return {ok:false,reason:"SLOT_TAKEN"};
  if(failAt==="after_claim")throw Error("INJECTED_AFTER_CLAIM");
  const cita=base.child("citas/"+citaId);
  await cita.transaction(current=>current||{requestId,slotKey,unitId,marker:MARKER},undefined,false);
  if(failAt==="after_cita")throw Error("INJECTED_AFTER_CITA");
  // Durable deterministic evidence: retries cannot duplicate event keys.
  await base.child("events/"+requestId+"/cita_created").set({type:"CITA_CREATED",requestId,marker:MARKER});
  // Concurrent same-request executions may safely repeat these idempotent writes.
  await slot.child("status").set("confirmed");
  await request.child("status").set("confirmed");
  await base.child("events/"+requestId+"/confirmed").set({type:"BOOKING_CONFIRMED",requestId,marker:MARKER});
  return {ok:true,citaId};
}
module.exports={book,MARKER};
