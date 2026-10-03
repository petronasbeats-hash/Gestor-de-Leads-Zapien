"use strict";
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {book,MARKER}=require("./admin-booking-lab");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"admin-booking-test");
const db=getDatabase(app), base=db.ref("lab_admin_booking");
const raceSlot="2099-12-21_12:00", sameSlot="2099-12-21_12:30", failSlot="2099-12-21_13:00";
const race=Array.from({length:20},(_,i)=>"LAB-ADMIN-RACE-"+String(i+1).padStart(2,"0"));
const ids=[...race,"LAB-ADMIN-SAME","LAB-ADMIN-FAIL"];
async function clean(){
  for(const id of ids){
    for(const [path,expected] of [["requests/"+id,MARKER],["citas/LAB-CITA-"+id,MARKER]]){
      const ref=base.child(path),v=(await ref.once("value")).val();
      if(v?.marker===expected)await ref.remove();
    }
    const e=base.child("events/"+id),v=(await e.once("value")).val();
    if(v&&Object.values(v).every(x=>x.marker===MARKER))await e.remove();
  }
  for(const key of [raceSlot,sameSlot,failSlot]){
    const ref=base.child("slots/"+key),v=(await ref.once("value")).val();
    if(v?.marker===MARKER)await ref.remove();
  }
}
(async()=>{
  await clean();
  const results=await Promise.all(race.map(requestId=>book(db,{requestId,slotKey:raceSlot,unitId:"LAB-HAB-YANG-01"})));
  assert.equal(results.filter(r=>r.ok).length,1);
  const same={requestId:"LAB-ADMIN-SAME",slotKey:sameSlot,unitId:"LAB-HAB-YANG-01"};
  const repeats=await Promise.all(Array.from({length:20},()=>book(db,same)));
  assert(repeats.every(r=>r.ok&&r.citaId===repeats[0].citaId));
  await assert.rejects(()=>book(db,{...same,slotKey:"2099-12-21_14:00"}),/IDEMPOTENCY_CONFLICT/);
  const fail={requestId:"LAB-ADMIN-FAIL",slotKey:failSlot,unitId:"LAB-HAB-YANG-01"};
  await assert.rejects(()=>book(db,fail,"after_cita"),/INJECTED_AFTER_CITA/);
  assert.equal((await book(db,fail)).ok,true);
  const events=(await base.child("events/"+same.requestId).once("value")).val();
  assert.deepEqual(Object.keys(events).sort(),["cita_created","confirmed"]);
  assert.equal((await base.child("citas/LAB-CITA-"+same.requestId).once("value")).val().requestId,same.requestId);
  console.log("PASS: Admin SDK 20 distinct contenders, 20 identical retries, recovery and deduplicated evidence");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await clean();await deleteApp(app)});
