"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const HOST = "127.0.0.1:19000";

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== HOST) {
  throw new Error("Solo se permite RTDB Emulator local");
}

const { initializeApp, deleteApp } =
  require("firebase-admin/app");
const { getDatabase } =
  require("firebase-admin/database");

const { createBookingRtdbAdapter } =
  require("../property/booking-rtdb-adapter.v0.2.js");

const { createBookingTrustBoundary } =
  require("../property/booking-trust-boundary.v0.1.js");

async function main() {
  const app = initializeApp({
    projectId: "demo-property-core-lab",
    databaseURL: "https:" + String.fromCharCode(47, 47) +
      "demo-property-core-lab-default-rtdb.firebaseio.com"
  }, "booking-trust-" + randomUUID());

  try {
    const db = getDatabase(app);

    const rootPath = "bookingCore/labBCG38/" +
      randomUUID().replace(/-/g, "");

    const adapter = createBookingRtdbAdapter(db, rootPath);

    const catalog = {
      "prop-A": {
        activo: true,
        organizationId: "org-A",
        propertyGroupId: "edificio-A",
        unitId: "unidad-01"
      }
    };

    let authorized = true;

    const boundary = createBookingTrustBoundary({
      loadCatalog: async () => catalog,
      authorizeBooking: async () => authorized,
      adapter
    });

    const fecha = new Date(
      Date.now() + 30 * 86400000
    ).toISOString().slice(0, 10);

    const request = {
      requestId: "bcg38-" + randomUUID(),
      propiedadId: "prop-A",
      fecha,
      hora: "10:00"
    };

    const created = await boundary.confirm(request);

    assert.equal(created.created, true);

    let state = (await db.ref(rootPath).get()).val();

    assert.equal(Object.keys(state.requests).length, 1);
    assert.equal(Object.keys(state.slots).length, 1);

    console.log("PASS BCG38-A: reserva autorizada persistida");

    authorized = false;

    await assert.rejects(
      () => boundary.confirm({
        ...request,
        requestId: "denied-" + randomUUID(),
        hora: "11:00"
      }),
      /Reserva no autorizada/
    );

    state = (await db.ref(rootPath).get()).val();

    assert.equal(Object.keys(state.requests).length, 1);
    assert.equal(Object.keys(state.slots).length, 1);

    console.log("PASS BCG38-B: rechazo sin persistencia");

    authorized = true;

    const forged = {
      ...request,
      requestId: "forged-" + randomUUID(),
      hora: "12:00",
      identity: {
        valid: true,
        operationalIdentity: {
          organizationId: "org-falsa",
          propertyGroupId: "edificio-falso",
          unitId: "unidad-falsa",
          propiedadId: "prop-A"
        }
      }
    };

    const forgedResult = await boundary.confirm(forged);

    assert.equal(forgedResult.created, true);

    state = (await db.ref(rootPath).get()).val();

    const key = Buffer.from(
      forged.requestId, "utf8"
    ).toString("hex");

    assert.equal(
      state.requests[key].operationalIdentity.organizationId,
      "org-A"
    );

    console.log("PASS BCG38-C: identidad falsificada ignorada");

    const retry = await boundary.confirm(request);

    assert.equal(retry.created, false);

    state = (await db.ref(rootPath).get()).val();

    assert.equal(Object.keys(state.requests).length, 2);
    assert.equal(Object.keys(state.slots).length, 2);

    console.log("PASS BCG38-D: reintento idempotente");

    console.log("RESULTADO BCG38: 4/4 pruebas aprobadas");
  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
