"use strict";
// Isolated diagnostic: identity transactions, then shared-slot contention.
// This file does not call book(), change security rules, or touch production.
const assert = require("node:assert/strict");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getDatabase} = require("firebase-admin/database");

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9100") {
  throw Error("EMULATOR_9100_REQUIRED");
}
const app = initializeApp({
  projectId: "demo-habitat-security-lab",
  databaseURL: "https://demo-habitat-security-lab-default-rtdb.firebaseio.com"
}, "admin-booking-phase-diagnostic");
const db = getDatabase(app);
const root = db.ref("lab_booking_phase_diagnostic");
const marker = "LAB-PHASE-DIAG-01";
const ids = Array.from({length:20}, (_,i) => "LAB-ADMIN-DIAG-"+String(i+1).padStart(2,"0"));
const slotKey = "2099-12-22_12:00";
const fingerprint = JSON.stringify([slotKey,"LAB-HAB-YANG-01"]);
const observations = [];
async function clean() {
  const snap = await root.once("value");
  const v = snap.val();
  if (v && v.marker === marker) await root.remove();
}
(async () => {
  await clean();
  await root.set({marker});
  // Phase 1: every contender owns an independent identity.
  const identities = await Promise.all(ids.map(async id => {
    const ref = root.child("requests/"+id);
    const result = await ref.transaction(current => {
      observations.push({phase:"identity",id,current:current===null?"null":current});
      if (current === null) return {id,fingerprint,marker};
      if (current.id===id && current.fingerprint===fingerprint) return current;
      return;
    },undefined,false);
    return {id,committed:result.committed,value:result.snapshot.val()};
  }));
  console.log("IDENTITY_RESULTS",JSON.stringify(identities));
  assert(identities.every(x => x.committed && x.value?.id===x.id),
    "Independent request identity phase failed");

  // Phase 2: 20 distinct owners compete for one slot.
  const slot = root.child("slots/"+slotKey);
  const claims = await Promise.all(ids.map(async id => {
    const result = await slot.transaction(current => {
      observations.push({phase:"slot",id,current:current===null?"null":current});
      if (current === null) return {requestId:id,marker,status:"processing"};
      if (current.requestId===id && current.marker===marker) return current;
      return;
    },undefined,false);
    return {id,committed:result.committed,value:result.snapshot.val()};
  }));
  const winners=claims.filter(x=>x.committed);
  const stored=(await slot.once("value")).val();
  console.log("SLOT_RESULTS",JSON.stringify(claims));
  console.log("SLOT_STORED",JSON.stringify(stored));
  console.log("CALLBACKS",JSON.stringify(observations));
  assert.equal(winners.length,1,"Expected exactly one shared-slot winner");
  assert.equal(stored.requestId,winners[0].id);
  console.log("PASS: 20 independent identities and exactly one shared-slot winner");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  try {await clean();} finally {await deleteApp(app);}
});
