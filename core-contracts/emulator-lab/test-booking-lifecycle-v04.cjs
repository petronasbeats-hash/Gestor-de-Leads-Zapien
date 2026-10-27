'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const HOST = '127.0.0.1:19000';

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== HOST) {
  throw new Error('EMULATOR_REQUIRED');
}

const { initializeApp, deleteApp } =
  require('firebase-admin/app');

const { getDatabase } =
  require('firebase-admin/database');

const {
  createBookingLifecycleAdapter
} = require('../reservations/booking-lifecycle-rtdb.v0.4.cjs');

async function main() {
  const app = initializeApp({
    projectId: 'demo-property-core-lab',
    databaseURL:
      'https://demo-property-core-lab-default-rtdb.firebaseio.com'
  }, 'lifecycle-' + randomUUID());

  try {
    const db = getDatabase(app);
    const rootPath =
      'bookingCore/labLifecycleV04/' +
      randomUUID().replace(/-/g, '');

    const ref = db.ref(rootPath);

    const oldSlot = '2026-11-20_10:00';
    const newSlot = '2026-11-20_11:00';

    await ref.set({
      citas: {
        'cita-1': {
          slot: oldSlot,
          version: 1,
          estado: 'pendiente'
        }
      },
      slots: {
        [oldSlot]: 'cita-1'
      }
    });

    const adapter =
      createBookingLifecycleAdapter(db, rootPath);

    const command = {
      commandId: 'cmd-1',
      citaId: 'cita-1',
      expectedSlot: oldSlot,
      newSlot,
      expectedVersion: 1
    };

    const first = await adapter.reschedule(command);

    assert.equal(first.applied, true);

    let state = (await ref.get()).val();

    assert.equal(state.citas['cita-1'].slot, newSlot);
    assert.equal(state.citas['cita-1'].version, 2);
    assert.equal(state.slots[oldSlot], undefined);
    assert.equal(state.slots[newSlot], 'cita-1');
    assert.equal(
      state.citas['cita-1'].historial['cmd-1'].type,
      'RESCHEDULE'
    );

    console.log('PASS R22-A: reprogramación atómica');

    const retry = await adapter.reschedule(command);

    assert.equal(retry.applied, false);
    assert.equal(retry.version, 2);

    console.log('PASS R22-B: reintento idempotente');

    await assert.rejects(
      adapter.reschedule({
        ...command,
        newSlot: '2026-11-20_12:00'
      }),
      /COMMAND_ID_CONFLICT/
    );

    console.log('PASS R22-C: commandId protegido');

    await assert.rejects(
      adapter.reschedule({
        ...command,
        commandId: 'cmd-stale',
        newSlot: '2026-11-20_12:00'
      }),
      /RESCHEDULE_CONFLICT/
    );

    console.log('PASS R22-D: versión obsoleta rechazada');

    const concurrent = await Promise.allSettled([
      adapter.reschedule({
        commandId: 'cmd-race-a',
        citaId: 'cita-1',
        expectedSlot: newSlot,
        newSlot: '2026-11-20_13:00',
        expectedVersion: 2
      }),
      adapter.reschedule({
        commandId: 'cmd-race-b',
        citaId: 'cita-1',
        expectedSlot: newSlot,
        newSlot: '2026-11-20_14:00',
        expectedVersion: 2
      })
    ]);

    assert.equal(
      concurrent.filter(r => r.status === 'fulfilled').length,
      1
    );

    assert.equal(
      concurrent.filter(r => r.status === 'rejected').length,
      1
    );

    state = (await ref.get()).val();

    assert.equal(state.citas['cita-1'].version, 3);
    assert.equal(state.slots[newSlot], undefined);

    console.log('PASS R22-E: concurrencia, un ganador');

    console.log('RESULTADO R22: 5/5 PASS');

  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  console.error('FAIL R22:', error);
  process.exitCode = 1;
});
