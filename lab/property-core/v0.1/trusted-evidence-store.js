"use strict";
const {ROOT,MARKER}=require("./property-store");
// Emulator-only server adapter. Evidence is loaded from a separate protected root.
function trustedEvidenceStore(db){
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")throw Error("EMULATOR_REQUIRED");
 if(!db||typeof db.ref!=="function")throw Error("ADMIN_DATABASE_REQUIRED");
 return async function load({entityId,propertyId,evidenceIds}){
  if(!/^[A-Za-z0-9_-]{2,80}$/.test(entityId||"")||!/^[A-Za-z0-9_-]{2,80}$/.test(propertyId||"")||!Array.isArray(evidenceIds))throw Error("INVALID_EVIDENCE_QUERY");
  const records=[];
  for(const id of evidenceIds){
   if(!/^[A-Za-z0-9_-]{2,80}$/.test(id||""))throw Error("INVALID_EVIDENCE_ID");
   const record=(await db.ref(ROOT+"/evidence/"+id).once("value")).val();
   if(record&&record.marker===MARKER)records.push({evidenceId:id,unitId:record.unitId,propertyId:record.propertyId,status:record.status});
  }
  return records;
 };
}
module.exports={trustedEvidenceStore};
