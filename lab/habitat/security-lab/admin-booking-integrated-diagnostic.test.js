"use strict";
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {book,MARKER}=require("./admin-booking-lab");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"admin-booking-integrated-diagnostic");
const db=getDatabase(app), base=db.ref("lab_admin_booking");
const slotKey="2099-12-23_12:00";
const ids=Array.from({length:20},(_,i)=>"LAB-ADMIN-INT-"+String(i+1).padStart(2,"0"));
async function clean(){
  for(const id of ids){
    const req=base.child("requests/"+id), rv=(await req.once("value")).val();
    if(rv?.marker===MARKER)await req.remove();
    const cita=base.child("citas/LAB-CITA-"+id), cv=(await cita.once("value")).val();
    if(cv?.marker===MARKER)await cita.remove();
    const ev=base.child("events/"+id), evv=(await ev.once("value")).val();
    if(evv&&Object.values(evv).every(x=>x.marker===MARKER))await ev.remove();
  }
  const slot=base.child("slots/"+slotKey), sv=(await slot.once("value")).val();
  if(sv?.marker===MARKER)await slot.remove();
}
(async()=>{
  await clean();
  const settled=await Promise.all(ids.map(async requestId=>{
    try{
      const r=await book(db,{requestId,slotKey,unitId:"LAB-HAB-YANG-01"});
      return {requestId,status:"fulfilled",result:r};
    }catch(e){
      return {requestId,status:"rejected",message:e.message,identityTrace:e.identityTrace||null,fingerprint:e.fingerprint||null};
    }
  }));
  console.log("INTEGRATED_DIAGNOSTIC",JSON.stringify(settled,null,2));
  const reqDump=(await base.child("requests").once("value")).val();
  console.log("REQUESTS_DUMP",JSON.stringify(reqDump,null,2));
  const slotDump=(await base.child("slots/"+slotKey).once("value")).val();
  console.log("SLOT_DUMP",JSON.stringify(slotDump,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await clean();await deleteApp(app)});
