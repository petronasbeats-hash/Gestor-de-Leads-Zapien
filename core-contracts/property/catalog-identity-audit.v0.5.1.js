"use strict";

function auditCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new TypeError("Catálogo inválido");
  }

  const rows = [];
  const identities = new Map();
  const bookings = new Map();

  const clean = value => typeof value === "string" && value.trim() ? value.trim() : null;

  for (const [propiedadId, raw] of Object.entries(catalog)) {
    const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const active = p.activo !== false;
    const organizationId = clean(p.organizationId);
    const propertyGroupId = clean(p.propertyGroupId);
    const unitId = clean(p.unitId);
    const flags = [];

    const malformed = [p.organizationId, p.propertyGroupId, p.unitId]
      .some(v => v != null && (typeof v !== "string" || !v.trim()));
    if (malformed) flags.push("MALFORMED_IDENTITY");
    if (!organizationId && !propertyGroupId && !unitId && !malformed) flags.push("LEGACY");
    else if (!propertyGroupId || !unitId) flags.push("INCOMPLETE");
    else if (!organizationId) flags.push("MISSING_ORGANIZATION");

    if (!active) flags.push("INACTIVE");
    const row = { propiedadId, active, organizationId, propertyGroupId, unitId, flags };
    rows.push(row);

    if (active && organizationId && propertyGroupId && unitId) {
      const key = JSON.stringify([organizationId, propertyGroupId, unitId]);
      if (!identities.has(key)) identities.set(key, []);
      identities.get(key).push(row);
    }

    if (active && unitId) {
      const key = unitId.toLowerCase();
      if (!bookings.has(key)) bookings.set(key, []);
      bookings.get(key).push(row);
    }
  }

  for (const group of identities.values()) {
    if (group.length > 1) group.forEach(row => row.flags.push("DUPLICATE"));
  }

  const potential = new Map();
  for (const row of rows) {
    if (!row.active || !row.propertyGroupId || !row.unitId) continue;
    const key = JSON.stringify([row.propertyGroupId, row.unitId]);
    if (!potential.has(key)) potential.set(key, []);
    potential.get(key).push(row);
  }
  for (const group of potential.values()) {
    if (group.length > 1 && group.some(row => !row.organizationId)) {
      group.forEach(row => row.flags.push("POTENTIAL_DUPLICATE"));
    }
  }
  for (const group of bookings.values()) {
    if (group.length > 1) group.forEach(row => row.flags.push("AMBIGUOUS_BOOKING"));
  }

  const result = rows.map(row => Object.freeze({
    ...row,
    flags: Object.freeze(row.flags.length ? [...row.flags] : ["READY"])
  }));

  const counts = {};
  for (const row of result) {
    for (const flag of row.flags) counts[flag] = (counts[flag] || 0) + 1;
  }

  return Object.freeze({
    total: result.length,
    active: result.filter(row => row.active).length,
    inactive: result.filter(row => !row.active).length,
    counts: Object.freeze(counts),
    rows: Object.freeze(result)
  });
}

module.exports = Object.freeze({ auditCatalog });
