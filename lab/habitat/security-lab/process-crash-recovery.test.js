"use strict";
// Emulator-only cross-process failure injection. Run phases in separate Node processes.
// Usage:
// FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9100 node process-crash-recovery.test.js inject-claim
// FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9100 node process-crash-recovery.test.js verify-claim
// ... likewise inject-cita / verify-cita
const assert = require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {book,MARKER}=require("./admin-booking-lab");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("ISOLATED_EMULATOR_REQUIRED");
const phase=process.argv[2];
const phases=["inject-claim","verify-claim","inject-cita","verify-cita"];
if(!phases.includes(phase))throw Error("PHASE_REQUIRED: "+phases.join("|"));
const kind=phase.endsWith("claim")?"claim":"cita";
const input={
 requestId:"LAB-ADMIN-PROCESS-"+kind.toUpperCase(),
 slotKey:kind==="claim"?"2099-12-27_12:00":"2099-12-27_12:30",
 unitId:"LAB-HAB-YANG-01"
};
const app=initializeApp({
 projectId:"demo-habitat-security-lab",
 databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"
},"process-crash-"+phase);
const db=getDatabase(app),base=db.ref("lab_admin_booking");
(async()=>{
 if(phase.startsWith("inject-")){
   // Only remove this test's own marked fixtures. No parent deletion.
   const req=base.child("requests/"+input.requestId);
   const slot=base.child("slots/"+input.slotKey);
   const cita=base.child("citas/LAB-CITA-"+input.requestId);
   const events=base.child("events/"+input.requestId);
   for(const ref of [req,slot,cita]){
     const v=(await ref.once("value")).val();
     if(v&&v.marker===MARKER)await ref.remove();
     else if(v)throw Error("UNOWNED_FIXTURE: "+ref.key);
   }
   const ev=(await events.once("value")).val();
   if(ev&&Object.values(ev).every(v=>v.marker===MARKER))await events.remove();
   else if(ev)throw Error("UNOWNED_EVENTS");
   await assert.rejects(
     ()=>book(db,input,kind==="claim"?"after_claim":"after_cita"),
     new RegExp(kind==="claim"?"INJECTED_AFTER_CLAIM":"INJECTED_AFTER_CITA")
   );
   const stored=(await req.once("value")).val();
   const held=(await slot.once("value")).val();
   assert.equal(stored.fingerprint,JSON.stringify([input.slotKey,input.unitId]));
   assert.equal(held.requestId,input.requestId);
   assert.equal(held.status,"processing");
   const savedCita=(await cita.once("value")).val();
   assert.equal(Boolean(savedCita),kind==="cita");
   console.log("PASS INJECT "+kind+": durable incomplete state verified; run verify in NEW Node process");
 } else {
   const result=await book(db,input);
   assert.equal(result.ok,true);
   assert.equal(result.citaId,"LAB-CITA-"+input.requestId);
   const [req,slot,cita,events]=await Promise.all([
     base.child("requests/"+input.requestId).once("value"),
     base.child("slots/"+input.slotKey).once("value"),
     base.child("citas/"+result.citaId).once("value"),
     base.child("events/"+input.requestId).once("value")
   ]);
   assert.equal(req.val().status,"confirmed");
   assert.equal(req.val().fingerprint,JSON.stringify([input.slotKey,input.unitId]));
   assert.equal(slot.val().status,"confirmed");
   assert.equal(cita.val().requestId,input.requestId);
   assert.deepEqual(Object.keys(events.val()).sort(),["cita_created","confirmed"]);
   const again=await book(db,input);
   assert.deepEqual(again,result);
   console.log("PASS VERIFY "+kind+": recovery in a new process, same cita and deduplicated evidence");
 }
})().catch(e=>{console.error("FAIL:",e);process.exitCode=1}).finally(()=>deleteApp(app));
