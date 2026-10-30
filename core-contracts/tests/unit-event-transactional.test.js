const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createTransactionalEventStore } = require(
  '../property/unit-event-transactional.v0.2.js'
);

function makeEvent(id = 'evt-001', org = 'org-001') {
  return {
    eventId: id,
    organizationId: org,
    unitId: 'depto-6',
    type: 'maintenance_started',
    actorId: 'operator-001',
    occurredAt: '2026-10-07T12:00:00Z'
  };
}

test('Registra un evento por primera vez', async () => {
  const store = createTransactionalEventStore();

  const result = await store.append(makeEvent());

  assert.equal(result.created, true);
  assert.equal(store.list('org-001', 'depto-6').length, 1);
});

test('Reintento idéntico no duplica evento', async () => {
  const store = createTransactionalEventStore();

  await store.append(makeEvent());
  const retry = await store.append(makeEvent());

  assert.equal(retry.created, false);
  assert.equal(store.list('org-001', 'depto-6').length, 1);
});

test('Mismo ID con contenido distinto genera conflicto', async () => {
  const store = createTransactionalEventStore();

  await store.append(makeEvent());

  await assert.rejects(
    store.append({
      ...makeEvent(),
      actorId: 'otro-operador'
    })
  );
});

test('Reintentos concurrentes generan un solo evento', async () => {
  const store = createTransactionalEventStore();

  const results = await Promise.all([
    store.append(makeEvent()),
    store.append(makeEvent())
  ]);

  assert.equal(
    results.filter(result => result.created).length,
    1
  );

  assert.equal(store.list('org-001', 'depto-6').length, 1);
});

test('Organizaciones distintas mantienen aislamiento', async () => {
  const store = createTransactionalEventStore();

  await store.append(makeEvent('evt-001', 'org-001'));
  await store.append(makeEvent('evt-001', 'org-002'));

  assert.equal(store.list('org-001', 'depto-6').length, 1);
  assert.equal(store.list('org-002', 'depto-6').length, 1);
});

test('Reintento con propiedades reordenadas es idempotente', async () => {
  const store = createTransactionalEventStore();
  const original = makeEvent();

  await store.append(original);

  const reordered = {
    occurredAt: original.occurredAt,
    actorId: original.actorId,
    type: original.type,
    unitId: original.unitId,
    organizationId: original.organizationId,
    eventId: original.eventId
  };

  const retry = await store.append(reordered);

  assert.equal(retry.created, false);
  assert.equal(store.list('org-001', 'depto-6').length, 1);
});

test('Conflictos concurrentes no alteran el historial', async () => {
  const store = createTransactionalEventStore();

  const results = await Promise.allSettled([
    store.append(makeEvent()),
    store.append({
      ...makeEvent(),
      actorId: 'operator-002'
    })
  ]);

  assert.equal(
    results.filter(r => r.status === 'fulfilled').length,
    1
  );

  assert.equal(
    results.filter(r => r.status === 'rejected').length,
    1
  );

  const history = store.list('org-001', 'depto-6');

  assert.equal(history.length, 1);
  assert.equal(history[0].actorId, 'operator-001');
});
