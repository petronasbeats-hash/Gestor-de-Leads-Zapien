"use strict";

const { prepareBooking } =
  require("./booking-commit-gate.v0.2.js");

const { resolveCommercialProperty } =
  require("./commercial-identity-resolver.v0.1.1.js");

function createBookingTrustBoundary({
  loadCatalog,
  authorizeBooking,
  adapter
}) {
  if (typeof loadCatalog !== "function" ||
      typeof authorizeBooking !== "function" ||
      !adapter || typeof adapter.confirm !== "function") {
    throw new TypeError("Dependencias confiables requeridas");
  }

  return Object.freeze({
    async confirm(request) {
      const catalog = await loadCatalog();

      const original = resolveCommercialProperty(catalog, {
        propiedadId: request?.propiedadId
      });

      if (!original) {
        throw new Error("Propiedad requerida");
      }

      const allowed = await authorizeBooking({
        propiedadId: original.propiedadId,
        property: original.property
      });

      if (allowed !== true) {
        throw new Error("Reserva no autorizada");
      }

      const prepared = prepareBooking(request, {
        catalog,
        original
      });

      if (!prepared.identity.operationalIdentity) {
        throw new Error("Identidad operativa requerida");
      }

      return adapter.confirm(prepared);
    }
  });
}

module.exports = Object.freeze({
  createBookingTrustBoundary
});
