const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createEventStore } = require(
  '../property/unit-event-store.v0.1.js'
);

function makeEvent(id, org = 'org-001') {
  return {
    eventId: id,
    organizationId: org,
    unitId: 'depto-6',
    type: 'maintenance_started',
    actorId: 'operator-001',
    occurredAt: '2026-10-07T12:00:00Z'
  };
}

test('Permite mismo ID en organizaciones distintas', () => {
  const store = createEventStore();

  store.append(makeEvent('evt-001', 'org-001'));
  store.append(makeEvent('evt-001', 'org-002'));

  assert.equal(store.list('org-001', 'depto-6').length, 1);
  assert.equal(store.list('org-002', 'depto-6').length, 1);
});

test('Duplicado rechazado no altera historial', () => {
  const store = createEventStore();

  store.append(makeEvent('evt-001'));

  assert.throws(() => {
    store.append(makeEvent('evt-001'));
  });

  assert.deepEqual(
    store.list('org-001', 'depto-6').map(e => e.eventId),
    ['evt-001']
  );
});

test('Modificar entrada original no altera evento registrado', () => {
  const store = createEventStore();
  const input = makeEvent('evt-001');

  store.append(input);

  input.actorId = 'actor-modificado';
  input.unitId = 'otra-unidad';

  const history = store.list('org-001', 'depto-6');

  assert.equal(history[0].actorId, 'operator-001');
  assert.equal(history[0].unitId, 'depto-6');
});

test('Cada instancia mantiene historial independiente', () => {
  const first = createEventStore();
  const second = createEventStore();

  first.append(makeEvent('evt-001'));

  assert.equal(first.list('org-001', 'depto-6').length, 1);
  assert.equal(second.list('org-001', 'depto-6').length, 0);
});
