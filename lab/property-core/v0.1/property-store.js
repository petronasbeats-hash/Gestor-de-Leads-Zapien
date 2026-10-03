"use strict";
// Lab-only RTDB persistence. One transaction commits both verification state and event.
const {transition}=require("./property-events");
const ROOT="lab_property_core_v01";
const MARKER="property-core-v01-lab";
function guard(){if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");}
async function create(db,record){
 guard();
 const entityId=record.unitId||record.buildingId||record.propertyId;
 if(!/^[A-Za-z0-9_-]{2,80}$/.test(entityId||"")||record.verification!=="draft")throw Error("INVALID_RECORD");
 const ref=db.ref(ROOT+"/entities/"+entityId);
 const tx=await ref.transaction(current=>current===null?{marker:MARKER,record,events:{},revision:1}:undefined,undefined,false);
 if(!tx.committed)throw Error("ENTITY_EXISTS");
 return tx.snapshot.val();
}
async function advance(db,entityId,change){
 guard();
 if(!/^[A-Za-z0-9_-]{2,80}$/.test(entityId||""))throw Error("INVALID_ID");
 const ref=db.ref(ROOT+"/entities/"+entityId);
 let failure=null;
 const tx=await ref.transaction(current=>{
  if(!current||current.marker!==MARKER){failure="ENTITY_NOT_FOUND";return;}
  const existing=current.events?.[change.eventId];
  if(existing){
   if(existing.to===change.to&&existing.actorId===change.actorId&&existing.at===change.at&&existing.evidenceId===(change.evidenceId||null))return current;
   failure="EVENT_ID_CONFLICT";return;
  }
  try{
   const next=transition(current.record,change);
   if(next.event.recordId!==entityId){failure="RECORD_ID_MISMATCH";return;}
   return {...current,record:next.record,events:{...current.events,[change.eventId]:next.event},revision:current.revision+1};
  }catch(e){failure=e.message;return;}
 },undefined,false);
 if(!tx.committed)throw Error(failure||"TRANSITION_CONFLICT");
 return tx.snapshot.val();
}
module.exports={create,advance,ROOT,MARKER};
