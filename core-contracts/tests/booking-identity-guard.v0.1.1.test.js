"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {resolveCommercialProperty:resolve} = require("../property/commercial-identity-resolver.v0.1.1.js");
const {revalidateBookingIdentity:check} = require("../property/booking-identity-guard.v0.1.1.js");
const A = {activo:true,organizationId:"org-1",propertyGroupId:"adn",unitId:"yin-01"};
const original = resolve({A},{propiedadId:"A"});
test("G01 identidad conservada",()=>{assert.equal(check({A},original).propiedadId,"A");});
test("G02 propiedad desactivada",()=>{assert.throws(()=>check({A:{...A,activo:false}},original));});
test("G03 cambio de unidad",()=>{assert.throws(()=>check({A:{...A,unitId:"yin-02"}},original));});
test("G04 propiedad eliminada",()=>{assert.throws(()=>check({},original));});
test("G05 duplicado operativo",()=>{assert.throws(()=>check({A,B:{...A}},original));});
test("G06 ficha heredada",()=>{const L={activo:true,nombre:"Local Centro"};const selected=resolve({L},{propiedadId:"L"});assert.equal(check({L:{...L}},selected).propiedadId,"L");});
test("G07 migración operativa",()=>{const selected=resolve({A:{activo:true,nombre:"Unidad A"}},{propiedadId:"A"});assert.throws(()=>check({A},selected),/Identidad operativa modificada/);});

test("G08 cambio de organización",()=>{assert.throws(()=>check({A:{...A,organizationId:"org-2"}},original),/Conflicto de identidad: organizationId/);});
test("G09 cambio de grupo",()=>{assert.throws(()=>check({A:{...A,propertyGroupId:"otro"}},original),/Conflicto de identidad: propertyGroupId/);});
test("G10 pérdida de unidad",()=>{const B={...A};delete B.unitId;assert.throws(()=>check({A:B},original),/Identidad operativa incompleta/);});
test("G11 identidad parcial heredada",()=>{const selected=resolve({L:{activo:true}},{propiedadId:"L"});assert.throws(()=>check({L:{activo:true,propertyGroupId:"adn",unitId:"yin-01"}},selected),/Identidad operativa incompleta/);});
