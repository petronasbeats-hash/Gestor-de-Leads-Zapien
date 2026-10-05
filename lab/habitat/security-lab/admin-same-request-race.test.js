"use strict";
// Isolated Admin SDK lab fixture. Not a production booking endpoint.
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")
  throw Error("SECURITY_EMULATOR_9100_REQUIRED");
const projectId="demo-habitat-security-lab";
const app=initializeApp({projectId,databaseURL:"https://"+projectId+"-default-rtdb.firebaseio.com"},"habitat-admin-race");
const db=getDatabase(app);
const prefix="security_booking_lab/LAB-ADMIN-RACE-01";
const fixture="LAB-ADMIN-RACE-01";
const requestId="LAB-REQ-SAME-01";
const slotKey="2099-12-29_12:00";
const citaId="LAB-CITA-SAME-01";
async function event(type){
  // Deterministic event IDs: retries cannot duplicate transitions.
  await db.ref(prefix+"/events/"+type).set({type,requestId,fixture});
}
async function book(){
  const req=db.ref(prefix+"/requests/"+requestId);
  const acquired=await req.transaction(current=>{
    if(current!==null)return; // Only first worker becomes owner.
    return {status:"processing",slotKey,citaId,fixture};
  },undefined,false);
  if(!acquired.committed){
    const state=(await req.once("value")).val();
    if(state?.status==="confirmed")return {status:"confirmed",replay:true};
    return {status:"processing",replay:true};
  }
  await event("REQUEST_RECEIVED");
  const slot=db.ref(prefix+"/slots/"+slotKey);
  const claim=await slot.transaction(current=>{
    if(current!==null)return;
    return {requestId,citaId,status:"processing",fixture};
  },undefined,false);
  assert(claim.committed,"owner must claim slot");
  await event("SLOT_CLAIMED");
  await db.ref(prefix+"/citas/"+citaId).set({requestId,slotKey,fixture});
  await event("CITA_CREATED");
  await slot.update({status:"confirmed"});
  await req.update({status:"confirmed"});
  await event("BOOKING_CONFIRMED");
  return {status:"confirmed",replay:false};
}
(async()=>{
  // Do not delete other fixtures or any production paths.
  const root=db.ref(prefix);
  if((await root.once("value")).exists())throw Error("FIXTURE_ALREADY_EXISTS: inspect before rerun");
  try{
    const results=await Promise.all(Array.from({length:20},()=>book()));
    assert.equal(results.filter(r=>!r.replay).length,1);
    assert(results.every(r=>["processing","confirmed"].includes(r.status)));
    const req=(await db.ref(prefix+"/requests/"+requestId).once("value")).val();
    assert.equal(req.status,"confirmed");
    const citas=(await db.ref(prefix+"/citas").once("value")).val();
    assert.equal(Object.keys(citas).length,1);
    const events=(await db.ref(prefix+"/events").once("value")).val();
    assert.deepEqual(Object.keys(events).sort(),["BOOKING_CONFIRMED","CITA_CREATED","REQUEST_RECEIVED","SLOT_CLAIMED"].sort());
    const replay=await book();
    assert.equal(replay.replay,true);
    console.log("PASS: Admin SDK same-request 20-way race, single cita and deterministic event trace");
  }finally{
    const data=(await root.once("value")).val();
    if(data?.requests?.[requestId]?.fixture===fixture)await root.remove();
  }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>deleteApp(app));
