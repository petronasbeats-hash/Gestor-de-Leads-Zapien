"use strict";
/* Cross-engine contract test: validates shape only. No Cobranza writes/imports. */
const assert=require("node:assert/strict");
const {createContract,transition}=require("./contract-lease");
const {cobranzaCommandFromActivation}=require("./contract-cobranza-boundary");
let c=createContract({contractId:"lease_cross01",organizationId:"org01",tenantRef:"tenant_synthetic",unitRef:"unit01",rentAmountMinor:300000,currency:"MXN",billingSchedule:"monthly",startDate:"2026-10-01",endDate:"2027-03-31"});
c=transition(c,{to:"review",actorId:"agent01",eventId:"evt_review_cross",at:"2026-09-20T12:00:00-06:00"}).contract;
c=transition(c,{to:"approved",actorId:"agent01",eventId:"evt_approve_cross",at:"2026-09-21T12:00:00-06:00",authorizationRef:"auth_cross01"}).contract;
const activation=transition(c,{to:"active",actorId:"agent01",eventId:"evt_activate_cross",at:"2026-10-01T00:00:00-06:00",authorizationRef:"auth_cross02"}).event;
const x=cobranzaCommandFromActivation(activation);
// Cobranza createCharge V0.x required input contract: org, externalId, amountMinor, currency, concept, period, dueAt.
const chargeInput=Object.freeze({organizationId:x.organizationId,externalId:x.externalId,amountMinor:x.amountMinor,currency:x.currency,concept:"Contract rent activation",period:x.effectiveAt.slice(0,7),dueAt:x.effectiveAt.slice(0,10)});
assert.deepEqual(Object.keys(chargeInput).sort(),["amountMinor","concept","currency","dueAt","externalId","organizationId","period"].sort());
assert.equal(chargeInput.externalId,"contract:lease_cross01:activation");
assert.equal(chargeInput.period,"2026-10");assert.equal(chargeInput.dueAt,"2026-10-01");assert.equal(chargeInput.amountMinor,300000);
console.log("PASS: Property activation maps to Cobranza createCharge V0.x input without direct engine coupling");
