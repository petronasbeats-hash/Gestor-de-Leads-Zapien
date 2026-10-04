"use strict";
const {synapseProjection}=require("./property-model");
// Pure projection gate: publishing is a separate, trusted server operation.
function publicationDecision(p,b,u,{priceMXN,evidenceIds=[]}={}){
 const projection=synapseProjection(p,b,u);
 if(!projection.activo)return Object.freeze({allowed:false,reason:projection.eligibilityReason});
 if(!Number.isSafeInteger(priceMXN)||priceMXN<=0)return Object.freeze({allowed:false,reason:"INVALID_PRICE"});
 if(!Array.isArray(evidenceIds)||!evidenceIds.some(id=>typeof id==="string"&&/^[A-Za-z0-9_-]{2,80}$/.test(id)))return Object.freeze({allowed:false,reason:"EVIDENCE_REQUIRED"});
 return Object.freeze({allowed:true,reason:"ELIGIBLE",projection});
}
module.exports={publicationDecision};
