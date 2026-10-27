"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateBookingRequest: validate } = require("../property/booking-commit-gate.v0.1.js");

const valid = { requestId:"req-001", propiedadId:"prop-001", fecha:"2026-10-20", hora:"10:30" };

test("BCG01 solicitud válida", () => {
  assert.deepEqual(validate(valid), valid);
});

test("BCG02 solicitud ausente", () => {
  assert.throws(() => validate(null), /Solicitud de reserva inválida/);
});

test("BCG03 identificador obligatorio", () => {
  assert.throws(() => validate({...valid, requestId:""}), /requestId/);
});

test("BCG04 propiedad obligatoria", () => {
  assert.throws(() => validate({...valid, propiedadId:" "}), /propiedadId/);
});

test("BCG05 fecha con formato inválido", () => {
  assert.throws(() => validate({...valid, fecha:"20-10-2026"}), /Fecha inválida/);
});

test("BCG06 hora con formato inválido", () => {
  assert.throws(() => validate({...valid, hora:"25:90"}), /Hora inválida/);
});

test("BCG07 normalización de identificadores", () => {
  const result = validate({...valid, requestId:" req-001 ", propiedadId:" prop-001 "});
  assert.equal(result.requestId, "req-001");
  assert.equal(result.propiedadId, "prop-001");
});

test("BCG08 resultado inmutable", () => {
  assert.equal(Object.isFrozen(validate(valid)), true);
});
