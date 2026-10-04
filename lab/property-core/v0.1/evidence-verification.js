"use strict";
// Trusted records must be loaded by a server-side adapter, never from browser input.
function verifyPublicationEvidence({evidenceIds,unitId,propertyId,records}){
 if(!Array.isArray(evidenceIds)||evidenceIds.length===0)return Object.freeze({verified:false,reason:"EVIDENCE_REQUIRED"});
 if(!Array.isArray(records))return Object.freeze({verified:false,reason:"TRUSTED_EVIDENCE_REQUIRED"});
 const ids=new Set();
 for(const id of evidenceIds){
  if(typeof id!=="string"||!/^[A-Za-z0-9_-]{2,80}$/.test(id))return Object.freeze({verified:false,reason:"INVALID_EVIDENCE_ID"});
  if(ids.has(id))return Object.freeze({verified:false,reason:"DUPLICATE_EVIDENCE"});
  ids.add(id);
  const record=records.find(r=>r&&r.evidenceId===id);
  if(!record)return Object.freeze({verified:false,reason:"EVIDENCE_NOT_FOUND"});
  if(record.unitId!==unitId||record.propertyId!==propertyId)return Object.freeze({verified:false,reason:"EVIDENCE_SCOPE_MISMATCH"});
  if(record.status!=="verified")return Object.freeze({verified:false,reason:"EVIDENCE_NOT_VERIFIED"});
 }
 return Object.freeze({verified:true,reason:"VERIFIED"});
}
module.exports={verifyPublicationEvidence};
