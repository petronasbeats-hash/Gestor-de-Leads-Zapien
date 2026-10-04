"use strict";
const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const {property,building,unit}=require("./property-model");
const {create,advance,ROOT,MARKER}=require("./property-store");
const {publish}=require("./publication-store");
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
const app=initializeApp({projectId:"demo-habitat-security-lab",databaseURL:"https://demo-habitat-security-lab-default-rtdb.firebaseio.com"},"publication-test");
const db=getDatabase(app),entityId="LAB-PUBLICATION-U1",ref=db.ref(ROOT+"/entities/"+entityId);
const p=property({propertyId:"LAB-PUBLICATION-P1",name:"Pilot"}),b=building({buildingId:"LAB-PUBLICATION-B1",propertyId:p.propertyId,name:"Building"});
const u=unit({unitId:entityId,propertyId:p.propertyId,buildingId:b.buildingId,number:"1",type:"suite"});
(async()=>{
 const old=(await ref.once("value")).val();
 if(old&&old.marker!==MARKER)throw Error("UNOWNED_FIXTURE");
 if(old)await ref.remove();
 await create(db,u);
 // Isolate publication transaction from the separately tested verification workflow.
 // This synthetic fixture is never a production activation or evidence approval.
 const current=(await ref.once("value")).val();
 await ref.update({record:{...current.record,verification:"active",occupancy:"vacant",operation:"available"},revision:current.revision+1});
 const revision=(await ref.once("value")).val().revision;
 const args={entityId,expectedRevision:revision,property:p,building:b,priceMXN:3500,evidenceIds:["LAB-EVIDENCE"],requestId:"LAB-PUB-REQUEST"};
 const first=await publish(db,args);
 const results=await Promise.all(Array.from({length:20},()=>publish(db,args)));
 assert.equal(first.requestId,args.requestId);
 assert.equal(results.every(x=>x.requestId===args.requestId),true);
 const saved=(await ref.once("value")).val();
 assert.equal(saved.revision,revision+1);
 assert.equal(Object.keys(saved.publicationRequests).length,1);
 await assert.rejects(publish(db,{...args,requestId:"LAB-PUB-NEW"}),/STALE_REVISION/);
 await assert.rejects(publish(db,{...args,priceMXN:4000}),/REQUEST_ID_CONFLICT/);
 console.log("PASS: atomic publication 20 identical contenders, single revision, stale and conflicting requests rejected");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{const v=(await ref.once("value")).val();if(v?.marker===MARKER)await ref.remove();await deleteApp(app)});
