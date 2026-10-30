"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const EMULATOR = "127.0.0.1:19000";
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== EMULATOR) {
  throw new Error("Solo se permite RTDB Emulator local");
}
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { createBookingRtdbAdapter } = require("../property/booking-rtdb-adapter.v0.1.js");

async function main() {
  const app = initializeApp({
    projectId: "demo-property-core-lab",
    databaseURL: "https:" + String.fromCharCode(47, 47) +
      "demo-property-core-lab-default-rtdb.firebaseio.com"
  }, "booking-test-" + randomUUID());
  try {
    const db = getDatabase(app);
    const adapter = createBookingRtdbAdapter(db);
    const unique = randomUUID();
    const identity = { valid: true, operationalIdentity: {
      organizationId: "org-lab",
      propertyGroupId: "adn",
      unitId: "yin-01",
      propiedadId: "A"
    } };
    const booking = (requestId, hora) => ({
      booking: { requestId, propiedadId: "A", fecha: "2026-10-20", hora },
      identity
    });

    const first = booking("req-" + unique, "10:30");
    const result = await adapter.confirm(first);
    assert.equal(result.created, true);
    console.log("PASS BCG25: reserva confirmada");

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
  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  console.error("FAIL BCG-05:", error.message);
  process.exitCode = 1;
});
