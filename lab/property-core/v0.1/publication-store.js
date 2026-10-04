"use strict";
// Emulator-only conditional publication; no browser or production endpoint.
const {publicationDecision}=require("./publication-gate");
const {ROOT,MARKER}=require("./property-store");
const HOST=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
function guard(){if(HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");}
function url(id){return `http://${HOST}/${ROOT}/entities/${encodeURIComponent(id)}.json?ns=demo-habitat-security-lab-default-rtdb&access_token=owner`;}
async function publish(_db,{entityId,expectedRevision,property,building,priceMXN,evidenceIds,requestId}){
 guard();
 if(!/^[A-Za-z0-9_-]{2,80}$/.test(entityId||"")||!/^[A-Za-z0-9_-]{2,80}$/.test(requestId||"")||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw Error("INVALID_REQUEST");
 const request={expectedRevision,priceMXN,evidenceIds};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 for(let attempt=0;attempt<50;attempt++){
  const read=await fetch(url(entityId),{headers:{"X-Firebase-ETag":"true"}});
  if(!read.ok)throw Error("READ_FAILED_"+read.status);
  const etag=read.headers.get("etag");
  if(!etag)throw Error("MISSING_ETAG");
  const current=await read.json();
  if(!current||current.marker!==MARKER)throw Error("ENTITY_NOT_FOUND");
  const existing=current.publicationRequests?.[requestId];
  if(existing){
   if(same(existing.request,request))return existing.publication;
   throw Error("REQUEST_ID_CONFLICT");
  }
  if(current.revision!==expectedRevision)throw Error("STALE_REVISION");
  const decision=publicationDecision(property,building,current.record,{priceMXN,evidenceIds});
  if(!decision.allowed)throw Error(decision.reason);
  const publication={requestId,priceMXN,evidenceIds,unitId:entityId,revision:current.revision+1};
  const next={...current,revision:current.revision+1,publication,publicationRequests:{...current.publicationRequests,[requestId]:{request,publication}}};
  const res=await fetch(url(entityId),{method:"PUT",headers:{"content-type":"application/json","if-match":etag},body:JSON.stringify(next)});
  if(res.status===200)return publication;
  if(res.status!==412)throw Error("WRITE_FAILED_"+res.status);
 }
 throw Error("PUBLICATION_CAS_RETRY_EXHAUSTED");
}
module.exports={publish};
