"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { createBookingTrustBoundary } =
  require("../property/booking-trust-boundary.v0.1.js");

async function main() {
  const propiedadId = "prop-bcg37";
  const catalog = {
    [propiedadId]: {
      activo: true,
      organizationId: "org-real",
      propertyGroupId: "edificio-real",
      unitId: "unidad-01"
    }
  };

  const calls = [];
  const boundary = createBookingTrustBoundary({
    loadCatalog: async () => catalog,
    authorizeBooking: async ({ propiedadId: id }) =>
      id === propiedadId,
    adapter: {
      async confirm(prepared) {
        calls.push(prepared);
        return { created: true };
      }
    }
  });

  const request = {
    requestId: randomUUID(),
    propiedadId,
    fecha: "2026-11-20",
    hora: "10:00"
  };

  const result = await boundary.confirm(request);
  assert.equal(result.created, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].identity.operationalIdentity.organizationId,
    "org-real"
  );
  console.log("PASS BCG37-A: identidad del catálogo");

  const forged = {
    ...request,
    requestId: randomUUID(),
    identity: {
      valid: true,
      operationalIdentity: {
        organizationId: "org-falsa"
      }
    },
    catalog: {
      [propiedadId]: {
        organizationId: "org-falsa"
      }
    }
  };

  await boundary.confirm(forged);
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].identity.operationalIdentity.organizationId,
    "org-real"
  );
  console.log("PASS BCG37-B: identidad falsificada ignorada");

  const denied = createBookingTrustBoundary({
    loadCatalog: async () => catalog,
    authorizeBooking: async () => false,
    adapter: {
      async confirm() {
        throw new Error("El adaptador no debió ejecutarse");
      }
    }
  });

  await assert.rejects(
    () => denied.confirm(request),
    /Reserva no autorizada/
  );
  console.log("PASS BCG37-C: autorización denegada");

  await assert.rejects(
    () => boundary.confirm({
      ...request,
      propiedadId: "prop-inexistente"
    }),
    /Propiedad no disponible/
  );
  assert.equal(calls.length, 2);
  console.log("PASS BCG37-D: propiedad inexistente rechazada");

  console.log("RESULTADO BCG37: 4/4 pruebas aprobadas");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
