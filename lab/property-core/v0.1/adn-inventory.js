"use strict";
// Synthetic pilot catalog only. Occupancy/verification must be confirmed with evidence.
const {property,building,unit,synapseProjection}=require("./property-model");
const PROPERTY_ID="ADN-PILOT-001",BUILDING_ID="ADN-BUILDING-10";
const parent=property({propertyId:PROPERTY_ID,name:"ADN Suites & Studios",address:"Pendiente de verificar"});
const structure=building({buildingId:BUILDING_ID,propertyId:PROPERTY_ID,name:"ADN 10"});
const suites=[
 ["01",3500,"private"],["04",3500,"private"],["06",3500,"private"],
 ["07",3500,"private"],["08",3000,"shared-1-to-1"],
 ["09",3000,"shared-1-to-1"],["10",3500,"private"]
];
const studios=["01","02","03","04","05","06"].map(number=>({number,monthlyRentMXN:2800,bathroom:"unverified",category:"YIN"}));
const catalog=[
 ...suites.map(([number,monthlyRentMXN,bathroom])=>({number,monthlyRentMXN,bathroom,category:"YANG",type:"suite"})),
 ...studios.map(x=>({...x,type:"studio"}))
].map(x=>{
 const identity=unit({unitId:`ADN-${x.category}-${x.number}`,buildingId:BUILDING_ID,propertyId:PROPERTY_ID,number:x.number,type:x.type});
 return Object.freeze({identity,commercial:Object.freeze({category:x.category,monthlyRentMXN:x.monthlyRentMXN,bathroom:x.bathroom,currency:"MXN",termMonths:6,depositMonths:1}),projection:synapseProjection(parent,structure,identity)});
});
module.exports={parent,structure,catalog};
