const assert=require("node:assert/strict");
const {inspectCandidate,reconcileFixture}=require("./habitat-reconciler.emulator.js");
process.env.FIREBASE_DATABASE_EMULATOR_HOST="127.0.0.1:9000";
process.env.GCLOUD_PROJECT="demo-synapse-lab";
const slotKey="2099-12-28_23:30";
const citaId="LAB-ORPHAN-RECON-001";
const fixtureMarker="habitat-reconciler-emulator-v1";
const store={
  ["citas_publicas/"+slotKey]:{citaId,status:"confirmed",fixtureMarker}
};
const db={ref(path){return {
  async once(){return {val:()=>store[path]??null};},
  async transaction(fn){
    const next=fn(store[path]??null);
    if(next===undefined)return {committed:false};
    if(next===null)delete store[path];else store[path]=next;
    return {committed:true};
  }
};}};
(async()=>{
  assert.equal((await inspectCandidate(db,slotKey,citaId)).eligible,true);
  const result=await reconcileFixture(db,{slotKey,expectedCitaId:citaId,fixtureMarker});
  assert.equal(result.released,true);
  assert.equal((await reconcileFixture(db,{slotKey,expectedCitaId:citaId,fixtureMarker})).reason,"SLOT_ABSENT");
  store["citas_publicas/"+slotKey]={citaId:"OTHER",status:"confirmed",fixtureMarker};
  assert.equal((await reconcileFixture(db,{slotKey,expectedCitaId:citaId,fixtureMarker})).reason,"OWNER_CHANGED");
  assert.equal(store["citas_publicas/"+slotKey].citaId,"OTHER");
  store["citas_publicas/"+slotKey]={citaId,status:"confirmed",fixtureMarker};
  store["citas/"+citaId]={fecha:"2099-12-28",hora:"23:30"};
  assert.equal((await reconcileFixture(db,{slotKey,expectedCitaId:citaId,fixtureMarker})).reason,"CITA_EXISTS");
  console.log("PASS: fixture release, idempotence, owner protection and cita existence");
})().catch(e=>{console.error(e);process.exitCode=1});
