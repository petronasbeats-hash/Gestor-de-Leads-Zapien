"use strict";
// Pure Property Core V0.1 transition + event generator. Storage adapter is separate.
const VALID=["draft","captured","verification","verified","active"];
const NEXT={draft:["captured"],captured:["verification"],verification:["verified","captured"],verified:["active","verification"],active:["verification"]};
const ID=/^[A-Za-z0-9_-]{2,80}$/;
function transition(record,{to,actorId,eventId,at,evidenceId}){
 if(!record||!VALID.includes(record.verification))throw Error("INVALID_RECORD");
 if(!VALID.includes(to)||!NEXT[record.verification].includes(to))throw Error("INVALID_TRANSITION");
 if(!ID.test(actorId||"")||!ID.test(eventId||"")||!/^\d{4}-\d\d-\d\dT/.test(at||""))throw Error("INVALID_EVENT_METADATA");
 if(["verified","active"].includes(to)&&!ID.test(evidenceId||""))throw Error("EVIDENCE_REQUIRED");
 const recordId=record.unitId||record.buildingId||record.propertyId;
 if(!ID.test(recordId||""))throw Error("INVALID_RECORD_ID");
 const event=Object.freeze({eventId,recordId,entityType:record.unitId?"UNIT":record.buildingId?"BUILDING":"PROPERTY",type:"VERIFICATION_TRANSITION",from:record.verification,to,actorId,at,evidenceId:evidenceId||null,modelVersion:1});
 return Object.freeze({record:Object.freeze({...record,verification:to}),event});
}
function appendEvent(events,event){
 if(!event||!ID.test(event.eventId||""))throw Error("INVALID_EVENT");
 const current=events||{};
 if(current[event.eventId]){
  if(JSON.stringify(current[event.eventId])!==JSON.stringify(event))throw Error("EVENT_ID_CONFLICT");
  return Object.freeze({...current});
 }
 return Object.freeze({...current,[event.eventId]:event});
}
module.exports={transition,appendEvent};
