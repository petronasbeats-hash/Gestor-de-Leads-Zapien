"use strict";
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {bookWithAvailability,MARKER}=require("./availability-gate-lab");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"availability-gate-test");
const db=getDatabase(app), root=db.ref("lab_availability_gate/units");
const base=db.ref("lab_admin_booking");
const ids=["LAB-HAB-GATE-AVAILABLE","LAB-HAB-GATE-OCCUPIED","LAB-HAB-GATE-BLOCKED"];
const requestIds=["LAB-ADMIN-GATE-OK","LAB-ADMIN-GATE-OCCUPIED","LAB-ADMIN-GATE-BLOCKED","LAB-ADMIN-GATE-MISSING","LAB-ADMIN-GATE-STALE"];
const slots=["2099-12-28_12:00","2099-12-28_12:30","2099-12-28_13:00","2099-12-28_13:30","2099-12-28_14:00"];
async function clean(){
 for(const id of ids){const r=root.child(id),v=(await r.once("value")).val();if(v?.marker===MARKER)await r.remove();else if(v)throw Error("UNOWNED_UNIT: "+id);}
 for(const id of requestIds){for(const path of ["requests/"+id,"citas/LAB-CITA-"+id]){const r=base.child(path),v=(await r.once("value")).val();if(v?.marker==="habitat-admin-booking-lab-v01")await r.remove();else if(v)throw Error("UNOWNED_BOOKING: "+path);}
 const r=base.child("events/"+id),v=(await r.once("value")).val();if(v&&Object.values(v).every(x=>x.marker==="habitat-admin-booking-lab-v01"))await r.remove();else if(v)throw Error("UNOWNED_EVENTS");}
 for(const key of slots){const r=base.child("slots/"+key),v=(await r.once("value")).val();if(v?.marker==="habitat-admin-booking-lab-v01")await r.remove();else if(v)throw Error("UNOWNED_SLOT");}
}
function input(i,unitId,version=1){return {requestId:requestIds[i],slotKey:slots[i],unitId,availabilityVersion:version};}
(async()=>{
 await clean();
 await root.child(ids[0]).set({marker:MARKER,commercialStatus:"available",visitsEnabled:true,version:1});
 await root.child(ids[1]).set({marker:MARKER,commercialStatus:"occupied",visitsEnabled:true,version:1});
 await root.child(ids[2]).set({marker:MARKER,commercialStatus:"available",visitsEnabled:false,version:1});
 const ok=input(0,ids[0]);
 assert.equal((await bookWithAvailability(db,ok)).ok,true);
 await assert.rejects(()=>bookWithAvailability(db,input(1,ids[1])),/UNIT_NOT_VISITABLE/);
 await assert.rejects(()=>bookWithAvailability(db,input(2,ids[2])),/UNIT_NOT_VISITABLE/);
 await assert.rejects(()=>bookWithAvailability(db,input(3,"LAB-HAB-GATE-MISSING")) ,/UNIT_NOT_VERIFIED/);
 await assert.rejects(()=>bookWithAvailability(db,input(4,ids[0],0)),/STALE_AVAILABILITY/);
 await root.child(ids[0]).update({commercialStatus:"occupied",version:2});
 assert.equal((await bookWithAvailability(db,ok)).citaId,"LAB-CITA-"+ok.requestId);
 await assert.rejects(()=>bookWithAvailability(db,{...ok,slotKey:slots[4]}),/IDEMPOTENCY_CONFLICT/);
 console.log("PASS: trusted availability gate, occupied/blocked/missing/stale denied; confirmed replay survives status change");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await clean();await deleteApp(app)});
