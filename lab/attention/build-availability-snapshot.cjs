'use strict';
// Review tooling only: runs the actual public-portal generator in an isolated VM.
// Does not connect to Firebase and never writes reservations.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const [sourceFile, inputsDir, outputFile] = process.argv.slice(2);
if (!sourceFile || !inputsDir || !outputFile) throw Error('SOURCE_INPUTS_OUTPUT_REQUIRED');
const source = fs.readFileSync(sourceFile, 'utf8');
const start = source.indexOf('function haversineKm(');
const end = source.indexOf('function renderSlots()', start);
if (start < 0 || end < 0) throw Error('PORTAL_GENERATOR_NOT_FOUND');
const snapshot = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
// The runner timezone can differ from the business timezone. Calendar keys must
// remain the same day used by Reservar, rather than the UTC day of local noon.
process.env.TZ = snapshot.timeZone;
const raw = file => JSON.parse(fs.readFileSync(path.join(inputsDir, file + '.json'), 'utf8'));
const sandbox = {horario: raw('horarios'), bloqueos: raw('bloqueos') || {}, ocupados: raw('ocupados') || {}, propiedades: raw('propiedades') || {}, selectedPropiedadId:null, DAY_KEYS:['dom','lun','mar','mie','jue','vie','sab'], Date};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox, {timeout:1000});
snapshot.slotsByProperty = {};
for (const propertyId of Object.keys(snapshot.propiedades)) {
  sandbox.selectedPropiedadId = propertyId;
  const days = [];
  for (let offset=1; offset<=14; offset++) {
    const date = new Date(snapshot.referenceDate + 'T12:00:00');
    date.setDate(date.getDate()+offset);
    sandbox.snapshotDate=date;
    const slots = vm.runInContext('generateSlotsForDay(snapshotDate)', sandbox, {timeout:1000});
    if (slots.length) days.push({dateKey:vm.runInContext('dateKey(snapshotDate)', sandbox, {timeout:1000}),slots:Array.from(slots)});
  }
  snapshot.slotsByProperty[propertyId]=days;
}
snapshot.portalSourceSha256 = crypto.createHash('sha256').update(source).digest('hex');
fs.writeFileSync(outputFile,JSON.stringify(snapshot,null,2)+'\n');
console.log('Read-only availability snapshot: '+Object.keys(snapshot.slotsByProperty).length+' publications; actual portal generator.');
