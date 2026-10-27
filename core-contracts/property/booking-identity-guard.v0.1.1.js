"use strict";

const {
  resolveCommercialProperty,
  getOperationalIdentity
} = require("./commercial-identity-resolver.v0.1.1.js");

const {
  resolveProperty
} = require("./unit-identity-bridge.v0.1.js");

function assertCompleteIdentity(resolved) {
  const p = resolved.property;
  const fields = ["organizationId", "propertyGroupId", "unitId"];
  const present = fields.filter(k =>
    Object.prototype.hasOwnProperty.call(p, k)
  );

  if (present.length === 0) return;

  if (!fields.every(k =>
    typeof p[k] === "string" && p[k].trim()
  )) {
    throw new Error("Identidad operativa incompleta");
  }
}

function revalidateBookingIdentity(catalog, original) {
  if (!original || typeof original !== "object" ||
      Array.isArray(original)) {
    throw new TypeError("Selección original inválida");
  }

  const id = original.propiedadId;

  if (typeof id !== "string" || !id.trim()) {
    throw new TypeError("propiedadId original inválido");
  }

  const current = resolveCommercialProperty(catalog, {
    propiedadId: id
  });

  assertCompleteIdentity(original);
  assertCompleteIdentity(current);

  const initial = getOperationalIdentity(original);
  const latest = getOperationalIdentity(current);

  if (Boolean(initial) !== Boolean(latest)) {
    throw new Error("Identidad operativa modificada");
  }

  if (initial) {
    for (const field of [
      "organizationId",
      "propertyGroupId",
      "unitId",
      "propiedadId"
    ]) {
      if (initial[field] !== latest[field]) {
        throw new Error("Conflicto de identidad: " + field);
      }
    }

    resolveProperty(catalog, latest);
  }

  return Object.freeze({
    valid: true,
    propiedadId: current.propiedadId,
    operationalIdentity: latest
  });
}

module.exports = Object.freeze({
  revalidateBookingIdentity
});
