
"use strict";

function resolveCommercialProperty(catalog, params = {}) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new TypeError("Catálogo inválido");
  }

  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new TypeError("Parámetros inválidos");
  }

  function readId(key) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) return "";
    const value = params[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("Identificador inválido: " + key);
    }
    return value.trim();
  }

  const propiedadId = readId("propiedadId");
  const unitId = readId("unitId").toLowerCase();

  if (propiedadId && unitId) {
    throw new Error("Parámetros de identidad incompatibles");
  }

  const active = Object.entries(catalog).filter(
    ([, p]) => p && typeof p === "object" &&
      !Array.isArray(p) && p.activo !== false
  );

  if (propiedadId) {
    const match = active.find(([id]) => id === propiedadId);
    if (!match) throw new Error("Propiedad no disponible");
    return Object.freeze({ propiedadId: match[0], property: Object.freeze({ ...match[1] }), source: "propiedad" });
  }

  if (unitId) {
    const matches = active.filter(([, p]) =>
      typeof p.unitId === "string" &&
      p.unitId.trim().toLowerCase() === unitId
    );
    if (matches.length !== 1) {
      throw new Error(matches.length ? "Enlace ambiguo" : "Unidad no disponible");
    }
    return Object.freeze({ propiedadId: matches[0][0], property: Object.freeze({ ...matches[0][1] }), source: "unidad" });
  }

  return null;
}

function getOperationalIdentity(resolved) {
  if (!resolved) return null;
  const p = resolved.property;
  const fields = ["organizationId", "propertyGroupId", "unitId"];
  if (!fields.every(k => typeof p[k] === "string" && p[k].trim())) return null;
  return Object.freeze({
    organizationId: p.organizationId.trim(),
    propertyGroupId: p.propertyGroupId.trim(),
    unitId: p.unitId.trim(),
    propiedadId: resolved.propiedadId
  });
}

module.exports = Object.freeze({
  resolveCommercialProperty,
  getOperationalIdentity
});
