"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { createBookingTrustBoundary } =
  require("../property/booking-trust-boundary.v0.1.js");

async function main() {
  const catalog = {
    "prop-A1": {
      activo: true,
      organizationId: "org-A",
      propertyGroupId: "edificio-1",
      unitId: "unidad-01"
    },
    "prop-A2": {
      activo: true,
      organizationId: "org-A",
      propertyGroupId: "edificio-1",
      unitId: "unidad-02"
    },
    "prop-B1": {
      activo: true,
      organizationId: "org-B",
      propertyGroupId: "edificio-1",
      unitId: "unidad-01"
    },
    "prop-inactiva": {
      activo: false,
      organizationId: "org-A",
      propertyGroupId: "edificio-1",
      unitId: "unidad-03"
    }
  };

  const authorizedScope = {
    organizationId: "org-A",
    propertyGroupId: "edificio-1",
    unitId: "unidad-01"
  };

  const confirmed = [];

  const boundary = createBookingTrustBoundary({
    loadCatalog: async () => catalog,
    authorizeBooking: async ({ property }) =>
      property.organizationId === authorizedScope.organizationId &&
      property.propertyGroupId === authorizedScope.propertyGroupId &&
      property.unitId === authorizedScope.unitId,
    adapter: {
      async confirm(prepared) {
        confirmed.push(prepared);
        return { created: true };
      }
    }
  });

  const request = propiedadId => ({
    requestId: randomUUID(),
    propiedadId,
    fecha: "2026-11-20",
    hora: "10:00"
  });

  await boundary.confirm(request("prop-A1"));
  assert.equal(confirmed.length, 1);
  console.log("PASS BCG39-A: unidad autorizada");

  await assert.rejects(
    () => boundary.confirm(request("prop-B1")),
    /Reserva no autorizada/
  );
  assert.equal(confirmed.length, 1);
  console.log("PASS BCG39-B: organización ajena rechazada");

  await assert.rejects(
    () => boundary.confirm(request("prop-A2")),
    /Reserva no autorizada/
  );
  assert.equal(confirmed.length, 1);
  console.log("PASS BCG39-C: unidad ajena rechazada");

  await assert.rejects(
    () => boundary.confirm(request("prop-inactiva")),
    /Propiedad no disponible/
  );
  assert.equal(confirmed.length, 1);
  console.log("PASS BCG39-D: propiedad inactiva rechazada");

  await boundary.confirm({
    ...request("prop-A1"),
    organizationId: "org-B",
    propertyGroupId: "edificio-falso",
    unitId: "unidad-falsa"
  });

  assert.equal(confirmed.length, 2);
  assert.equal(
    confirmed[1].identity.operationalIdentity.organizationId,
    "org-A"
  );
  assert.equal(
    confirmed[1].identity.operationalIdentity.unitId,
    "unidad-01"
  );

  console.log("PASS BCG39-E: identidad falsificada ignorada");
  console.log("RESULTADO BCG39: 5/5 pruebas aprobadas");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
