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
 const before=(await ref.once("value")).val();
 assert.equal(before?.marker,MARKER,"fixture marker must persist");
 assert.equal(before?.revision,revision,"fixture revision must persist");
 assert.equal(before?.record?.unitId,entityId,"fixture record must persist");
 console.log("DIAGNOSTIC publication fixture durable",JSON.stringify({marker:before.marker,revision:before.revision,unitId:before.record.unitId}));
 const first=await publish(db,args);
 const results=await Promise.all(Array.from({length:20},()=>publish(db,args)));
 assert.equal(first.requestId,args.requestId);
 assert.equal(results.every(x=>x.requestId===args.requestId),true);
 const saved=(await ref.once("value")).val();
 assert.equal(saved.revision,revision+1);
 assert.equal(Object.keys(saved.publicationRequests).length,1);
 await assert.rejects(publish(db,{...args,requestId:"LAB-PUB-NEW"}),/STALE_REVISION/);
 await assert.rejects(publish(db,{...args,priceMXN:4000}),/REQUEST_ID_CONFLICT/);
 // Two distinct requests race against one fresh revision: exactly one may commit.
 const latest=(await ref.once("value")).val();
 await ref.update({publication:null,publicationRequests:null,revision:latest.revision+1});
 const fresh=(await ref.once("value")).val().revision;
 const competing=await Promise.allSettled([
  publish(db,{...args,expectedRevision:fresh,requestId:"LAB-PUB-RACE-A"}),
  publish(db,{...args,expectedRevision:fresh,requestId:"LAB-PUB-RACE-B",priceMXN:3600})
 ]);
 assert.equal(competing.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(competing.filter(x=>x.status==="rejected"&&/STALE_REVISION/.test(x.reason.message)).length,1);
 const raced=(await ref.once("value")).val();
 assert.equal(raced.revision,fresh+1);
 assert.equal(Object.keys(raced.publicationRequests).length,1);
 assert.equal(raced.publication.requestId,competing.find(x=>x.status==="fulfilled").value.requestId);

 console.log("PASS: atomic publication 20 identical contenders, single revision, distinct race single winner, stale and conflicting requests rejected");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{const v=(await ref.once("value")).val();if(v?.marker===MARKER)await ref.remove();await deleteApp(app)});
