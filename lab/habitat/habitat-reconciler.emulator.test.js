const assert=require("node:assert/strict");
const firebase=require("firebase/compat/app");
require("firebase/compat/database");
const {reconcileFixture}=require("./habitat-reconciler.emulator.js");

process.env.FIREBASE_DATABASE_EMULATOR_HOST="127.0.0.1:9000";
process.env.GCLOUD_PROJECT="demo-synapse-lab";

const app=firebase.initializeApp({
  projectId:"demo-synapse-lab",
  databaseURL:"https://demo-synapse-lab.firebaseio.com"
});
const db=firebase.database();
db.useEmulator("127.0.0.1",9000);

const fixtureMarker="habitat-reconciler-emulator-v1";
const cases=[
  {slotKey:"2099-12-27_23:00",citaId:"LAB-ORPHAN-RECON-EMULATOR-001"},
  {slotKey:"2099-12-27_23:30",citaId:"LAB-ORPHAN-RECON-EMULATOR-002"}
];

async function putSlot(c){
  const ref=db.ref("citas_publicas/"+c.slotKey);
  const before=await ref.once("value");
  if(before.exists())throw Error("FIXTURE_SLOT_EXISTS:"+c.slotKey);
  const citaBefore=await db.ref("citas/"+c.citaId).once("value");
  if(citaBefore.exists())throw Error("FIXTURE_CITA_EXISTS:"+c.citaId);
  await ref.set({citaId:c.citaId,status:"confirmed",fixtureMarker});
}

async function cleanup(c){
  const slotRef=db.ref("citas_publicas/"+c.slotKey);
  const slot=(await slotRef.once("value")).val();
  if(slot&&slot.citaId===c.citaId&&slot.fixtureMarker===fixtureMarker)await slotRef.remove();
  const citaRef=db.ref("citas/"+c.citaId);
  const cita=await citaRef.once("value");
  if(cita.exists())await citaRef.remove();
}

(async()=>{
  for(const c of cases)await cleanup(c);

  const first=cases[0];
  await putSlot(first);
  const released=await reconcileFixture(db,{
    slotKey:first.slotKey,expectedCitaId:first.citaId,fixtureMarker
  });
  assert.deepEqual(released,{released:true,reason:"FIXTURE_RELEASED"});
  assert.equal((await db.ref("citas_publicas/"+first.slotKey).once("value")).exists(),false);

  const again=await reconcileFixture(db,{
    slotKey:first.slotKey,expectedCitaId:first.citaId,fixtureMarker
  });
  assert.deepEqual(again,{released:false,reason:"SLOT_ABSENT"});

  const second=cases[1];
  await putSlot(second);
  await db.ref("citas/"+second.citaId).set({fecha:"2099-12-27",hora:"23:30"});
  const protectedResult=await reconcileFixture(db,{
    slotKey:second.slotKey,expectedCitaId:second.citaId,fixtureMarker
  });
  assert.deepEqual(protectedResult,{released:false,reason:"CITA_EXISTS"});
  assert.equal((await db.ref("citas_publicas/"+second.slotKey).once("value")).exists(),true);

  console.log("PASS: emulator release, idempotence and cita protection");
})()
.catch(e=>{console.error(e);process.exitCode=1;})
.finally(async()=>{
  for(const c of cases){
    try{await cleanup(c);}catch(e){console.error("cleanup:",e.message);process.exitCode=1;}
  }
  await app.delete();
});
