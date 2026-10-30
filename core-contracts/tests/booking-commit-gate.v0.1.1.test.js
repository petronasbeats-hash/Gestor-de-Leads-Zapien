"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateBookingRequest: validate } = require("../property/booking-commit-gate.v0.1.1.js");
const base = {requestId:"req-001",propiedadId:"prop-001",fecha:"2026-10-20",hora:"10:30"};

test("BCG09 rechaza febrero 30", () => {
  assert.throws(() => validate({...base,fecha:"2026-02-30"}), /Fecha inexistente/);
});
test("BCG10 acepta fecha real", () => {
  assert.equal(validate({...base,fecha:"2026-02-28"}).fecha,"2026-02-28");
});
test("BCG11 acepta año bisiesto", () => {
  assert.equal(validate({...base,fecha:"2028-02-29"}).fecha,"2028-02-29");
});
test("BCG12 rechaza febrero 29 no bisiesto", () => {
  assert.throws(() => validate({...base,fecha:"2027-02-29"}), /Fecha inexistente/);
});
test("BCG13 rechaza mes inexistente", () => {
  assert.throws(() => validate({...base,fecha:"2026-13-01"}), /Fecha inexistente/);
});
test("BCG14 conserva resultado inmutable", () => {
  assert.equal(Object.isFrozen(validate(base)),true);
});
