const assert = require('node:assert/strict');
const { test } = require('node:test');

const log = require('../property/unit-event-log.v0.1.js');

function validEvent() {
  return {
    eventId: 'evt-001',
    organizationId: 'org-001',
    unitId: 'depto-6',
    type: 'maintenance_started',
    actorId: 'operator-001',
    occurredAt: '2026-10-07T12:00:00Z'
  };
}

test('Crea evento con identidad completa', () => {
  const event = log.createEvent(validEvent());

  assert.equal(event.organizationId, 'org-001');
  assert.equal(event.unitId, 'depto-6');
  assert.equal(Object.isFrozen(event), true);
});

test('Rechaza eventos sin organización', () => {
  const input = validEvent();
  delete input.organizationId;

  assert.throws(() => log.createEvent(input));
});

test('Rechaza eventos sin unidad', () => {
  const input = validEvent();
  delete input.unitId;

  assert.throws(() => log.createEvent(input));
});

test('Rechaza eventos sin responsable', () => {
  const input = validEvent();
  delete input.actorId;

  assert.throws(() => log.createEvent(input));
});

test('Rechaza tipos desconocidos', () => {
  assert.throws(() => log.createEvent({
    ...validEvent(),
    type: 'unknown_event'
  }));
});

test('Rechaza fechas inválidas', () => {
  assert.throws(() => log.createEvent({
    ...validEvent(),
    occurredAt: 'fecha-inventada'
  }));
});

test('Rechaza fechas imposibles', () => {
  assert.throws(() => log.createEvent({
    ...validEvent(),
    occurredAt: '2026-02-30T12:00:00Z'
  }));
});

test('Conserva referencia de evidencia', () => {
  const event = log.createEvent({
    ...validEvent(),
    evidenceId: 'inspection-001'
  });

  assert.equal(event.evidenceId, 'inspection-001');
});
