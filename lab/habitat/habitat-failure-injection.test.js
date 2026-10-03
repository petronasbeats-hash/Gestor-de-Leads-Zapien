const assert=require('node:assert/strict');
const {inspect}=require('./habitat-integrity-audit.js');
const slotKey='2099-12-30_23:30';
const citaId='LAB-FAILED-WRITE-001';
const slots={[slotKey]:{citaId,status:'confirmed'}};
const citas={}; // Simulated write failure after claim success.
const report=inspect(slots,citas);
assert(report.issues.some(issue=>issue.type==='CONFIRMED_SLOT_WITHOUT_CITA'&&issue.slotKey===slotKey));
console.log('PASS: post-claim failure detected as orphan slot');
