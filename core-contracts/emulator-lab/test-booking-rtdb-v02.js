"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const EMULATOR = "127.0.0.1:19000";
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== EMULATOR) {
  throw new Error("Solo se permite RTDB Emulator local");
}
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { createBookingRtdbAdapter } = require("../property/booking-rtdb-adapter.v0.2.js");

async function main() {
  const app = initializeApp({
    projectId: "demo-property-core-lab",
    databaseURL: "https:" + String.fromCharCode(47, 47) +
      "demo-property-core-lab-default-rtdb.firebaseio.com"
  }, "booking-test-" + randomUUID());
  try {
    const db = getDatabase(app);
    const rootPath = "bookingCore/labV02/" +
      randomUUID().replace(/-/g, "");
    const adapter = createBookingRtdbAdapter(db, rootPath);
    const unique = randomUUID();
    const labDate = new Date(Date.now() + 86400000 * 30);
    const fecha = labDate.toISOString().slice(0, 10);
    const identity = { valid: true, operationalIdentity: {
      organizationId: "org-lab",
      propertyGroupId: "adn",
      unitId: "yin-01",
      propiedadId: "A"
    } };
    const booking = (requestId, hora) => ({
      booking: { requestId, propiedadId: "A", fecha, hora },
      identity
    });

    const first = booking("req-" + unique, "10:30");
    const result = await adapter.confirm(first);
    assert.equal(result.created, true);
    console.log("PASS BCG25: reserva confirmada");

    const retry = await adapter.confirm(first);
    assert.equal(retry.created, false);
    assert.equal(retry.requestId, first.booking.requestId);
    console.log("PASS BCG28: reintento idéntico sin duplicación");

    const conflict = booking("other-" + unique, "10:30");
    await assert.rejects(
      () => adapter.confirm(conflict),
      /Reserva no confirmada/
    );
    console.log("PASS BCG26: horario ocupado rechazado");

    const reused = booking("req-" + unique, "11:00");
    await assert.rejects(
      () => adapter.confirm(reused),
      /Reserva no confirmada/
    );
    console.log("PASS BCG27: requestId reutilizado rechazado");

    const concurrent = await Promise.allSettled([
      adapter.confirm(booking("race-A-" + unique, "12:00")),
      adapter.confirm(booking("race-B-" + unique, "12:00"))
    ]);

    const wins = concurrent.filter(r =>
      r.status === "fulfilled" && r.value.created === true
    );
    const losses = concurrent.filter(r =>
      r.status === "rejected" &&
      /Reserva no confirmada/.test(r.reason.message)
    );

    assert.equal(wins.length, 1);
    assert.equal(losses.length, 1);
    console.log("PASS BCG29: concurrencia, un ganador");

    const sameRequest = booking("retry-race-" + unique, "13:00");
    const retries = await Promise.allSettled([
      adapter.confirm(sameRequest),
      adapter.confirm(sameRequest)
    ]);

    assert.equal(retries.filter(r => r.status === "rejected").length, 0);
    assert.deepEqual(
      retries.map(r => r.value.created).sort(),
      [false, true]
    );

    console.log("PASS BCG30: reintentos concurrentes idempotentes");

    const persisted = (await db.ref(rootPath).get()).val();
    const requests = persisted?.requests || {};
    const slots = persisted?.slots || {};
    const encode = value => Buffer.from(value, "utf8").toString("hex");

    const encodeSlot = (operationalIdentity, date, time) =>
      encode(JSON.stringify([
        operationalIdentity.organizationId,
        operationalIdentity.propertyGroupId,
        operationalIdentity.unitId,
        date,
        time
      ]));


    assert.equal(Object.keys(requests).length, 3);
    assert.equal(Object.keys(slots).length, 3);

    const expectedBookings = [
      first.booking,
      wins[0].value,
      sameRequest.booking
    ];

    for (const item of expectedBookings) {
      const requestKey = encode(item.requestId);
      const slotKey = encodeSlot(identity.operationalIdentity, item.fecha, item.hora);

      assert.equal(requests[requestKey]?.requestId, item.requestId);
      assert.equal(requests[requestKey]?.propiedadId, item.propiedadId);
      assert.equal(requests[requestKey]?.fecha, item.fecha);
      assert.equal(requests[requestKey]?.hora, item.hora);
      assert.equal(requests[requestKey]?.estado, "confirmada");
      assert.equal(slots[slotKey], requestKey);
    }

    for (const requestKey of Object.values(slots)) {
      assert.ok(requests[requestKey], "Horario sin reserva asociada");
    }

    assert.equal(requests[encode(conflict.booking.requestId)], undefined);
    assert.equal(requests[encode(reused.booking.requestId)]?.hora, "10:30");

    console.log("PASS BCG31: integridad de persistencia e índices");

    const sharedId = "same-id-race-" + unique;
    const competing = await Promise.allSettled([
      adapter.confirm(booking(sharedId, "14:00")),
      adapter.confirm(booking(sharedId, "14:30"))
    ]);

    const accepted = competing.filter(r =>
      r.status === "fulfilled" && r.value.created === true
    );
    const rejected = competing.filter(r =>
      r.status === "rejected" &&
      /Reserva no confirmada/.test(r.reason.message)
    );

    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 1);

    const finalState = (await db.ref(rootPath).get()).val();
    const requestKey = encode(sharedId);
    const saved = finalState.requests[requestKey];

    assert.ok(saved);
    assert.equal(saved.hora, accepted[0].value.hora);

    const slot1400 = encodeSlot(identity.operationalIdentity, fecha, "14:00");
    const slot1430 = encodeSlot(identity.operationalIdentity, fecha, "14:30");

    const owners = [
      finalState.slots[slot1400],
      finalState.slots[slot1430]
    ];

    assert.equal(owners.filter(owner => owner === requestKey).length, 1);
    assert.equal(Object.keys(finalState.requests).length, 4);
    assert.equal(Object.keys(finalState.slots).length, 4);

    console.log("PASS BCG32: requestId concurrente con horarios distintos");

    const invalidIdentity = {
      booking: {
        requestId: "invalid-identity-" + unique,
        propiedadId: "A",
        fecha,
        hora: "15:00"
      },
      identity: {
        valid: true,
        operationalIdentity: null
      }
    };

    let invalidAccepted = false;
    try {
      const outcome = await adapter.confirm(invalidIdentity);
      invalidAccepted = outcome.created === true;
    } catch (error) {
      console.log("BCG33 rechazo:", error.message);
    }

    assert.equal(
      invalidAccepted,
      false,
      "BCG33: se aceptó una identidad operativa inválida"
    );

    const invalidKey = encode(invalidIdentity.booking.requestId);
    const invalidSnapshot = await db.ref(
      rootPath + "/requests/" + invalidKey
    ).get();

    assert.equal(
      invalidSnapshot.exists(),
      false,
      "BCG33: una identidad inválida produjo persistencia"
    );

    console.log("PASS BCG33: identidad incompleta rechazada");

    const malformed = [
      ["requestId numérico", 123, fecha, "16:00"],
      ["requestId vacío", "", fecha, "16:30"],
      ["fecha inválida", "bad-date-" + unique, "2026-99-99", "17:00"],
      ["hora inválida", "bad-time-" + unique, fecha, "99:99"]
    ];

    const before = (await db.ref(rootPath).get()).val();
    const countBefore = Object.keys(before?.requests || {}).length;
    const slotsBefore = Object.keys(before?.slots || {}).length;

    for (const [name, requestId, testDate, hora] of malformed) {
      const candidate = booking(requestId, hora);
      candidate.booking.fecha = testDate;

      await assert.rejects(
        () => adapter.confirm(candidate),
        /Identificador de reserva inválido|Fecha de reserva inválida|Horario de reserva inválido/,
        "BCG34: entrada inválida aceptada: " + name
      );
    }

    const after = (await db.ref(rootPath).get()).val();

    assert.equal(
      Object.keys(after?.requests || {}).length,
      countBefore,
      "BCG34: se creó una reserva inválida"
    );
    assert.equal(
      Object.keys(after?.slots || {}).length,
      slotsBefore,
      "BCG34: se creó un horario inválido"
    );

    console.log("PASS BCG34: entradas inválidas rechazadas sin persistencia");

    const unitA = booking("multi-A-" + unique, "16:00");
    const unitB = booking("multi-B-" + unique, "16:00");

    unitB.identity = {
      valid: true,
      operationalIdentity: {
        ...identity.operationalIdentity,
        unitId: "yin-02"
      }
    };

    const multiResults = await Promise.allSettled([
      adapter.confirm(unitA),
      adapter.confirm(unitB)
    ]);

    assert.equal(
      multiResults.length,
      2,
      "BCG35: número inesperado de resultados"
    );

    for (const result of multiResults) {
      assert.equal(result.status, "fulfilled",
        "BCG35: una unidad diferente fue bloqueada");
      assert.equal(result.value.created, true,
        "BCG35: reserva multiunidad no creada");
    }

    const multiState = (await db.ref(rootPath).get()).val();

    for (const candidate of [unitA, unitB]) {
      const key = encode(candidate.booking.requestId);
      const slot = encodeSlot(
        candidate.identity.operationalIdentity,
        candidate.booking.fecha,
        candidate.booking.hora
      );

      assert.equal(multiState.slots[slot], key);
      assert.equal(multiState.requests[key]?.requestId,
        candidate.booking.requestId);
      assert.equal(
        multiState.requests[key]?.operationalIdentity?.unitId,
        candidate.identity.operationalIdentity.unitId
      );
    }

    assert.equal(Object.keys(multiState.requests).length, 6);
    assert.equal(Object.keys(multiState.slots).length, 6);

    console.log("PASS BCG35: aislamiento multiunidad verificado");

    const orgA = booking("org-A-" + unique, "17:00");
    const orgB = booking("org-B-" + unique, "17:00");

    orgB.identity = {
      valid: true,
      operationalIdentity: {
        ...identity.operationalIdentity,
        organizationId: "org-lab-B"
      }
    };

    const orgResults = await Promise.allSettled([
      adapter.confirm(orgA),
      adapter.confirm(orgB)
    ]);

    assert.equal(orgResults.length, 2);

    for (const result of orgResults) {
      assert.equal(result.status, "fulfilled",
        "BCG36: organizaciones distintas interfieren");
      assert.equal(result.value.created, true);
    }

    const crossOrgRetry = booking(orgA.booking.requestId, "17:00");
    crossOrgRetry.identity = orgB.identity;

    await assert.rejects(
      () => adapter.confirm(crossOrgRetry),
      /Reserva no confirmada/,
      "BCG36: requestId reutilizado entre organizaciones"
    );

    const orgState = (await db.ref(rootPath).get()).val();

    for (const candidate of [orgA, orgB]) {
      const key = encode(candidate.booking.requestId);
      const slot = encodeSlot(
        candidate.identity.operationalIdentity,
        candidate.booking.fecha,
        candidate.booking.hora
      );

      assert.equal(orgState.slots[slot], key);
      assert.equal(
        orgState.requests[key]?.operationalIdentity?.organizationId,
        candidate.identity.operationalIdentity.organizationId
      );
    }

    assert.equal(Object.keys(orgState.requests).length, 8);
    assert.equal(Object.keys(orgState.slots).length, 8);

    console.log("PASS BCG36: aislamiento organizacional verificado");






  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  console.error("FAIL BCG-05:", error.message);
  process.exitCode = 1;
});
