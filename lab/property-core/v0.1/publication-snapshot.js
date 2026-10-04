"use strict";
const {publicationDecision}=require("./publication-gate");
// An eligibility decision is bound to a revision; the trusted writer must compare
// this revision atomically when applying a publication operation.
function preparePublication(p,b,u,meta,revision){
 if(!Number.isSafeInteger(revision)||revision<1)throw Error("INVALID_REVISION");
 const decision=publicationDecision(p,b,u,meta);
 if(!decision.allowed)return Object.freeze({allowed:false,reason:decision.reason});
 return Object.freeze({allowed:true,expectedRevision:revision,unitId:u.unitId,propertyId:p.propertyId,reason:"READY_FOR_ATOMIC_CHECK"});
}
function revalidatePublication(ticket,current,revision,p,b,meta){
 if(!ticket?.allowed||ticket.unitId!==current?.unitId||ticket.propertyId!==p?.propertyId)return Object.freeze({allowed:false,reason:"INVALID_TICKET"});
 if(!Number.isSafeInteger(revision)||revision!==ticket.expectedRevision)return Object.freeze({allowed:false,reason:"STALE_REVISION"});
 return publicationDecision(p,b,current,meta);
}
module.exports={preparePublication,revalidatePublication};
