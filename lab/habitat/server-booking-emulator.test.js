const assert=require("node:assert/strict");
const firebase=require("firebase/compat/app");
require("firebase/compat/database");
const {bookFixture,recoverFixture}=require("./server-booking-emulator.js");

process.env.FIREBASE_DATABASE_EMULATOR_HOST="127.0.0.1:9000";
process.env.GCLOUD_PROJECT="demo-synapse-lab";

const app=firebase.initializeApp({
  projectId:"demo-synapse-lab",
  databaseURL:"https://demo-synapse-lab.firebaseio.com"
});
const db=firebase.database();
db.useEmulator("127.0.0.1",9000);

const marker="server-booking-emulator-v01";
const fixtures=[
  {requestId:"LAB-REQ-RACE-01",slotKey:"2099-12-20_12:00",unitId:"LAB-HAB-YANG-01",propiedadId:"LAB-HAB-PROP-01"},
  {requestId:"LAB-REQ-FAIL-CLAIM",slotKey:"2099-12-20_12:30",unitId:"LAB-HAB-YANG-01",propiedadId:"LAB-HAB-PROP-01"},
  {requestId:"LAB-REQ-FAIL-CITA",slotKey:"2099-12-20_13:00",unitId:"LAB-HAB-YANG-01",propiedadId:"LAB-HAB-PROP-01"}
];

async function cleanupOne(f){
  const req=(await db.ref("booking_requests/"+f.requestId).once("value")).val();
  const citaId=req?.citaId||("LAB-CITA-"+f.requestId.replace("LAB-REQ-",""));
  const slotRef=db.ref("citas_publicas/"+f.slotKey);
  const slot=(await slotRef.once("value")).val();
  if(slot?.fixtureMarker===marker)await slotRef.remove();
  const citaRef=db.ref("citas/"+citaId);
  const cita=(await citaRef.once("value")).val();
  if(cita?.fixtureMarker===marker)await citaRef.remove();
  const reqRef=db.ref("booking_requests/"+f.requestId);
  const request=(await reqRef.once("value")).val();
  if(request&&/^LAB-REQ-/.test(f.requestId))await reqRef.remove();
}

(async()=>{
  for(const f of fixtures)await cleanupOne(f);

  // 20-way race: one slot, 20 distinct request IDs.
  const slotKey="2099-12-20_12:00";
  const attempts=await Promise.all(Array.from({length:20},(_,i)=>
    bookFixture(db,{
      requestId:"LAB-REQ-RACE-"+String(i+1).padStart(2,"0"),
      slotKey,
      unitId:"LAB-HAB-YANG-01",
      propiedadId:"LAB-HAB-PROP-01"
    })
  ));
  assert.equal(attempts.filter(x=>x.ok).length,1,"exactly one booking must win");
  const winnerIndex=attempts.findIndex(x=>x.ok);
  const winnerRequest="LAB-REQ-RACE-"+String(winnerIndex+1).padStart(2,"0");
  const winnerResult=await bookFixture(db,{
    requestId:winnerRequest,slotKey,
    unitId:"LAB-HAB-YANG-01",propiedadId:"LAB-HAB-PROP-01"
  });
  assert.equal(winnerResult.replayed,true,"winner replay must be idempotent");

  // after_claim recovery
  const afterClaim=fixtures[1];
  await assert.rejects(()=>bookFixture(db,afterClaim,"after_claim"),/INJECTED_AFTER_CLAIM/);
  const rec1=await recoverFixture(db,afterClaim.requestId);
  assert.equal(rec1.recovered,true);
  assert.equal(rec1.result.ok,true);

  // after_cita recovery
  const afterCita=fixtures[2];
  await assert.rejects(()=>bookFixture(db,afterCita,"after_cita"),/INJECTED_AFTER_CITA/);
  const rec2=await recoverFixture(db,afterCita.requestId);
  assert.equal(rec2.recovered,true);
  assert.equal(rec2.result.ok,true);

  console.log("PASS: RTDB emulator 20-way race, replay, after-claim and after-cita recovery");
})()
.catch(e=>{console.error(e);process.exitCode=1;})
.finally(async()=>{
  // Clean every race fixture plus failure fixtures.
  for(let i=1;i<=20;i++){
    await cleanupOne({
      requestId:"LAB-REQ-RACE-"+String(i).padStart(2,"0"),
      slotKey:"2099-12-20_12:00",
      unitId:"LAB-HAB-YANG-01",
      propiedadId:"LAB-HAB-PROP-01"
    });
  }
  await cleanupOne(fixtures[1]);
  await cleanupOne(fixtures[2]);
  await app.delete();
});
