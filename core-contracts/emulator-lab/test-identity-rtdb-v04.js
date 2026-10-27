
'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { initializeApp, deleteApp } =
  require('firebase-admin/app');
const { getDatabase } =
  require('firebase-admin/database');

const { createOperationalUnitId } =
  require('../property/unit-identity-bridge.v0.1.js');

const { createRtdbEventStore } =
  require('../property/unit-event-rtdb.v0.3.js');

const HOST = '127.0.0.1:19000';

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== HOST) {
  throw new Error('Solo se permite el emulador local');
}

const app = initializeApp({
  projectId: 'demo-property-core-lab',
  databaseURL:
    'https://demo-property-core-lab-default-rtdb.firebaseio.com'
}, 'identity-rtdb-v04');

const runId = randomUUID();

const base = {
  organizationId: 'org-v04-' + runId,
  propertyGroupId: 'edificio-a',
  unitId: '01',
  propiedadId: 'prop-1'
};

function event(identity, eventId, overrides = {}) {
  return {
    eventId,
    organizationId: identity.organizationId,
    unitId: createOperationalUnitId(identity),
    actorId: 'operator-v04',
    type: 'inspection_recorded',
    occurredAt: '2026-10-16T12:00:00Z',
    ...overrides
  };
}

function pathFor(input) {
  return 'propertyCore/eventsById/' +
    encodeURIComponent(input.organizationId)
      .replace(/\./g, '%2E') + '/' +
    encodeURIComponent(input.eventId)
      .replace(/\./g, '%2E');
}

async function main() {
  const db = getDatabase(app);
  const storeA = createRtdbEventStore(db);
  const storeB = createRtdbEventStore(db);

  const buildingB = {
    ...base,
    propertyGroupId: 'edificio-b',
    propiedadId: 'prop-2'
  };

  const a = event(base, 'r01-a-' + runId);
  const b = event(buildingB, 'r01-b-' + runId);

  await Promise.all([
    storeA.append(a),
    storeB.append(b)
  ]);

  const [savedA, savedB] = await Promise.all([
    db.ref(pathFor(a)).once('value'),
    db.ref(pathFor(b)).once('value')
  ]);

  assert.equal(savedA.val().unitId, a.unitId);
  assert.equal(savedB.val().unitId, b.unitId);
  assert.notEqual(a.unitId, b.unitId);
  console.log('PASS R01: edificios separados');

  const orgB = {
    ...base,
    organizationId: 'org-v04-b-' + runId
  };

  const sharedId = 'r02-shared-' + runId;
  const orgEventA = event(base, sharedId);
  const orgEventB = event(orgB, sharedId);

  const orgResults = await Promise.all([
    storeA.append(orgEventA),
    storeB.append(orgEventB)
  ]);

  assert.ok(orgResults.every(r => r.created === true));

  const [orgSavedA, orgSavedB] = await Promise.all([
    db.ref(pathFor(orgEventA)).once('value'),
    db.ref(pathFor(orgEventB)).once('value')
  ]);

  assert.equal(
    orgSavedA.val().organizationId,
    base.organizationId
  );
  assert.equal(
    orgSavedB.val().organizationId,
    orgB.organizationId
  );
  console.log('PASS R02: organizaciones aisladas');

  const renamed = {
    ...base,
    propiedadId: 'prop-nueva'
  };

  assert.equal(
    createOperationalUnitId(base),
    createOperationalUnitId(renamed)
  );

  const renamedEvent =
    event(renamed, 'r03-' + runId);

  await storeA.append(renamedEvent);

  const renamedSaved =
    await db.ref(pathFor(renamedEvent)).once('value');

  assert.equal(
    renamedSaved.val().unitId,
    createOperationalUnitId(base)
  );
  console.log('PASS R03: identidad estable');

  const concurrentEvent =
    event(base, 'r04-' + runId);

  const concurrent = await Promise.all([
    storeA.append(concurrentEvent),
    storeB.append(concurrentEvent)
  ]);

  assert.equal(
    concurrent.filter(r => r.created).length,
    1
  );
  assert.equal(
    concurrent.filter(r => !r.created).length,
    1
  );

  const concurrentSaved =
    await db.ref(pathFor(concurrentEvent)).once('value');

  assert.equal(
    concurrentSaved.val().eventId,
    concurrentEvent.eventId
  );
  console.log('PASS R04: concurrencia idempotente');

  const conflicting =
    event(base, 'r05-' + runId);

  await storeA.append(conflicting);

  await assert.rejects(
    storeB.append({
      ...conflicting,
      actorId: 'different-operator'
    }),
    /conflicto/i
  );

  const original =
    await db.ref(pathFor(conflicting)).once('value');

  assert.equal(
    original.val().actorId,
    'operator-v04'
  );
  console.log('PASS R05: conflicto rechazado');

  console.log('RESULTADO: 5/5 comprobaciones aprobadas');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => deleteApp(app));
