"use strict";
/* Property Core Contract/Lease V0.1: pure laboratory domain. */
const STATES=new Set(["draft","review","approved","active","expired","terminated","closed"]);
const CURRENCIES=/^[A-Z]{3}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ID=/^[A-Za-z0-9_-]{2,80}$/;
function req(v,n){if(typeof v!=="string"||!v.trim())throw Error("INVALID_"+n);return v.trim();}
function id(v,n="ID"){const s=req(v,n);if(!ID.test(s))throw Error("INVALID_"+n);return s;}
function date(v,n){const s=req(v,n),m=DATE.exec(s);if(!m)throw Error("INVALID_"+n);const d=new Date(s+"T00:00:00Z");if(d.getUTCFullYear()!==Number(s.slice(0,4))||d.getUTCMonth()+1!==Number(s.slice(5,7))||d.getUTCDate()!==Number(s.slice(8,10)))throw Error("INVALID_"+n);return s;}
function instant(v,n="AT"){const s=req(v,n);if(!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(s)||Number.isNaN(Date.parse(s)))throw Error("INVALID_"+n);return s;}
function money(v){if(!Number.isSafeInteger(v)||v<=0)throw Error("INVALID_RENT_AMOUNT");return v;}
function currency(v){const s=req(v,"CURRENCY").toUpperCase();if(!CURRENCIES.test(s))throw Error("INVALID_CURRENCY");return s;}
function createContract({contractId,organizationId,tenantRef,unitRef,rentAmountMinor,currency:cur,billingSchedule,startDate,endDate}){
 const start=date(startDate,"START_DATE"),end=date(endDate,"END_DATE");if(end<start)throw Error("INVALID_TERM");
 return Object.freeze({contractId:id(contractId,"CONTRACT_ID"),organizationId:id(organizationId,"ORGANIZATION_ID"),tenantRef:id(tenantRef,"TENANT_REF"),unitRef:id(unitRef,"UNIT_REF"),rentAmountMinor:money(rentAmountMinor),currency:currency(cur),billingSchedule:req(billingSchedule,"BILLING_SCHEDULE"),startDate:start,endDate:end,state:"draft",revision:1,modelVersion:1});
}
const NEXT={draft:["review"],review:["approved","draft"],approved:["active","draft"],active:["expired","terminated"],expired:["closed"],terminated:["closed"],closed:[]};
function transition(contract,{to,actorId,eventId,at,authorizationRef=null}){
 if(!contract||!STATES.has(contract.state))throw Error("INVALID_CONTRACT");
 if(!STATES.has(to)||!NEXT[contract.state].includes(to))throw Error("INVALID_CONTRACT_TRANSITION");
 id(actorId,"ACTOR_ID");id(eventId,"EVENT_ID");at=instant(at,"AT");
 if(["approved","active","terminated"].includes(to))id(authorizationRef,"AUTHORIZATION_REF");
 const next=Object.freeze({...contract,state:to,revision:contract.revision+1});
 const event=Object.freeze({eventId,type:to==="active"?"property.contract.activated.v1":"property.contract."+to+".v1",contractId:contract.contractId,organizationId:contract.organizationId,tenantRef:contract.tenantRef,unitRef:contract.unitRef,rentAmountMinor:contract.rentAmountMinor,currency:contract.currency,billingSchedule:contract.billingSchedule,effectiveAt:at,authorizationRef:authorizationRef||null,from:contract.state,to,actorId,schemaVersion:1});
 return Object.freeze({contract:next,event});
}
function renew(contract,{newEndDate,actorId,eventId,at,authorizationRef}){
 if(!contract||contract.state!=="active")throw Error("CONTRACT_NOT_ACTIVE");
 const end=date(newEndDate,"END_DATE");if(end<=contract.endDate)throw Error("INVALID_RENEWAL_TERM");
 id(actorId,"ACTOR_ID");id(eventId,"EVENT_ID");id(authorizationRef,"AUTHORIZATION_REF");at=instant(at,"AT");
 const next=Object.freeze({...contract,endDate:end,revision:contract.revision+1});
 const event=Object.freeze({eventId,type:"property.contract.renewed.v1",contractId:contract.contractId,organizationId:contract.organizationId,tenantRef:contract.tenantRef,unitRef:contract.unitRef,rentAmountMinor:contract.rentAmountMinor,currency:contract.currency,billingSchedule:contract.billingSchedule,effectiveAt:at,authorizationRef,previousEndDate:contract.endDate,newEndDate:end,actorId,schemaVersion:1});
 return Object.freeze({contract:next,event});
}
function occupancyEffect(){return Object.freeze({automatic:false,reason:"CONTRACT_STATE_DOES_NOT_MUTATE_OCCUPANCY"});}
function availabilityEffect(){return Object.freeze({automatic:false,reason:"TURNOVER_VERIFICATION_REQUIRED"});}
module.exports={createContract,transition,renew,occupancyEffect,availabilityEffect};
