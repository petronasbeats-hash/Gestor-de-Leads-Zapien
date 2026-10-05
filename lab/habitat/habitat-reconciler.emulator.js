/* Habitat Lab: server-side reconciliation prototype.
   Only use against demo-synapse-lab RTDB emulator.
   NOT safe for production without trusted server authority, RTDB rules
   and a durable event log. */
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
  if(!/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(key))
    throw Error("INVALID_SLOT_KEY");
}

async function inspectCandidate(db,slotKey,expectedCitaId){
  validateLab(db); assertSlotKey(slotKey);
  if(!expectedCitaId||typeof expectedCitaId!=="string")
    throw Error("INVALID_CITA_ID");

  const slotRef=db.ref("citas_publicas/"+slotKey);
  const slot=(await slotRef.once("value")).val();
  if(!slot)return {eligible:false,reason:"SLOT_ABSENT"};
  if(slot.citaId!==expectedCitaId)return {eligible:false,reason:"OWNER_CHANGED"};
  if(slot.status!=="confirmed")return {eligible:false,reason:"NOT_CONFIRMED"};

  const cita=(await db.ref("citas/"+expectedCitaId).once("value")).val();
  if(cita)return {eligible:false,reason:"CITA_EXISTS"};

  return {eligible:true,reason:"ORPHAN_CANDIDATE"};
}

async function reconcileFixture(db,{slotKey,expectedCitaId,fixtureMarker}){
  validateLab(db); assertSlotKey(slotKey);

  if(!/^LAB-ORPHAN-RECON-[A-Z0-9-]+$/.test(expectedCitaId) ||
     fixtureMarker!=="habitat-reconciler-emulator-v1")
    throw Error("LAB_FIXTURE_ONLY");

  const candidate=await inspectCandidate(db,slotKey,expectedCitaId);
  if(!candidate.eligible)return {released:false,reason:candidate.reason};

  const citaNow=(await db.ref("citas/"+expectedCitaId).once("value")).val();
  if(citaNow)return {released:false,reason:"CITA_APPEARED"};

  const ref=db.ref("citas_publicas/"+slotKey);

  // IMPORTANT: in this client/emulator combination, a destructive follow-up
  // transaction after a prior read can observe current=null. Do not infer that
  // as ownership. Instead perform a final read + identity check, then remove.
  // This remains LAB ONLY because read-then-remove is not race-safe for prod.
  const current=(await ref.once("value")).val();
  if(!current)return {released:false,reason:"SLOT_ABSENT"};
  if(current.citaId!==expectedCitaId)return {released:false,reason:"OWNER_CHANGED"};
  if(current.status!=="confirmed")return {released:false,reason:"NOT_CONFIRMED"};
  if(current.fixtureMarker!==fixtureMarker)return {released:false,reason:"FIXTURE_MARKER_MISMATCH"};

  await ref.remove();
  return {released:true,reason:"FIXTURE_RELEASED_LAB_READ_REMOVE"};
}

module.exports={inspectCandidate,reconcileFixture};
