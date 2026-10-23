
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createOperationalUnitId
} = require('../property/unit-identity-bridge.v0.1.js');

const {
  createTransactionalEventStore
} = require('../property/unit-event-transactional.v0.2.js');

const base = {
  organizationId: 'org-a',
  propertyGroupId: 'edificio-a',
  unitId: '01',
  propiedadId: 'prop-1'
};

function event(identity, eventId) {
  return {
    eventId,
    organizationId: identity.organizationId,
    unitId: createOperationalUnitId(identity),
    actorId: 'tester',
    type: 'inspection_recorded',
    occurredAt: '2026-10-16T12:00:00-06:00'
  };
}

test('I01: edificios distintos mantienen historiales separados', async () => {
  const store = createTransactionalEventStore();

  const a = base;
  const b = {
    ...base,
    propertyGroupId: 'edificio-b',
    propiedadId: 'prop-2'
  };

  await store.append(event(a, 'event-a'));
  await store.append(event(b, 'event-b'));

  const historyA = store.list(
    a.organizationId,
    createOperationalUnitId(a)
  );

  const historyB = store.list(
    b.organizationId,
    createOperationalUnitId(b)
  );

  assert.equal(historyA.length, 1);
  assert.equal(historyB.length, 1);
  assert.equal(historyA[0].eventId, 'event-a');
  assert.equal(historyB[0].eventId, 'event-b');
});

test('I02: organizaciones distintas permanecen aisladas', async () => {
  const store = createTransactionalEventStore();

  const b = {
    ...base,
    organizationId: 'org-b'
  };

  await store.append(event(base, 'event-a'));
  await store.append(event(b, 'event-b'));

  assert.equal(
    store.list(
      base.organizationId,
      createOperationalUnitId(base)
    ).length,
    1
  );

  assert.equal(
    store.list(
      b.organizationId,
      createOperationalUnitId(b)
    ).length,
    1
  );
});

test('I03: cambiar ficha comercial conserva identidad operativa', () => {
  const a = createOperationalUnitId(base);

  const b = createOperationalUnitId({
    ...base,
    propiedadId: 'prop-nueva'
  });

  assert.equal(a, b);
});

test('I04: reintento idéntico no duplica eventos', async () => {
  const store = createTransactionalEventStore();
  const input = event(base, 'event-retry');

  const first = await store.append(input);
  const second = await store.append(input);

  assert.equal(first.created, true);
  assert.equal(second.created, false);

  assert.equal(
    store.list(
      base.organizationId,
      createOperationalUnitId(base)
    ).length,
    1
  );
});

test('I05: mismo eventId con contenido diferente genera conflicto', async () => {
  const store = createTransactionalEventStore();

  await store.append(event(base, 'event-conflict'));

  const other = {
    ...base,
    propertyGroupId: 'edificio-b'
  };

  await assert.rejects(
    store.append(event(other, 'event-conflict')),
    /conflicto/i
  );
});
