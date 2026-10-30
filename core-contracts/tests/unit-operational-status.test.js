const assert = require('node:assert/strict');
const { test } = require('node:test');

const core = require('../property/unit-operational-status.v0.1.js');

test('Morris: mantenimiento no equivale a entrega', () => {
  const result = core.evaluate({
    physicalCondition: 'maintenance',
    visitPolicy: 'allowed_with_notice',
    photoStatus: 'unverified',
    deliveryStatus: 'unknown'
  });

  assert.equal(result.readyForDelivery, false);
  assert.equal(result.status.visitPolicy, 'allowed_with_notice');
  assert.ok(result.warnings.length > 0);
});

test('Sin información no se presume entrega', () => {
  const result = core.evaluate(null);

  assert.equal(result.readyForDelivery, false);
  assert.equal(result.status.physicalCondition, 'unknown');
});

test('Unidad lista y entrega confirmada', () => {
  const result = core.evaluate({
    physicalCondition: 'ready',
    visitPolicy: 'allowed',
    photoStatus: 'verified_current',
    deliveryStatus: 'ready',
    lastVerifiedAt: '2026-10-07T12:00:00Z',
    organizationId: 'org-test-001',
    unitId: 'unit-test-001',
    verificationEvidence: {
      id: 'inspection-test-001',
      organizationId: 'org-test-001',
      unitId: 'unit-test-001',
      verifiedBy: 'inspector-test-001',
      verifiedAt: '2026-10-07T12:00:00Z',
      status: 'verified'
    }
  });

  assert.equal(result.readyForDelivery, true);
  assert.equal(result.warnings.length, 0);
});

test('La evaluación no modifica los datos originales', () => {
  const input = Object.freeze({
    physicalCondition: 'maintenance'
  });

  core.evaluate(input);

  assert.equal(input.physicalCondition, 'maintenance');
});
