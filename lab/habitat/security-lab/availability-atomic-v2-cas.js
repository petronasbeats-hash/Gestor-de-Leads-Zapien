"use strict";
// LAB ONLY. Atomic availability via conditional REST PUT (ETag / If-Match)
// because firebase-admin transaction callback observes null in this emulator environment.
const MARKER="habitat-atomic-v2-cas";
const ROOT="lab_atomic_availability_v2_cas";
const HOST=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
function guard(){if(HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");}
function validate({unitId,slotKey,requestId,expectedVersion}){
 guard();
 if(!/^LAB-HAB-[A-Z0-9-]+$/.test(unitId)||!/^2099-\d\d-\d\d_\d\d:\d\d$/.test(slotKey)||!/^LAB-ADMIN-[A-Z0-9-]+$/.test(requestId))throw Error("INVALID_LAB_INPUT");
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw Error("INVALID_VERSION");
}
function url(unitId){return `http://${HOST}/${ROOT}/units/${encodeURIComponent(unitId)}.json?ns=demo-habitat-security-lab-default-rtdb`;}
async function readWithEtag(unitId){
 const res=await fetch(url(unitId),{headers:{"X-Firebase-ETag":"true"}});
 if(!res.ok)throw Error("READ_FAILED_"+res.status);
 return {etag:res.headers.get("etag"),value:await res.json()};
}
async function putIfMatch(unitId,etag,value){
 return fetch(url(unitId),{method:"PUT",headers:{"content-type":"application/json","if-match":etag},body:JSON.stringify(value)});
}
async function claim(input){
 validate(input);
 const {unitId,slotKey,requestId,expectedVersion}=input;
 for(let attempt=0;attempt<50;attempt++){
  const {etag,value}=await readWithEtag(unitId);
  if(!value||value.marker!==MARKER)return {ok:false,reason:"UNIT_NOT_VERIFIED"};
  const existing=value.slots?.[slotKey];
  if(existing?.requestId===requestId)return {ok:true,replayed:true};
  if(existing)return {ok:false,reason:"SLOT_TAKEN"};
  if(value.version!==expectedVersion)return {ok:false,reason:"STALE_AVAILABILITY"};
  if(value.commercialStatus!=="available"||value.visitsEnabled!==true)return {ok:false,reason:"UNIT_NOT_VISITABLE"};
  const next={...value,slots:{...(value.slots||{}),[slotKey]:{requestId,status:"claimed",marker:MARKER}}};
  const res=await putIfMatch(unitId,etag,next);
  if(res.status===200)return {ok:true,replayed:false};
  if(res.status!==412)throw Error("WRITE_FAILED_"+res.status);
 }
 throw Error("CAS_RETRY_EXHAUSTED");
}
async function changeStatus({unitId,expectedVersion,commercialStatus,visitsEnabled}){
 guard();
 if(!/^LAB-HAB-[A-Z0-9-]+$/.test(unitId)||!Number.isSafeInteger(expectedVersion))throw Error("INVALID_LAB_INPUT");
 if(!["available","occupied"].includes(commercialStatus)||typeof visitsEnabled!=="boolean")throw Error("INVALID_STATUS");
 for(let attempt=0;attempt<50;attempt++){
  const {etag,value}=await readWithEtag(unitId);
  if(!value||value.marker!==MARKER)return {ok:false,reason:"UNIT_NOT_VERIFIED"};
  if(value.version!==expectedVersion)return {ok:false,reason:"STALE_AVAILABILITY"};
  const next={...value,commercialStatus,visitsEnabled,version:value.version+1};
  const res=await putIfMatch(unitId,etag,next);
  if(res.status===200)return {ok:true,version:next.version};
  if(res.status!==412)throw Error("WRITE_FAILED_"+res.status);
 }
 throw Error("CAS_RETRY_EXHAUSTED");
}
module.exports={claim,changeStatus,MARKER,ROOT};
