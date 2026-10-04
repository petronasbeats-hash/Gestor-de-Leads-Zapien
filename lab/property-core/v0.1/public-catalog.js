"use strict";
const {currentPublication}=require("./publication-status");
// Pure public projection; callers supply trusted current snapshots.
function publicCatalog(rows){
 if(!Array.isArray(rows))throw Error("INVALID_CATALOG_INPUT");
 const items=[],rejected=[],seen=new Set();
 for(const row of rows){
  const id=typeof row?.entity?.record?.unitId==="string"?row.entity.record.unitId:null;
  let status;
  try{status=currentPublication(row?.entity,row?.property,row?.building)}
  catch(_error){status={visible:false,reason:"INVALID_CATALOG_ROW"}}
  if(!status.visible){rejected.push({unitId:id,reason:status.reason});continue}
  try {
  const identity=JSON.stringify([row.property.propertyId,id]);
  if(seen.has(identity)){rejected.push({unitId:id,reason:"DUPLICATE_UNIT"});continue}
  const {entity,property}=row,p=status.publication;
  if(typeof property.name!=="string"||!property.name.trim()||typeof entity.record.number!=="string"||!entity.record.number.trim()||typeof entity.record.type!=="string"||!entity.record.type.trim())throw Error("INVALID_PUBLIC_FIELDS");
  items.push(Object.freeze({propertyGroupId:property.propertyId,propertyName:property.name,unitId:entity.record.unitId,unitNumber:entity.record.number,unitType:entity.record.type,monthlyRentMXN:p.priceMXN,currency:"MXN"}));
  seen.add(identity);
  } catch(_error){rejected.push({unitId:id,reason:"INVALID_CATALOG_ROW"});}
 }
 return Object.freeze({items:Object.freeze(items),rejected:Object.freeze(rejected)});
}
module.exports={publicCatalog};
