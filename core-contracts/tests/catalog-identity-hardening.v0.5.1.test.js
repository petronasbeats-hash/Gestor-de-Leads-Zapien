"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditCatalog } = require("../property/catalog-identity-audit.v0.5.1.js");

test("H01 ficha inactiva", () => {
  const r = auditCatalog({p:{activo:false,organizationId:"a",propertyGroupId:"b",unitId:"01"}});
  assert.ok(r.rows[0].flags.includes("INACTIVE"));
  assert.ok(!r.rows[0].flags.includes("READY"));
});

test("H02 identidad malformada", () => {
  const r = auditCatalog({p:{organizationId:123,propertyGroupId:{},unitId:[]}});
  assert.ok(r.rows[0].flags.includes("MALFORMED_IDENTITY"));
  assert.ok(!r.rows[0].flags.includes("LEGACY"));
});

test("H03 duplicado potencial", () => {
  const r = auditCatalog({
    p1:{propertyGroupId:"adn",unitId:"yin-01"},
    p2:{propertyGroupId:"adn",unitId:"yin-01"}
  });
  assert.equal(r.counts.POTENTIAL_DUPLICATE,2);
  assert.equal(r.counts.DUPLICATE||0,0);
});

test("H04 reserva ambigua preservada", () => {
  const r = auditCatalog({
    p1:{organizationId:"a",propertyGroupId:"b1",unitId:"YIN-01"},
    p2:{organizationId:"a",propertyGroupId:"b2",unitId:"yin-01"}
  });
  assert.equal(r.counts.AMBIGUOUS_BOOKING,2);
});
