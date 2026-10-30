"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepareBooking } = require("../property/booking-commit-gate.v0.2.js");
const { resolveCommercialProperty } = require("../property/commercial-identity-resolver.v0.1.1.js");

const A = {
  activo: true,
  organizationId: "org-1",
  propertyGroupId: "adn",
  unitId: "yin-01"
};

const catalog = { A };
const original = resolveCommercialProperty(catalog, { propiedadId: "A" });
const request = {
  requestId: "req-001",
  propiedadId: "A",
  fecha: "2026-10-20",
  hora: "10:30"
};
const context = { catalog, original };

test("BCG15 identidad válida", () => {
  const result = prepareBooking(request, context);
  assert.equal(result.booking.propiedadId, "A");
  assert.equal(result.identity.operationalIdentity.unitId, "yin-01");
});

test("BCG16 propiedad distinta", () => {
  assert.throws(
    () => prepareBooking({ ...request, propiedadId: "B" }, context),
    /Conflicto entre solicitud e identidad/
  );
});

test("BCG17 organización modificada", () => {
  assert.throws(() => prepareBooking(request, {
    catalog: { A: { ...A, organizationId: "org-2" } },
    original
  }));
});

test("BCG18 grupo modificado", () => {
  assert.throws(() => prepareBooking(request, {
    catalog: { A: { ...A, propertyGroupId: "otro" } },
    original
  }));
});

test("BCG19 unidad modificada", () => {
  assert.throws(() => prepareBooking(request, {
    catalog: { A: { ...A, unitId: "yin-02" } },
    original
  }));
});

test("BCG20 identidad incompleta", () => {
  const incomplete = { ...A };
  delete incomplete.unitId;
  assert.throws(() => prepareBooking(request, {
    catalog: { A: incomplete },
    original
  }), /Identidad operativa incompleta/);
});

test("BCG21 fecha inexistente", () => {
  assert.throws(
    () => prepareBooking({ ...request, fecha: "2026-02-30" }, context),
    /Fecha inexistente/
  );
});

test("BCG22 contexto ausente", () => {
  assert.throws(
    () => prepareBooking(request, null),
    /Contexto confiable requerido/
  );
});

test("BCG23 propiedad inactiva", () => {
  assert.throws(() => prepareBooking(request, {
    catalog: { A: { ...A, activo: false } },
    original
  }));
});

test("BCG24 resultado inmutable", () => {
  const result = prepareBooking(request, context);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.booking), true);
  assert.equal(Object.isFrozen(result.identity), true);
});
