const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createEventStore } = require(
  '../property/unit-event-store.v0.1.js'
);

function event(id, org = 'org-001', unit = 'depto-6') {
  return {
    eventId: id,
    organizationId: org,
    unitId: unit,
    type: 'maintenance_started',
    actorId: 'operator-001',
    occurredAt: '2026-10-07T12:00:00Z'
  };
}

test('Registra y consulta eventos de una unidad', () => {
  const store = createEventStore();
  store.append(event('evt-001'));

  const history = store.list('org-001', 'depto-6');

  assert.equal(history.length, 1);
  assert.equal(history[0].eventId, 'evt-001');
});

test('Rechaza eventos duplicados en una organización', () => {
  const store = createEventStore();
  store.append(event('evt-001'));

  assert.throws(() => store.append(event('evt-001')));
});

test('Aísla el historial por organización', () => {
  const store = createEventStore();

  store.append(event('evt-001', 'org-001'));
  store.append(event('evt-002', 'org-002'));

  assert.equal(store.list('org-001', 'depto-6').length, 1);
  assert.equal(store.list('org-002', 'depto-6').length, 1);
});

test('Aísla el historial por unidad', () => {
  const store = createEventStore();

  store.append(event('evt-001', 'org-001', 'depto-6'));
  store.append(event('evt-002', 'org-001', 'depto-5'));

  assert.equal(store.list('org-001', 'depto-6').length, 1);
  assert.equal(store.list('org-001', 'depto-5').length, 1);
});

test('La consulta no permite modificar el historial', () => {
  const store = createEventStore();
  store.append(event('evt-001'));

  const history = store.list('org-001', 'depto-6');

  assert.equal(Object.isFrozen(history), true);
  assert.equal(Object.isFrozen(history[0]), true);
});

test('Conserva el orden de registro', () => {
  const store = createEventStore();

  store.append(event('evt-001'));
  store.append(event('evt-002'));

  assert.deepEqual(
    store.list('org-001', 'depto-6').map(e => e.eventId),
    ['evt-001', 'evt-002']
  );
});
