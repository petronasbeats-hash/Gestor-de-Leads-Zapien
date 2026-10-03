"use strict";
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {claim,changeStatus,MARKER,ROOT}=require("./availability-atomic-v2");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"atomic-v2-test");
const db=getDatabase(app);
const unitId="LAB-HAB-ATOMIC-V2",ref=db.ref(ROOT+"/units/"+unitId);
const slot="2099-12-29_12:00",second="2099-12-29_13:00";
async function clean(){const v=(await ref.once("value")).val();if(v?.marker===MARKER)await ref.remove();else if(v)throw Error("UNOWNED_FIXTURE");}
(async()=>{
 await clean();
 await ref.set({marker:MARKER,commercialStatus:"available",visitsEnabled:true,version:1});
 const contenders=Array.from({length:20},(_,i)=>claim(db,{unitId,slotKey:slot,requestId:"LAB-ADMIN-ATOMIC-"+String(i+1).padStart(2,"0"),expectedVersion:1}));
 const results=await Promise.all(contenders);
 const summary=results.reduce((acc,r)=>{const k=r.ok?(r.replayed?"OK_REPLAY":"OK"):r.reason;acc[k]=(acc[k]||0)+1;return acc;},{});
 console.log("DIAG contenders:",summary);
 console.log("DIAG unit after contenders:",JSON.stringify((await ref.once("value")).val()));
 assert.equal(results.filter(r=>r.ok).length,1);
 assert.equal(results.filter(r=>r.reason==="SLOT_TAKEN").length,19);
 const winner=(await ref.once("value")).val().slots[slot].requestId;
 assert.equal((await claim(db,{unitId,slotKey:slot,requestId:winner,expectedVersion:1})).replayed,true);
 // Status update and new claim race at the SAME unit node.
 const [status,booking]=await Promise.all([
   changeStatus(db,{unitId,expectedVersion:1,commercialStatus:"occupied",visitsEnabled:false}),
   claim(db,{unitId,slotKey:second,requestId:"LAB-ADMIN-ATOMIC-RACE",expectedVersion:1})
 ]);
 assert.equal(status.ok,true);
 const final=(await ref.once("value")).val();
 assert.equal(final.commercialStatus,"occupied");
 assert.equal(final.version,2);
 if(booking.ok)assert.equal(final.slots[second].requestId,"LAB-ADMIN-ATOMIC-RACE");
 else assert.equal(booking.reason,"STALE_AVAILABILITY");
 assert.equal((await claim(db,{unitId,slotKey:"2099-12-29_14:00",requestId:"LAB-ADMIN-ATOMIC-LATE",expectedVersion:2})).reason,"UNIT_NOT_VISITABLE");
 assert.equal((await claim(db,{unitId,slotKey:slot,requestId:winner,expectedVersion:1})).replayed,true);
 console.log("PASS: atomic unit-status/slot transactions, 20 contenders, status race and replay");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await clean();await deleteApp(app)});
