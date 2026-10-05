const assert=require('node:assert/strict');
const firebase=require('firebase/compat/app');
require('firebase/compat/database');
const {claimSlot}=require('./habitat-slot-claim.js');
const {audit}=require('./habitat-integrity-audit.js');

const app=firebase.initializeApp({
  projectId:'demo-synapse-lab',
  databaseURL:'https://demo-synapse-lab.firebaseio.com'
});
const db=firebase.database();
db.useEmulator('127.0.0.1',9000);

const slotKey='2099-12-29_23:30';
const citaId='LAB-ORPHAN-TEST-001';
const slotRef=db.ref('citas_publicas/'+slotKey);
const citaRef=db.ref('citas/'+citaId);

(async()=>{
  const [slotBefore,citaBefore]=await Promise.all([
    slotRef.once('value'),
    citaRef.once('value')
  ]);

  if(slotBefore.exists()||citaBefore.exists()){
    throw new Error('FIXTURE_EXISTS_ABORT');
  }

  let created=false;
  try{
    const claim=await claimSlot({
      db,
      slotKey,
      citaId,
      propiedadId:'LAB-HAB-PROP-01',
      unitId:'LAB-HAB-YANG-01',
      availabilityVersion:'1'
    });

    assert.equal(claim.claimed,true);
    created=true;

    // Simulated failure: the cita write is intentionally skipped.
    const report=await audit(db);
    const orphan=report.issues.find(issue=>
      issue.type==='CONFIRMED_SLOT_WITHOUT_CITA' &&
      issue.slotKey===slotKey &&
      issue.citaId===citaId
    );

    assert(orphan,'orphan slot must be detected');
    console.log('PASS: emulator detected confirmed orphan slot');
  } finally {
    if(created){
      const current=(await slotRef.once('value')).val();
      if(!current||current.citaId!==citaId){
        throw new Error('CLEANUP_REFUSED_OWNER_CHANGED');
      }
      await slotRef.remove();
      console.log('Fixture cleanup: OK');
    }
  }
})()
.catch(err=>{console.error(err);process.exitCode=1;})
.finally(()=>app.delete());
