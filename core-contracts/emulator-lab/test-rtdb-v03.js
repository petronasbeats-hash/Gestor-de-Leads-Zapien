'use strict';

const assert = require('node:assert/strict');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { createRtdbEventStore } = require(
  '../property/unit-event-rtdb.v0.3.js'
);

const projectId = 'demo-property-core-lab';
const namespace = 'demo-property-core-lab-default-rtdb';

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:19000') {
  throw new Error('Emulador RTDB no configurado');
}

const app = initializeApp({
  projectId,
  databaseURL: 'https://demo-property-core-lab-default-rtdb.firebaseio.com',
}, 'property-core-v03-test');

async function main() {
  const database = getDatabase(app);

  const storeA = createRtdbEventStore(database);
  const storeB = createRtdbEventStore(database);

  const event = {
    eventId: 'evt-v03-001',
    organizationId: 'org-lab-001',
    unitId: 'depto-6',
    type: 'maintenance_started',
    actorId: 'operator-lab',
    occurredAt: '2026-10-07T12:00:00Z'
  };

  const results = await Promise.all([
    storeA.append(event),
    storeB.append(event)
  ]);

  assert.equal(
    results.filter(result => result.created).length,
    1
  );

  assert.equal(
    results.filter(result => !result.created).length,
    1
  );

  console.log('PASS: una sola creación');
  console.log('PASS: reintento reconocido');
  console.log('PASS: dos instancias comparten estado persistido');
}

main()
  .catch(error => {
    console.error('FAIL:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await app.delete();
  });
