"use strict";
/* Explicit Property -> Cobranza integration contract. Pure laboratory code. */
const ACTIVATED="property.contract.activated.v1";
const ID=/^[A-Za-z0-9_-]{2,80}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d/;
function req(v,n){if(typeof v!=="string"||!v.trim())throw Error("INVALID_"+n);return v.trim();}
function id(v,n){const s=req(v,n);if(!ID.test(s))throw Error("INVALID_"+n);return s;}
function assertActivatedEvent(event){
 if(!event||event.type!==ACTIVATED||event.schemaVersion!==1)throw Error("UNSUPPORTED_CONTRACT_EVENT");
 const normalized={
  eventId:id(event.eventId,"EVENT_ID"),type:ACTIVATED,schemaVersion:1,
  contractId:id(event.contractId,"CONTRACT_ID"),organizationId:id(event.organizationId,"ORGANIZATION_ID"),
  tenantRef:id(event.tenantRef,"TENANT_REF"),unitRef:id(event.unitRef,"UNIT_REF"),
  rentAmountMinor:event.rentAmountMinor,currency:req(event.currency,"CURRENCY").toUpperCase(),
  billingSchedule:req(event.billingSchedule,"BILLING_SCHEDULE"),effectiveAt:req(event.effectiveAt,"EFFECTIVE_AT"),
  authorizationRef:id(event.authorizationRef,"AUTHORIZATION_REF")
 };
 if(!Number.isSafeInteger(normalized.rentAmountMinor)||normalized.rentAmountMinor<=0)throw Error("INVALID_RENT_AMOUNT");
 if(!/^[A-Z]{3}$/.test(normalized.currency))throw Error("INVALID_CURRENCY");
 if(!ISO.test(normalized.effectiveAt)||Number.isNaN(Date.parse(normalized.effectiveAt)))throw Error("INVALID_EFFECTIVE_AT");
 return Object.freeze(normalized);
}
function cobranzaCommandFromActivation(event){
 const e=assertActivatedEvent(event);
 return Object.freeze({
  command:"billing.charge.create.v1",
  organizationId:e.organizationId,
  externalId:"contract:"+e.contractId+":activation",
  contractId:e.contractId,tenantRef:e.tenantRef,unitRef:e.unitRef,
  amountMinor:e.rentAmountMinor,currency:e.currency,billingSchedule:e.billingSchedule,
  effectiveAt:e.effectiveAt,authorizationRef:e.authorizationRef,sourceEventId:e.eventId
 });
}
module.exports={ACTIVATED,assertActivatedEvent,cobranzaCommandFromActivation};
