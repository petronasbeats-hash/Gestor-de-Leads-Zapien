#!/usr/bin/env node
// Static regression inventory for public booking. Does NOT verify deployed Firebase rules.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const booking = fs.readFileSync('reservar.html', 'utf8');
const admin = fs.readFileSync('index.html', 'utf8');
const requiredReads = [
  'disponibilidad/horarios', 'disponibilidad/bloqueos',
  'citas_publicas', 'propiedades'
];
for (const path of requiredReads) {
  assert.ok(booking.includes("db.ref('" + path + "')"), 'Public booking data dependency changed: ' + path);
}
for (const path of ['leads', 'citas']) {
  assert.ok(booking.includes("db.ref('" + path + "').push().key"),
    'Booking create flow changed; review access contract: ' + path);
}
assert.ok(booking.includes("updates['citas_publicas/'+slotFlagKey]"),
  'Slot reservation update changed; review atomicity');
assert.ok(booking.includes("updates['citas/'+citaId]"),
  'Appointment update changed; review atomicity');
assert.ok(!booking.includes('href="/manifest.webmanifest"'),
  'Public booking must not be enrolled in administrative PWA');
assert.ok(!admin.includes('sesión segura'),
  'Authentication alone must not be presented as proof of database security');
console.log('PASS: public booking access-contract static regression inventory');
console.warn('SECURITY GATE OPEN: deployed RTDB/Storage rules and REST access remain unverified.');
console.warn('SECURITY GATE OPEN: direct browser writes to leads/citas require a backend migration before release.');
