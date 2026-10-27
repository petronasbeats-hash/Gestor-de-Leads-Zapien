const assert = require('node:assert/strict');
const { test } = require('node:test');

const core = require('../property/unit-operational-status.v0.1.js');

const base = {
  physicalCondition: 'ready',
  deliveryStatus: 'ready',
  lastVerifiedAt: '2026-10-07T12:00:00Z',
  organizationId: 'org-test-001',
  unitId: 'unit-test-001'
};

test('Fecha sin evidencia no confirma entrega', () => {
  const result = core.evaluate(base);
  assert.equal(result.readyForDelivery, false);
});

test('Evidencia pendiente no confirma entrega', () => {
  const result = core.evaluate({
    ...base,
    verificationEvidence: {
      id: 'inspection-001',
      organizationId: 'org-test-001',
      unitId: 'unit-test-001',
      verifiedBy: 'inspector-001',
      verifiedAt: '2026-10-07T12:00:00Z',
      status: 'pending'
    }
  });

  assert.equal(result.readyForDelivery, false);
});

test('Evidencia incompleta no confirma entrega', () => {
  const result = core.evaluate({
    ...base,
    verificationEvidence: {
      id: 'inspection-001',
      organizationId: 'org-test-001',
      unitId: 'unit-test-001',
      status: 'verified'
    }
  });

  assert.equal(result.readyForDelivery, false);
});

test('Evidencia estructurada y validada permite evaluación positiva', () => {
  const result = core.evaluate({
    ...base,
    verificationEvidence: {
      id: 'inspection-001',
      organizationId: 'org-test-001',
      unitId: 'unit-test-001',
      verifiedBy: 'inspector-001',
      verifiedAt: '2026-10-07T12:00:00Z',
      status: 'verified'
    }
  });

  assert.equal(result.readyForDelivery, true);
});
