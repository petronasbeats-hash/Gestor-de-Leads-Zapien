"use strict";
const assert=require("node:assert/strict");
const {property,building,unit}=require("./property-model");
const {publicationDecision}=require("./publication-gate");
const p=property({propertyId:"LAB-PUB-01",name:"Property"}),b=building({buildingId:"LAB-PUB-B1",propertyId:p.propertyId,name:"Building"});
const make=(overrides={})=>unit({unitId:"LAB-PUB-U1",buildingId:b.buildingId,propertyId:p.propertyId,number:"1",type:"suite",verification:"active",occupancy:"vacant",operation:"available",...overrides});
const meta={priceMXN:3500,evidenceIds:["LAB-EVIDENCE-01"]};
assert.equal(publicationDecision(p,b,make(),meta).allowed,true);
for(const [change,reason] of [[{verification:"draft"},"NOT_ACTIVE"],[{occupancy:"unknown"},"NOT_VACANT"],[{occupancy:"occupied"},"NOT_VACANT"],[{operation:"maintenance"},"NOT_OPERATIONAL"]]){
 assert.equal(publicationDecision(p,b,make(change),meta).reason,reason);
}
assert.equal(publicationDecision(p,b,make(),{...meta,evidenceIds:[]}).reason,"EVIDENCE_REQUIRED");
assert.equal(publicationDecision(p,b,make(),{...meta,priceMXN:0}).reason,"INVALID_PRICE");
assert.throws(()=>publicationDecision(p,b,make({propertyId:"LAB-OTHER"}),meta),/BROKEN_RELATION/);
console.log("PASS: publication gate denies unverified, occupied, maintenance, missing evidence, bad prices and broken relations");
