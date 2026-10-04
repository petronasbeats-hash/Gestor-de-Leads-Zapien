"use strict";
const {publicationDecision}=require("./publication-gate");
// A saved publication is never sufficient evidence of current availability.
// Every consumer must evaluate current unit state and publication revision.
function currentPublication(entity,property,building){
 if(!entity||!entity.publication)return Object.freeze({visible:false,reason:"NOT_PUBLISHED"});
 if(!Number.isSafeInteger(entity.revision)||entity.publication.revision!==entity.revision)return Object.freeze({visible:false,reason:"STALE_PUBLICATION"});
 const p=entity.publication;
 const decision=publicationDecision(property,building,entity.record,{priceMXN:p.priceMXN,evidenceIds:p.evidenceIds});
 if(!decision.allowed)return Object.freeze({visible:false,reason:decision.reason});
 if(p.unitId!==entity.record.unitId)return Object.freeze({visible:false,reason:"PUBLICATION_UNIT_MISMATCH"});
 return Object.freeze({visible:true,reason:"CURRENT",publication:p});
}
module.exports={currentPublication};
