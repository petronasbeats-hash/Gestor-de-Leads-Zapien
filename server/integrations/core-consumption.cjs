'use strict';
// Preparation only: not imported by attentionApi or any browser bundle.
// Authorization, verified source reads, durable inbox and transport remain server ports.
const {createHash} = require('node:crypto');
const identityCore = require('../../core-contracts/property/unit-identity-bridge.v0.1.js');
const propertyCore = require('../../core-contracts/property/unit-operational-status.v0.1.js');
const VERSION = 'synapse-core-consumption.v0.1';
const fail = code => { throw Error(code); };
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const required = v => typeof v === 'string' && v.trim() && v.length <= 500 ? v : fail('INVALID_REFERENCE');
const amount = v => Number.isSafeInteger(v) && v > 0 ? v : fail('INVALID_MONEY_MINOR');
const stable = v => Array.isArray(v) ? v.map(stable) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = v => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function instant(v) {
  required(v);
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(v);
  if (!m || +m[2] > 23 || +m[3] > 59 || +m[4] > 59 || +(m[6] || 0) > 23 || +(m[7] || 0) > 59 || !Number.isFinite(Date.parse(v))) fail('INVALID_INSTANT');
  if (new Date(m[1] + 'T12:00:00Z').toISOString().slice(0, 10) !== m[1]) fail('INVALID_INSTANT');
  return v;
}
function scoped(scope, permission, organizationId) {
  // scope must be created from authenticated server context, never request.body.
  if (!object(scope) || scope.organizationId !== required(organizationId) || !Array.isArray(scope.permissions) || !scope.permissions.includes(permission)) fail('CORE_SCOPE_FORBIDDEN');
}
function assessPropertySnapshot({scope, identity, catalog, operationalStatus, observedAt, now, maxSnapshotAgeMs, maxEvidenceAgeMs}) {
  const ref = identityCore.createIdentity(identity);
  scoped(scope, 'property.read', ref.organizationId);
  instant(observedAt); instant(now);
  if (![maxSnapshotAgeMs, maxEvidenceAgeMs].every(v => Number.isSafeInteger(v) && v > 0)) fail('FRESHNESS_POLICY_REQUIRED');
  const age = Date.parse(now) - Date.parse(observedAt);
  if (age < 0 || age > maxSnapshotAgeMs) fail('PROPERTY_SNAPSHOT_STALE');
  const property = catalog?.[ref.propiedadId];
  if (!object(property) || ['organizationId', 'propertyGroupId', 'unitId'].some(k => property[k] !== ref[k])) fail('PROPERTY_IDENTITY_MAPPING_REQUIRED');
  const matches = Object.values(catalog).filter(p => object(p) && ['organizationId', 'propertyGroupId', 'unitId'].every(k => p[k] === ref[k]));
  if (matches.length !== 1) fail('PROPERTY_IDENTITY_AMBIGUOUS');
  const operationalUnitId = identityCore.createOperationalUnitId(ref);
  if (operationalStatus?.organizationId !== ref.organizationId || operationalStatus?.unitId !== operationalUnitId) fail('PROPERTY_STATUS_SCOPE_MISMATCH');
  const evaluated = propertyCore.evaluate(operationalStatus);
  const evidenceAge = evaluated.status.lastVerifiedAt ? Date.parse(now) - Date.parse(evaluated.status.lastVerifiedAt) : NaN;
  const evidenceFresh = Boolean(evaluated.status.verificationEvidence) && evidenceAge >= 0 && evidenceAge <= maxEvidenceAgeMs;
  return {version: VERSION, organizationId: ref.organizationId, identity: ref, operationalUnitId, observedAt,
    physicalCondition: evaluated.status.physicalCondition, visitPolicy: evaluated.status.visitPolicy,
    photoStatus: evaluated.status.photoStatus, deliveryStatus: evaluated.status.deliveryStatus,
    readyForDelivery: evidenceFresh && evaluated.readyForDelivery,
    evidenceState: !evaluated.status.verificationEvidence ? 'missing' : evidenceFresh ? 'fresh' : 'stale',
    warnings: [...evaluated.warnings, ...(!evidenceFresh ? ['Evidencia ausente o fuera de la política de vigencia.'] : [])]};
}
async function previewBillingActivation({scope, event, binding, verifyAuthorization, mapActivation}) {
  if (!object(event) || event.type !== 'property.contract.activated.v1' || event.schemaVersion !== 1) fail('UNSUPPORTED_PROPERTY_EVENT');
  scoped(scope, 'billing.activation.preview', event.organizationId);
  for (const field of ['eventId', 'contractId', 'tenantRef', 'unitRef', 'authorizationRef']) required(event[field]);
  amount(event.rentAmountMinor);
  if (typeof event.currency !== 'string' || !/^[A-Z]{3}$/.test(event.currency)) fail('CURRENCY_REQUIRED');
  instant(event.effectiveAt);
  if (!object(binding) || ['organizationId', 'contractId', 'tenantRef', 'unitRef'].some(k => binding[k] !== event[k])) fail('CONTRACT_BINDING_MISMATCH');
  if (typeof verifyAuthorization !== 'function' || typeof mapActivation !== 'function') fail('CORE_PORT_NOT_CONNECTED');
  // The injected authority must verify the real publisher/evidence outside this pure boundary.
  const authority = await verifyAuthorization({eventId: event.eventId, organizationId: event.organizationId, contractId: event.contractId, authorizationRef: event.authorizationRef});
  if (!object(authority) || authority.publisher !== 'property-core' || ['eventId', 'organizationId', 'contractId', 'authorizationRef'].some(k => authority[k] !== event[k])) fail('ACTIVATION_NOT_VERIFIED');
  const keys = ['type', 'schemaVersion', 'eventId', 'organizationId', 'contractId', 'tenantRef', 'unitRef', 'authorizationRef', 'rentAmountMinor', 'currency', 'effectiveAt'];
  const charge = await mapActivation(Object.fromEntries(keys.map(k => [k, event[k]])));
  if (!object(charge) || charge.organizationId !== event.organizationId || charge.amountMinor !== event.rentAmountMinor || charge.currency !== event.currency || charge.externalId !== 'contract:' + event.contractId + ':activation') fail('BILLING_MAPPING_MISMATCH');
  const localDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Mexico_City'}).format(new Date(event.effectiveAt));
  const blockers = ['PRODUCTION_GATE_PENDING', 'BILLING_SCHEDULE_MAPPING_PENDING'];
  if (charge.dueAt !== localDate || charge.period !== localDate.slice(0, 7)) blockers.push('LOCAL_BILLING_DATE_REVIEW_REQUIRED');
  // No createCharge call, no transport, and no financial mutation is exposed here.
  return {version: VERSION, mode: 'preview-only', dispatchAllowed: false, eventId: event.eventId,
    organizationId: event.organizationId, contractId: event.contractId,
    proposedCharge: Object.fromEntries(['organizationId', 'externalId', 'amountMinor', 'currency', 'concept', 'period', 'dueAt'].map(k => [k, charge[k]])), blockers};
}
const billingShapes = Object.freeze({
  'billing.charge.created.v1': ['chargeId'], 'billing.payment.recorded.v1': ['paymentId'],
  'billing.deposit.recorded.v1': ['depositId'], 'billing.payment.applied.v1': ['allocationId', 'paymentId', 'chargeId'],
  'billing.receipt.issued.v1': ['receiptId', 'paymentId'], 'billing.allocation.reversed.v1': ['reversalId', 'allocationId']
});
function normalizeBillingNotification({scope, event, sourceVariant, contractBinding}) {
  if (!object(event) || event.schemaVersion !== 1 || !Object.hasOwn(billingShapes, event.type)) fail('UNSUPPORTED_BILLING_EVENT');
  scoped(scope, 'billing.notification.read', event.organizationId);
  if (!['cobranza-domain-v0.1', 'cobranza-firestore-v0.2'].includes(sourceVariant)) fail('BILLING_SOURCE_VERSION_REQUIRED');
  required(event.eventId); required(event.actor); instant(event.occurredAt);
  if (!object(event.data)) fail('BILLING_EVENT_DATA_REQUIRED');
  const refs = {};
  for (const field of billingShapes[event.type]) {
    const simpleCreate = ['chargeId', 'paymentId', 'depositId'].includes(field) && event.type.endsWith(field === 'chargeId' ? 'charge.created.v1' : field === 'paymentId' ? 'payment.recorded.v1' : 'deposit.recorded.v1');
    refs[field] = required(sourceVariant === 'cobranza-firestore-v0.2' && simpleCreate ? event.data.entityId : event.data[field]);
  }
  if (event.type === 'billing.payment.applied.v1' || event.type === 'billing.allocation.reversed.v1') amount(event.data.amountMinor);
  let contractId = null;
  if (contractBinding) {
    if (contractBinding.organizationId !== event.organizationId || !Object.hasOwn(refs, contractBinding.entityType) || refs[contractBinding.entityType] !== contractBinding.entityId) fail('BILLING_CONTRACT_BINDING_MISMATCH');
    contractId = required(contractBinding.contractId);
  }
  return {version: VERSION, source: 'cobranza-core', sourceVariant, organizationId: event.organizationId,
    eventId: event.eventId, type: event.type, occurredAt: event.occurredAt, refs, contractId,
    linkStatus: contractId ? 'linked' : 'review-required', fingerprint: digest(event),
    action: contractId ? 'refresh-authoritative-financial-summary' : 'review-contract-reference'};
}
function decideInbox(previous, notification) {
  const key = JSON.stringify([notification.organizationId, notification.source, notification.eventId]);
  if (previous) {
    if (previous.key !== key || previous.fingerprint !== notification.fingerprint) fail('CORE_EVENT_CONFLICT');
    return {key, decision: 'replay', fingerprint: notification.fingerprint};
  }
  // A future repository must save this receipt and its projection atomically.
  return {key, decision: 'record', fingerprint: notification.fingerprint};
}
module.exports = {VERSION, assessPropertySnapshot, previewBillingActivation, normalizeBillingNotification, decideInbox};
