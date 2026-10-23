const assert = require('node:assert/strict');
const { test } = require('node:test');

const core = require('../property/unit-operational-status.v0.1.js');

test('No acepta condición física desconocida como lista', () => {
  const result = core.evaluate({
    physicalCondition: 'inventado',
    deliveryStatus: 'ready'
  });

  assert.equal(result.readyForDelivery, false);
});

test('No permite entrega si continúa mantenimiento', () => {
  const result = core.evaluate({
    physicalCondition: 'maintenance',
    deliveryStatus: 'ready'
  });

  assert.equal(result.readyForDelivery, false);
});

test('Visita condicionada conserva advertencia específica', () => {
  const result = core.evaluate({
    visitPolicy: 'allowed_with_notice'
  });

  assert.ok(
    result.warnings.some(w =>
      w.includes('Visita permitida con aviso')
    )
  );
});

test('Valores inválidos no deben conservarse', () => {
  const result = core.evaluate({
    physicalCondition: 'inventado',
    visitPolicy: 'inventado',
    photoStatus: 'inventado',
    deliveryStatus: 'inventado'
  });

  assert.equal(result.status.physicalCondition, 'unknown');
  assert.equal(result.status.visitPolicy, 'verification_required');
  assert.equal(result.status.photoStatus, 'unverified');
  assert.equal(result.status.deliveryStatus, 'unknown');
});
