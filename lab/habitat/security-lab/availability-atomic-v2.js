"use strict";
// Isolated V2 proof: unit state and its visit slots share ONE RTDB transaction node.
// Not wired to production or the existing global-slot booking prototype.
const MARKER="habitat-atomic-v2";
const ROOT="lab_atomic_availability_v2";
function validate(unitId,slotKey,requestId){
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
 if(!/^LAB-HAB-[A-Z0-9-]+$/.test(unitId)||!/^2099-\d\d-\d\d_\d\d:\d\d$/.test(slotKey)||!/^LAB-ADMIN-[A-Z0-9-]+$/.test(requestId))throw Error("INVALID_LAB_INPUT");
}
async function claim(db,{unitId,slotKey,requestId,expectedVersion}){
 validate(unitId,slotKey,requestId);
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw Error("INVALID_VERSION");
 const ref=db.ref(ROOT+"/units/"+unitId);
 let reason="CONFLICT";
 const result=await ref.transaction(current=>{
   if(!current||current.marker!==MARKER){reason="UNIT_NOT_VERIFIED";return;}
   const existing=current.slots?.[slotKey];
   if(existing?.requestId===requestId){
     // Idempotent replay is allowed even after a later status/version change.
     reason="REPLAY";return current;
   }
   if(existing){reason="SLOT_TAKEN";return;}
   if(current.version!==expectedVersion){reason="STALE_AVAILABILITY";return;}
   if(current.commercialStatus!=="available"||current.visitsEnabled!==true){reason="UNIT_NOT_VISITABLE";return;}
   reason="CLAIMED";
   return {...current,slots:{...current.slots,[slotKey]:{requestId,status:"claimed",marker:MARKER}}};
 },undefined,false);
 return result.committed?{ok:true,replayed:reason==="REPLAY"}:{ok:false,reason};
}
async function changeStatus(db,{unitId,expectedVersion,commercialStatus,visitsEnabled}){
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
 if(!/^LAB-HAB-[A-Z0-9-]+$/.test(unitId))throw Error("INVALID_LAB_INPUT");
 if(!["available","occupied"].includes(commercialStatus)||typeof visitsEnabled!=="boolean")throw Error("INVALID_STATUS");
 const ref=db.ref(ROOT+"/units/"+unitId);
 let reason="CONFLICT";
 const result=await ref.transaction(current=>{
   if(!current||current.marker!==MARKER){reason="UNIT_NOT_VERIFIED";return;}
   if(current.version!==expectedVersion){reason="STALE_AVAILABILITY";return;}
   reason="UPDATED";
   return {...current,commercialStatus,visitsEnabled,version:current.version+1};
 },undefined,false);
 return result.committed?{ok:true,version:result.snapshot.val().version}:{ok:false,reason};
}
module.exports={claim,changeStatus,MARKER,ROOT};
