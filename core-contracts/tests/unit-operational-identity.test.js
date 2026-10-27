const assert = require('node:assert/strict');
const { test } = require('node:test');

const core = require('../property/unit-operational-status.v0.1.js');

const verifiedAt = '2026-10-07T12:00:00Z';

function makeUnit() {
  return {
    organizationId: 'org-001',
    unitId: 'depto-6',
    physicalCondition: 'ready',
    deliveryStatus: 'ready',
    lastVerifiedAt: verifiedAt,
    verificationEvidence: {
      id: 'inspection-001',
      organizationId: 'org-001',
      unitId: 'depto-6',
      verifiedBy: 'inspector-001',
      verifiedAt,
      status: 'verified'
    }
  };
}

test('Identidad coincidente permite evaluación positiva', () => {
  assert.equal(core.evaluate(makeUnit()).readyForDelivery, true);
});

test('Evidencia de otra organización no valida entrega', () => {
  const unit = makeUnit();
  unit.verificationEvidence.organizationId = 'org-002';

  assert.equal(core.evaluate(unit).readyForDelivery, false);
});

test('Evidencia de otra unidad no valida entrega', () => {
  const unit = makeUnit();
  unit.verificationEvidence.unitId = 'depto-5';

  assert.equal(core.evaluate(unit).readyForDelivery, false);
});

test('Unidad sin identidad no confirma entrega', () => {
  const unit = makeUnit();
  delete unit.organizationId;
  delete unit.unitId;

  assert.equal(core.evaluate(unit).readyForDelivery, false);
});
