"use strict";
// Sector-neutral immutable request envelope; pure lab contract, not a production authorization layer.
const ID=/^[A-Za-z0-9_-]{2,80}$/;
function requiredId(value,label){if(typeof value!=="string"||!ID.test(value))throw Error("INVALID_"+label);return value;}
function createCase({tenantId,caseId,personId,caseType,adapterId,requestId,context={}}){
 for(const [key,value] of Object.entries({tenantId,caseId,personId,caseType,adapterId,requestId}))requiredId(value,key.toUpperCase());
 if(!context||typeof context!=="object"||Array.isArray(context))throw Error("INVALID_CONTEXT");
 // Context is adapter-owned, JSON-only, bounded and detached from caller mutations.
 const encoded=JSON.stringify(context);
 if(typeof encoded!=="string"||encoded.length>4096)throw Error("INVALID_CONTEXT_SIZE");
 const detached=JSON.parse(encoded);
 function freeze(value){if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
 return Object.freeze({schemaVersion:1,tenantId,caseId,personId,caseType,adapterId,requestId,context:freeze(detached)});
}
function validateAdapter(caseRecord,adapter){
 if(!caseRecord||!adapter||caseRecord.adapterId!==adapter.id||typeof adapter.validate!=="function")throw Error("ADAPTER_MISMATCH");
 const result=adapter.validate(caseRecord);
 if(!result||typeof result.allowed!=="boolean"||typeof result.reason!=="string")throw Error("INVALID_ADAPTER_DECISION");
 return Object.freeze({allowed:result.allowed,reason:result.reason});
}
module.exports={createCase,validateAdapter};
