const assert = require('node:assert/strict');
const { test } = require('node:test');

const core = require('../property/unit-operational-status.v0.1.js');

test('Fecha de verificación inválida no se conserva', () => {
  const result = core.evaluate({
    lastVerifiedAt: 'fecha-inventada'
  });

  assert.equal(result.status.lastVerifiedAt, null);
});

test('Fecha de terminación inválida no se conserva', () => {
  const result = core.evaluate({
    estimatedCompletionAt: 'mañana-tal-vez'
  });

  assert.equal(result.status.estimatedCompletionAt, null);
});

test('Unidad lista sin verificación no confirma entrega', () => {
  const result = core.evaluate({
    physicalCondition: 'ready',
    deliveryStatus: 'ready'
  });

  assert.equal(result.readyForDelivery, false);
});

test('Mantenimiento nunca confirma entrega', () => {
  const result = core.evaluate({
    physicalCondition: 'maintenance',
    deliveryStatus: 'ready',
    lastVerifiedAt: '2026-10-07T12:00:00Z'
  });

  assert.equal(result.readyForDelivery, false);
});
