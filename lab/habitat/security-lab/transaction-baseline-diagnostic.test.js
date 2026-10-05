"use strict";
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"tx-baseline-diagnostic");
const db=getDatabase(app);
const ref=db.ref("lab_tx_baseline_diagnostic/unit");
const MARKER="tx-baseline-diagnostic-v1";
(async()=>{
 const old=(await ref.once("value")).val();
 if(old?.marker===MARKER)await ref.remove(); else if(old)throw Error("UNOWNED_FIXTURE");
 await ref.set({marker:MARKER,version:1,value:"ready"});
 const read=(await ref.once("value")).val();
 console.log("DIAG pre-read:",JSON.stringify(read));
 assert.equal(read.marker,MARKER);

 const seen=[];
 const tx=await ref.transaction(current=>{
   seen.push(current===null?null:current);
   if(current===null)return;
   return {...current,touched:true};
 },undefined,true);

 console.log("DIAG tx committed:",tx.committed);
 console.log("DIAG tx seen:",JSON.stringify(seen));
 console.log("DIAG post-read:",JSON.stringify((await ref.once("value")).val()));

 if(tx.committed){
   assert.equal((await ref.once("value")).val().touched,true);
   console.log("PASS: transaction observed existing state");
 }else{
   console.log("FAIL-DIAG: transaction aborted because callback observed null");
   process.exitCode=2;
 }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 const v=(await ref.once("value")).val();
 if(v?.marker===MARKER)await ref.remove();
 await deleteApp(app);
});
