'use strict';
// One property intake, based only on the four screenshots supplied by the operator.
// A draft does not publish photos, assert vacancy, or authorize any lease terms.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const project = 'gestor-leads-zapien';
const instance = 'gestor-leads-zapien-default-rtdb';
const importKey = 'local-parque-hidalgo-p0064-20261028';
const baseDescription = 'Local comercial en planta alta, junto al Parque Hidalgo, con acceso independiente e iluminación natural. Cuenta con medio baño, bodega integrada e interfón con apertura remota de puerta. Servicio de agua incluido. Puede considerarse para oficinas, despacho o consultorio; el giro y su autorización deben confirmarse antes de contratar.';
const legacyDescription = baseDescription + '\n\nRenta mensual publicada: $15,000 MXN. Superficie, otros servicios, depósito, plazo, requisitos de arrendamiento e impuestos: por confirmar. Fotografías y enlace de origen pendientes. Referencia de origen: P-0064.';
const conditionsRevision = 'parque-hidalgo-condiciones-20261028-v2';
const norm = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function payload(at = new Date().toISOString()) {
  return {
    nombre: 'Local en Parque Hidalgo · Planta alta',
    direccion: 'Avenida Héroes de la Independencia 912, Guadalupe Hidalgo, C.P. 75790, Tehuacán, Puebla',
    lat: 18.465801, lng: -97.397835,
    operacion: 'Renta', precio: 15000, banos: 0.5,
    descripcion: baseDescription + '\n\nRenta mensual publicada: $15,000 MXN.\n\nCONDICIONES DE ARRENDAMIENTO\nContrato por 12 meses. Depósito no reembolsable en efectivo: al finalizar el arrendamiento se reconoce mediante un periodo adicional de ocupación; no se aplica a cuenta de las rentas mensuales. El monto del depósito, la duración y las condiciones del periodo adicional deben acordarse por escrito antes de la firma. Condiciones indicadas por el operador como las de Casa Clavel y Departamento Arcadia.\n\nSuperficie, otros servicios, requisitos documentales e impuestos: por confirmar. Fotografías y enlace de origen pendientes. Referencia de origen: P-0064.',
    activo: false,
    engineVersion: '1.0',
    inventario: {estado: 'por_confirmar', actualizadoEn: at},
    _intake: {importKey, referenciaOrigen: 'P-0064', fuente: 'Capturas y condiciones proporcionadas por el operador', creadoEn: at, conditionsRevision}
  };
}
function matching(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw Error('INVALID_PROPERTY_CATALOG');
  return Object.entries(catalog).filter(([, p]) => p && typeof p === 'object' && (
    p._intake?.importKey === importKey ||
    /parquehidalgo|localvenecia/.test(norm(p.nombre)) ||
    (norm(p.direccion).includes('heroesdelaindependencia') && /(?:^|\D)912(?:\D|$)/.test(String(p.direccion || ''))) ||
    (Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat - 18.465801) < 0.00002 && Math.abs(p.lng + 97.397835) < 0.00002)
  ));
}
function run({apply = false}, io) {
  const found = matching(io.read('/propiedades') || {});
  if (found.length > 1) throw Error('MULTIPLE_EXISTING_PROPERTIES_REQUIRE_REVIEW');
  if (found.length === 1) {
    if (found[0][1]._intake?.importKey !== importKey) throw Error('SIMILAR_PROPERTY_ALREADY_EXISTS_REVIEW_BEFORE_IMPORT');
    const [id, current] = found[0];
    const receipt = {project, alreadyRegistered: true, id, nombre: current.nombre, applied: false};
    if (current.descripcion === payload().descripcion) return {...receipt, existingRecordUnchanged: true};
    if (current.descripcion !== legacyDescription) throw Error('PROPERTY_DESCRIPTION_CHANGED_REVIEW_CONDITIONS_BEFORE_UPDATE');
    if (!apply) return {...receipt, conditionsUpdatePending: true};
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw Error('INVALID_EXISTING_PROPERTY_ID');
    if (JSON.stringify(io.read('/propiedades/' + id)) !== JSON.stringify(current)) throw Error('PROPERTY_CHANGED_BEFORE_CONDITIONS_UPDATE');
    io.update('/propiedades/' + id, {descripcion: payload().descripcion, '_intake/conditionsRevision': conditionsRevision, '_intake/previousDescription': current.descripcion});
    if (io.read('/propiedades/' + id)?.descripcion !== payload().descripcion) throw Error('WRITE_SENT_READBACK_REQUIRES_REVIEW_DO_NOT_REPEAT_BLINDLY');
    return {...receipt, applied: true, conditionsUpdated: true};
  }
  const value = payload(io.now?.());
  const receipt = {project, nombre: value.nombre, rentaMensual: value.precio, publicado: false, disponibilidad: 'Por confirmar', applied: false};
  if (!apply) return receipt;
  // Recheck just before writing. Random record IDs never target an existing property.
  // Do not run two intake processes simultaneously; this is not a cross-process lock.
  if (matching(io.read('/propiedades') || {}).length) throw Error('CATALOG_CHANGED_REVIEW_BEFORE_IMPORT');
  const id = 'PH_' + randomUUID().replace(/-/g, '');
  if (io.read('/propiedades/' + id) !== null) throw Error('NEW_PROPERTY_ID_COLLISION');
  io.update('/propiedades', {[id]: value});
  const saved = io.read('/propiedades/' + id);
  if (!saved || saved._intake?.importKey !== importKey || saved.nombre !== value.nombre || saved.precio !== 15000 || saved.banos !== 0.5 || saved.lat !== value.lat || saved.lng !== value.lng || saved.direccion !== value.direccion || saved.descripcion !== value.descripcion || saved.activo !== false || saved.inventario?.estado !== 'por_confirmar') {
    throw Error('WRITE_SENT_READBACK_REQUIRES_REVIEW_DO_NOT_REPEAT_BLINDLY');
  }
  return {...receipt, id, applied: true};
}
function main(argv) {
  if (argv.length > 1 || (argv.length && argv[0] !== '--apply')) throw Error('USE_NO_ARGUMENTS_FOR_PREVIEW_OR_APPLY');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-property-intake-'));
  fs.chmodSync(temp, 0o700);
  const env = {...process.env};
  for (const key of ['FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB', 'FIREBASE_DEBUG_MODE']) delete env[key];
  let sequence = 0;
  function cli(args) {
    try {
      execFileSync('firebase', [...args, '--project', project, '--instance', instance], {cwd: temp, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000});
    } catch { throw Error('FIREBASE_INTAKE_FAILED_CHECK_ACCESS_AND_CATALOG_BEFORE_RETRY'); }
  }
  try {
    const result = run({apply: argv[0] === '--apply'}, {
      read(node) {
        const file = path.join(temp, 'read-' + (++sequence) + '.json');
        cli(['database:get', node, '--output', file]);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      },
      update(node, value) {
        const file = path.join(temp, 'new-property.json');
        fs.writeFileSync(file, JSON.stringify(value), {mode: 0o600});
        cli(['database:update', node, file, '--force']);
      }
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { fs.rmSync(temp, {recursive: true, force: true}); }
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(JSON.stringify({error: error.message})); process.exitCode = 1; }
}
module.exports = {payload, matching, run, legacyDescription};
