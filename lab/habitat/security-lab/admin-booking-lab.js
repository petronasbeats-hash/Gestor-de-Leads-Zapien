"use strict";

// Emulator-only Admin SDK booking prototype.
// Not an HTTP endpoint and not production code.

const MARKER = "habitat-admin-booking-lab-v01";

function guard(input) {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9100") {
    throw Error("EMULATOR_9100_REQUIRED");
  }
  if (!/^LAB-ADMIN-[A-Z0-9-]+$/.test(input.requestId)) throw Error("LAB_REQUEST_ONLY");
  if (!/^2099-\d\d-\d\d_\d\d:\d\d$/.test(input.slotKey)) throw Error("LAB_SLOT_ONLY");
  if (!/^LAB-HAB-[A-Z0-9-]+$/.test(input.unitId)) throw Error("LAB_UNIT_ONLY");
}

async function book(db, input, failAt) {
  guard(input);

  const { requestId, slotKey, unitId } = input;
  const fingerprint = JSON.stringify([slotKey, unitId]);
  const base = db.ref("lab_admin_booking");
  const request = base.child("requests/" + requestId);
  const citaId = "LAB-CITA-" + requestId;

  // The transaction is the single authority for request identity.
  // Avoid a pre-read here: under concurrency it creates an unnecessary
  // observation point before the atomic decision.

  // Authoritative identity reservation.
  const identityTrace = [];
  const identity = await request.transaction(
    current => {
      identityTrace.push(current === null ? null : current);
      if (current === null) {
        return {
          fingerprint,
          slotKey,
          unitId,
          citaId,
          status: "processing",
          marker: MARKER
        };
      }

      if (current.fingerprint === fingerprint) {
        return current;
      }

      return;
    },
    undefined,
    false
  );

  if (!identity.committed) {
    const err = Error("IDEMPOTENCY_CONFLICT");
    err.identityTrace = identityTrace;
    err.requestId = requestId;
    err.fingerprint = fingerprint;
    throw err;
  }

  // If committed=true, the transaction itself accepted this fingerprint.
  // Do not add a second post-transaction identity check here; the isolated
  // diagnostic already proved independent request identities commit correctly.

  // Atomic shared-slot exclusion boundary.
  const slot = base.child("slots/" + slotKey);
  const claim = await slot.transaction(
    current => {
      if (current === null) {
        return {
          requestId,
          citaId,
          unitId,
          status: "processing",
          marker: MARKER
        };
      }

      if (
        current.marker === MARKER &&
        current.requestId === requestId &&
        current.citaId === citaId &&
        current.unitId === unitId
      ) {
        return current;
      }

      return;
    },
    undefined,
    false
  );

  if (!claim.committed) {
    return { ok: false, reason: "SLOT_TAKEN" };
  }

  if (failAt === "after_claim") {
    throw Error("INJECTED_AFTER_CLAIM");
  }

  const cita = base.child("citas/" + citaId);
  await cita.transaction(
    current =>
      current || {
        requestId,
        slotKey,
        unitId,
        marker: MARKER
      },
    undefined,
    false
  );

  if (failAt === "after_cita") {
    throw Error("INJECTED_AFTER_CITA");
  }

  await base.child("events/" + requestId + "/cita_created").set({
    type: "CITA_CREATED",
    requestId,
    marker: MARKER
  });

  await slot.child("status").set("confirmed");
  await request.child("status").set("confirmed");

  await base.child("events/" + requestId + "/confirmed").set({
    type: "BOOKING_CONFIRMED",
    requestId,
    marker: MARKER
  });

  return { ok: true, citaId };
}

module.exports = { book, MARKER };
