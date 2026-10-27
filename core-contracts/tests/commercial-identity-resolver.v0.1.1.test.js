"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {resolveCommercialProperty: resolve} = require("../property/commercial-identity-resolver.v0.1.1.js");
test("P01 propiedad exacta", () => {
  const catalog = {A:{activo:true,unitId:"yin-01"}};
  assert.equal(resolve(catalog,{propiedadId:"A"}).propiedadId,"A");
});

test("P02 unidad única", () => {
  const catalog = {A:{activo:true,unitId:"yang-06"}};
  assert.equal(resolve(catalog,{unitId:"YANG-06"}).propiedadId,"A");
});

test("P03 unidad ambigua", () => {
  const catalog = {
    A:{activo:true,unitId:"yin-01"},
    B:{activo:true,unitId:"yin-01"}
  };
  assert.throws(()=>resolve(catalog,{unitId:"yin-01"}),/ambiguo/);
});

test("P04 propiedad inactiva", () => {
  const catalog = {A:{activo:false,unitId:"yin-01"}};
  assert.throws(()=>resolve(catalog,{propiedadId:"A"}));
});

test("P05 sin parámetros", () => {
  assert.equal(resolve({},{}),null);
});

test("P06 parámetros nulos", () => {
  assert.throws(()=>resolve({},null),TypeError);
});

test("P07 parámetros arreglo", () => {
  assert.throws(()=>resolve({},[]),TypeError);
});

test("P08 identificador vacío", () => {
  assert.throws(()=>resolve({},{propiedadId:"   "}),TypeError);
});

test("P09 identificador numérico", () => {
  assert.throws(()=>resolve({},{unitId:123}),TypeError);
});

const bridge = require("../property/unit-identity-bridge.v0.1.js");
const {getOperationalIdentity: identity} =
  require("../property/commercial-identity-resolver.v0.1.1.js");

const operationalCatalog = {
  A:{activo:true,organizationId:"org-1",propertyGroupId:"adn",unitId:"yin-01"},
  B:{activo:true,propertyGroupId:"adn",unitId:"yin-02"}
};

test("P10 identidad operativa", () => {
  const r = resolve(operationalCatalog,{propiedadId:"A"});
  assert.equal(identity(r).propiedadId,"A");
});

test("P11 correspondencia con puente", () => {
  const r = resolve(operationalCatalog,{propiedadId:"A"});
  assert.equal(
    bridge.resolveProperty(operationalCatalog,identity(r)).propiedadId,
    "A"
  );
});

test("P12 ficha heredada aislada", () => {
  const r = resolve(operationalCatalog,{propiedadId:"B"});
  assert.equal(identity(r),null);
});

test("P13 duplicado operativo rechazado", () => {
  const catalog = {
    A:operationalCatalog.A,
    C:{...operationalCatalog.A}
  };
  const r = resolve(catalog,{propiedadId:"A"});
  assert.throws(()=>bridge.resolveProperty(catalog,identity(r)));
});

test("P14 conflicto comercial", () => {
  const wrong = {
    organizationId:"org-1",
    propertyGroupId:"adn",
    unitId:"yin-01",
    propiedadId:"X"
  };
  assert.throws(() =>
    bridge.resolveProperty({A:operationalCatalog.A},wrong)
  );
});

test("P15 aislamiento por organización", () => {
  const catalog = {
    A:operationalCatalog.A,
    C:{
      activo:true,
      organizationId:"org-2",
      propertyGroupId:"adn",
      unitId:"yin-01"
    }
  };
  const r = resolve(catalog,{propiedadId:"C"});
  assert.equal(
    bridge.resolveProperty(catalog,identity(r)).propiedadId,
    "C"
  );
});

test("P16 identificador operativo estable", () => {
  const r = resolve(operationalCatalog,{propiedadId:"A"});
  assert.equal(
    bridge.createOperationalUnitId(identity(r)),
    JSON.stringify(["adn","yin-01"])
  );
});
