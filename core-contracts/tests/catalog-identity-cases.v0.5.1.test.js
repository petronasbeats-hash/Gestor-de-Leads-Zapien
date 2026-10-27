"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {auditCatalog} = require("../property/catalog-identity-audit.v0.5.1.js");

test("C01 identidad completa", () => {
  const r = auditCatalog({p:{organizationId:"org-a",propertyGroupId:"adn",unitId:"01"}});
  assert.deepEqual(r.rows[0].flags,["READY"]);
});

test("C02 organización vacía", () => {
  const r = auditCatalog({p:{organizationId:"",propertyGroupId:"adn",unitId:"01"}});
  assert.ok(r.rows[0].flags.includes("MALFORMED_IDENTITY"));
  assert.ok(r.rows[0].flags.includes("MISSING_ORGANIZATION"));
  assert.ok(!r.rows[0].flags.includes("READY"));
});

test("C03 identificador numérico", () => {
  const r = auditCatalog({p:{organizationId:"org-a",propertyGroupId:"adn",unitId:42}});
  assert.ok(r.rows[0].flags.includes("MALFORMED_IDENTITY"));
  assert.ok(r.rows[0].flags.includes("INCOMPLETE"));
});

test("C04 organizaciones diferentes", () => {
  const r = auditCatalog({
    p1:{organizationId:"org-a",propertyGroupId:"adn",unitId:"01"},
    p2:{organizationId:"org-b",propertyGroupId:"adn",unitId:"01"}
  });
  assert.equal(r.counts.AMBIGUOUS_BOOKING,2);
  assert.equal(r.counts.DUPLICATE||0,0);
  assert.equal(r.counts.POTENTIAL_DUPLICATE||0,0);
});

test("C05 duplicado operativo confirmado", () => {
  const r = auditCatalog({
    p1:{organizationId:"org-a",propertyGroupId:"adn",unitId:"01"},
    p2:{organizationId:"org-a",propertyGroupId:"adn",unitId:"01"}
  });
  assert.equal(r.counts.DUPLICATE,2);
  assert.equal(r.counts.AMBIGUOUS_BOOKING,2);
});
