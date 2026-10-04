"use strict";
// Emulator-only transactional publication. Never exposed as a public endpoint.
const {publicationDecision}=require("./publication-gate");
const {ROOT,MARKER}=require("./property-store");
function guard(){if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");}
async function publish(db,{entityId,expectedRevision,property,building,priceMXN,evidenceIds,requestId}){
 guard();
 if(!/^[A-Za-z0-9_-]{2,80}$/.test(entityId||"")||!/^[A-Za-z0-9_-]{2,80}$/.test(requestId||"")||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw Error("INVALID_REQUEST");
 const ref=db.ref(ROOT+"/entities/"+entityId);
 const request={expectedRevision,priceMXN,evidenceIds};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 let failure=null;
 const tx=await ref.transaction(current=>{
  if(!current||current.marker!==MARKER){failure="ENTITY_NOT_FOUND";return;}
  const existing=current.publicationRequests?.[requestId];
  if(existing){
   if(same(existing.request,request))return current;
   failure="REQUEST_ID_CONFLICT";return;
  }
  if(current.revision!==expectedRevision){failure="STALE_REVISION";return;}
  let decision;
  try{decision=publicationDecision(property,building,current.record,{priceMXN,evidenceIds})}
  catch(e){failure=e.message;return;}
  if(!decision.allowed){failure=decision.reason;return;}
  const publication={requestId,priceMXN,evidenceIds,unitId:entityId,revision:current.revision+1};
  return {...current,revision:current.revision+1,publication,publicationRequests:{...current.publicationRequests,[requestId]:{request,publication}}};
 },undefined,false);
 const latest=tx.committed?tx.snapshot.val():(await ref.once("value")).val();
 const persisted=latest?.publicationRequests?.[requestId];
 if(persisted){
  if(same(persisted.request,request))return persisted.publication;
  throw Error("REQUEST_ID_CONFLICT");
 }
 if(!tx.committed){
  if(latest?.marker===MARKER){
   if(latest.revision!==expectedRevision)throw Error("STALE_REVISION");
   const decision=publicationDecision(property,building,latest.record,{priceMXN,evidenceIds});
   if(!decision.allowed)throw Error(decision.reason);
  }
  throw Error(failure||"PUBLICATION_CONFLICT");
 }
 throw Error("INTERNAL_PUBLICATION_ERROR");
}
module.exports={publish};
