"use strict";
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {claim,changeStatus,MARKER,ROOT}=require("./availability-atomic-v2-cas");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"atomic-v2-cas-test");
const db=getDatabase(app);
const unitId="LAB-HAB-ATOMIC-CAS",ref=db.ref(ROOT+"/units/"+unitId);
const slot="2099-12-30_12:00",second="2099-12-30_13:00";
async function clean(){const v=(await ref.once("value")).val();if(v?.marker===MARKER)await ref.remove();else if(v)throw Error("UNOWNED_FIXTURE");}
(async()=>{
 await clean();
 await ref.set({marker:MARKER,commercialStatus:"available",visitsEnabled:true,version:1});
 // Security preflight: unauthenticated REST remains denied, emulator owner access succeeds.
 const endpoint="http://127.0.0.1:9100/"+ROOT+"/units/"+unitId+".json?ns=demo-habitat-security-lab-default-rtdb";
 const anonymous=await fetch(endpoint);
 assert.equal(anonymous.status,401,"Private lab node must deny public REST reads");
 const trusted=await fetch(endpoint+"&access_token=owner",{headers:{"X-Firebase-ETag":"true"}});
 assert.equal(trusted.status,200,"Emulator owner REST access must succeed");
 assert.ok(trusted.headers.get("etag"),"ETag required for CAS");
 assert.equal((await trusted.json()).marker,MARKER);
 console.log("PASS: public REST denied, trusted emulator REST authorized with ETag");
 const results=await Promise.all(Array.from({length:20},(_,i)=>claim({unitId,slotKey:slot,requestId:"LAB-ADMIN-CAS-"+String(i+1).padStart(2,"0"),expectedVersion:1})));
 const summary=results.reduce((a,r)=>{const k=r.ok?(r.replayed?"OK_REPLAY":"OK"):r.reason;a[k]=(a[k]||0)+1;return a;},{});
 console.log("DIAG CAS contenders:",summary);
 assert.equal(results.filter(r=>r.ok).length,1);
 assert.equal(results.filter(r=>r.reason==="SLOT_TAKEN").length,19);
 const current=(await ref.once("value")).val();
 const winner=current.slots[slot].requestId;
 assert.equal((await claim({unitId,slotKey:slot,requestId:winner,expectedVersion:1})).replayed,true);
 assert.equal((await claim({unitId,slotKey:"2099-12-30_12:30",requestId:winner,expectedVersion:1})).reason,"IDEMPOTENCY_CONFLICT");
 const [status,booking]=await Promise.all([
  changeStatus({unitId,expectedVersion:1,commercialStatus:"occupied",visitsEnabled:false}),
  claim({unitId,slotKey:second,requestId:"LAB-ADMIN-CAS-RACE",expectedVersion:1})
 ]);
 const final=(await ref.once("value")).val();
 assert.equal(final.commercialStatus,"occupied");
 assert.equal(final.version,2);
 if(booking.ok) assert.equal(final.slots[second].requestId,"LAB-ADMIN-CAS-RACE");
 else assert.equal(booking.reason,"STALE_AVAILABILITY");
 assert.equal(status.ok,true);
 assert.equal((await claim({unitId,slotKey:"2099-12-30_14:00",requestId:"LAB-ADMIN-CAS-LATE",expectedVersion:2})).reason,"UNIT_NOT_VISITABLE");
 assert.equal((await claim({unitId,slotKey:slot,requestId:winner,expectedVersion:1})).replayed,true);
 console.log("PASS: CAS atomic unit-status/slot coordination, 20 contenders, status race and replay");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await clean();await deleteApp(app)});
