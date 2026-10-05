"use strict";
/* Property Core V0.1: pure domain model. No production writes. */
const TYPES=new Set(["suite","studio","apartment","house","commercial","other"]);
const STATES=new Set(["draft","captured","verification","verified","active"]);
const OCCUPANCY=new Set(["unknown","vacant","occupied"]);
const OPERATIONS=new Set(["available","maintenance","inactive"]);
function required(v,name){if(typeof v!=="string"||!v.trim())throw Error("INVALID_"+name);return v.trim();}
function id(v){const s=required(v,"ID");if(!/^[a-zA-Z0-9_-]{2,80}$/.test(s))throw Error("INVALID_ID");return s;}
function property({propertyId,name,address="",verification="draft"}){
 if(!STATES.has(verification))throw Error("INVALID_VERIFICATION");
 return Object.freeze({propertyId:id(propertyId),name:required(name,"NAME"),address:String(address),verification,modelVersion:1});
}
function building({buildingId,propertyId,name}){
 return Object.freeze({buildingId:id(buildingId),propertyId:id(propertyId),name:required(name,"NAME"),modelVersion:1});
}
function unit({unitId,buildingId,propertyId,number,type,occupancy="unknown",operation="inactive",verification="draft"}){
 if(!TYPES.has(type)||!OCCUPANCY.has(occupancy)||!OPERATIONS.has(operation)||!STATES.has(verification))throw Error("INVALID_UNIT_STATE");
 return Object.freeze({unitId:id(unitId),buildingId:id(buildingId),propertyId:id(propertyId),number:required(number,"NUMBER"),type,occupancy,operation,verification,modelVersion:1});
}
function commercialEligibility(u){
 if(!u||u.verification!=="active")return {eligible:false,reason:"NOT_ACTIVE"};
 if(u.occupancy!=="vacant")return {eligible:false,reason:"NOT_VACANT"};
 if(u.operation!=="available")return {eligible:false,reason:"NOT_OPERATIONAL"};
 return {eligible:true,reason:"ELIGIBLE"};
}
// Projection only: does not replace or mutate the legacy propiedades record.
function synapseProjection(p,b,u){
 if(p.propertyId!==b.propertyId||u.propertyId!==p.propertyId||u.buildingId!==b.buildingId)throw Error("BROKEN_RELATION");
 const status=commercialEligibility(u);
 return Object.freeze({propertyGroupId:p.propertyId,propertyName:p.name,buildingId:b.buildingId,unitId:u.unitId,unitNumber:u.number,unitType:u.type,category:u.type,activo:status.eligible,eligibilityReason:status.reason,propertyCoreVersion:1});
}
module.exports={property,building,unit,commercialEligibility,synapseProjection};
