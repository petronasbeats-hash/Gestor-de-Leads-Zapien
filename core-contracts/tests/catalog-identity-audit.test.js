"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditCatalog } = require("../property/catalog-identity-audit.v0.5.js");

const unit = (org, group, id, activo = true) => ({
  organizationId: org, propertyGroupId: group, unitId: id, activo
});

test("V01 identidad completa", () => {
  assert.deepEqual(auditCatalog({p:unit("a","b","01")}).rows[0].flags,["READY"]);
});
test("V02 ficha heredada", () => {
  assert.deepEqual(auditCatalog({p:{nombre:"Casa"}}).rows[0].flags,["LEGACY"]);
});
test("V03 organización ausente", () => {
  assert.deepEqual(auditCatalog({p:{propertyGroupId:"adn",unitId:"01"}}).rows[0].flags,["MISSING_ORGANIZATION"]);
});
test("V04 identidad incompleta", () => {
  assert.deepEqual(auditCatalog({p:{organizationId:"a",unitId:"01"}}).rows[0].flags,["INCOMPLETE"]);
});
test("V05 duplicados operativos", () => {
  const r=auditCatalog({p1:unit("a","b","01"),p2:unit("a","b","01")});
  assert.equal(r.counts.DUPLICATE,2);
});
test("V06 edificios diferentes", () => {
  const r=auditCatalog({p1:unit("a","b1","01"),p2:unit("a","b2","01")});
  assert.equal(r.counts.DUPLICATE||0,0);
  assert.equal(r.counts.AMBIGUOUS_BOOKING,2);
});
test("V07 organizaciones diferentes", () => {
  const r=auditCatalog({p1:unit("a","b","01"),p2:unit("c","b","01")});
  assert.equal(r.counts.DUPLICATE||0,0);
  assert.equal(r.counts.AMBIGUOUS_BOOKING,2);
});
test("V08 ficha inactiva", () => {
  const r=auditCatalog({p:unit("a","b","01",false)});
  assert.equal(r.inactive,1);
  assert.equal(r.counts.AMBIGUOUS_BOOKING||0,0);
});
test("V09 catálogo inmutable", () => {
  const p=Object.freeze(unit("a","b","01"));
  const catalog=Object.freeze({p});
  assert.equal(auditCatalog(catalog).total,1);
  assert.equal(p.unitId,"01");
});
test("V10 entrada inválida", () => {
  assert.throws(()=>auditCatalog(null),/Catálogo inválido/);
});
