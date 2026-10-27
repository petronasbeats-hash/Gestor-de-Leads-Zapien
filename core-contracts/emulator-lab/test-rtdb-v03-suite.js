'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const {
  createRtdbEventStore
} = require('../property/unit-event-rtdb.v0.3.js');

const EMULATOR = '127.0.0.1:19000';

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== EMULATOR) {
  throw new Error('La suite solo puede ejecutarse en el emulador local');
}

const app = initializeApp({
  projectId: 'demo-property-core-lab',
  databaseURL: 'https:' + String.fromCharCode(47, 47) +
    'demo-property-core-lab-default-rtdb.firebaseio.com'
}, 'property-core-v03-suite');

function event(overrides = {}) {
  return {
    eventId: 'evt-suite-' + randomUUID(),
    organizationId: 'org-lab-A',
    unitId: 'depto-6',
    type: 'maintenance_started',
    actorId: 'operator-lab',
    occurredAt: '2026-10-07T12:00:00Z',
    ...overrides
  };
}

async function main() {
  const db = getDatabase(app);
  const storeA = createRtdbEventStore(db);
  const storeB = createRtdbEventStore(db);

  const firstEvent = event();

  const concurrent = await Promise.all([
    storeA.append(firstEvent),
    storeB.append(firstEvent)
  ]);

  assert.equal(concurrent.filter(r => r.created).length, 1);
  assert.equal(concurrent.filter(r => !r.created).length, 1);
  console.log('PASS 1: creación concurrente única');

  const retry = await storeA.append(firstEvent);
  assert.equal(retry.created, false);
  console.log('PASS 2: reintento idéntico');

  await assert.rejects(
    storeB.append({ ...firstEvent, actorId: 'otro-operador' }),
    /Conflicto/
  );
  console.log('PASS 3: conflicto rechazado');

  const path = [
    'propertyCore',
    'eventsById',
    firstEvent.organizationId,
    firstEvent.eventId
  ].join('/');

  const snapshot = await db.ref(path).once('value');

  assert.equal(snapshot.val().actorId, 'operator-lab');
  console.log('PASS 4: evento original preservado');

  const sharedId = 'evt-shared-' + randomUUID();

  const orgA = event({
    eventId: sharedId,
    organizationId: 'org-lab-A',
    actorId: 'operador-A'
  });

  const orgB = event({
    eventId: sharedId,
    organizationId: 'org-lab-B',
    actorId: 'operador-B'
  });

  const isolated = await Promise.all([
    storeA.append(orgA),
    storeB.append(orgB)
  ]);

  assert.ok(isolated.every(r => r.created === true));
  console.log('PASS 5: mismo ID permitido en organizaciones distintas');

  const [savedA, savedB] = await Promise.all([
    db.ref('propertyCore/eventsById/org-lab-A/' + sharedId).once('value'),
    db.ref('propertyCore/eventsById/org-lab-B/' + sharedId).once('value')
  ]);

  assert.equal(savedA.val().actorId, 'operador-A');
  assert.equal(savedB.val().actorId, 'operador-B');
  console.log('PASS 6: persistencia separada por organización');

  const retries = await Promise.all([
    storeA.append(orgA),
    storeB.append(orgB)
  ]);

  assert.ok(retries.every(r => r.created === false));
  console.log('PASS 7: idempotencia independiente por organización');


  const specialIds = [
    'org.001',
    'org/001',
    'org%2E001',
    'org-001'
  ];

  const specialEventId = 'evt-safe-' + randomUUID();

  const specialEvent = organizationId => event({
    eventId: specialEventId,
    organizationId
  });

  for (const id of specialIds) {
    const result = await storeA.append(specialEvent(id));
    assert.equal(result.created, true);
  }
  console.log('PASS 8: identificadores especiales registrados');

  const encodedKeys = specialIds.map(id =>
    encodeURIComponent(id).replace(/\./g, '%2E')
  );

  assert.equal(new Set(encodedKeys).size, specialIds.length);
  console.log('PASS 9: claves codificadas sin colisiones');

  for (let i = 0; i < specialIds.length; i++) {
    const saved = await db.ref(
      'propertyCore/eventsById/' +
      encodedKeys[i] + '/' + specialEventId
    ).once('value');

    assert.equal(saved.val()?.organizationId, specialIds[i]);
  }
  console.log('PASS 10: identidad original preservada');

  for (const id of specialIds) {
    const retry = await storeB.append(specialEvent(id));
    assert.equal(retry.created, false);
  }
  console.log('PASS 11: idempotencia con identificadores especiales');

  console.log('RESULTADO: 11/11 comprobaciones aprobadas');
}

main()
  .catch(error => {
    console.error('FAIL:', error);
    process.exitCode = 1;
  })
  .finally(() => app.delete());
