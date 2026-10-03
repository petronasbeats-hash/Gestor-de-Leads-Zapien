/* Habitat Lab: server-side reconciliation prototype.
   Only use with Firebase Admin SDK against demo-synapse-lab RTDB emulator.
   NOT safe for production without a server-side booking protocol that
   coordinates cita writes and release, RTDB rules and an event log. */
"use strict";
function validateLab(db){
  if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9000" &&
     process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="localhost:9000")
    throw Error("EMULATOR_REQUIRED");
  if(process.env.GCLOUD_PROJECT!=="demo-synapse-lab" &&
     process.env.GOOGLE_CLOUD_PROJECT!=="demo-synapse-lab")
    throw Error("DEMO_PROJECT_REQUIRED");
  if(!db||typeof db.ref!=="function")throw Error("DB_REQUIRED");
}
function assertSlotKey(key){
  if(!/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(key))throw Error("INVALID_SLOT_KEY");
}
async function inspectCandidate(db,slotKey,expectedCitaId){
  validateLab(db);assertSlotKey(slotKey);
  if(!expectedCitaId||typeof expectedCitaId!=="string")throw Error("INVALID_CITA_ID");
  const slot=(await db.ref("citas_publicas/"+slotKey).once("value")).val();
  if(!slot)return {eligible:false,reason:"SLOT_ABSENT"};
  if(slot.citaId!==expectedCitaId)return {eligible:false,reason:"OWNER_CHANGED"};
  if(slot.status!=="confirmed")return {eligible:false,reason:"NOT_CONFIRMED"};
  const cita=(await db.ref("citas/"+expectedCitaId).once("value")).val();
  if(cita)return {eligible:false,reason:"CITA_EXISTS"};
  return {eligible:true,reason:"ORPHAN_CANDIDATE"};
}
async function reconcileFixture(db,{slotKey,expectedCitaId,fixtureMarker}){
  validateLab(db);assertSlotKey(slotKey);
  // Deliberately restrict mutations to synthetic fixtures.
  if(!/^LAB-ORPHAN-RECON-[A-Z0-9-]+$/.test(expectedCitaId) ||
     fixtureMarker!=="habitat-reconciler-emulator-v1")
    throw Error("LAB_FIXTURE_ONLY");
  const candidate=await inspectCandidate(db,slotKey,expectedCitaId);
  if(!candidate.eligible)return {released:false,reason:candidate.reason};
  const ref=db.ref("citas_publicas/"+slotKey);
  const result=await ref.transaction(current=>{
    if(!current||current.citaId!==expectedCitaId||
       current.status!=="confirmed"||
       current.fixtureMarker!==fixtureMarker)return;
    return null;
  },undefined,false);
  return result.committed?
    {released:true,reason:"FIXTURE_RELEASED"}:
    {released:false,reason:"SLOT_CHANGED"};
}
module.exports={inspectCandidate,reconcileFixture};
