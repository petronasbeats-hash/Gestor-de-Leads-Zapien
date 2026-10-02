const assert = require("node:assert/strict");
const {claimSlot, releaseOwnedClaim} = require("./habitat-slot-claim.js");

function fakeDb(){
  const store = new Map();
  const db = {ref(path){
    return {
      async transaction(update){
        // Simulates serialized RTDB transactions for deterministic contract tests.
        const current = store.has(path) ? store.get(path) : null;
        const next = update(current && typeof current==="object" ? {...current} : current);
        if(next === undefined) return {committed:false,snapshot:{val:()=>current}};
        if(next === null) store.delete(path);
        else store.set(path,next);
        return {committed:true,snapshot:{val:()=>next}};
      }
    };
  }};
  return {db,store};
}

(async()=>{
  const {db,store}=fakeDb();
  const slotKey="2026-10-03_12:00";
  const base={db,slotKey,propiedadId:"LAB-HAB-PROP-01",unitId:"LAB-HAB-YANG-01",availabilityVersion:"1"};
  const results=await Promise.all([
    claimSlot({...base,citaId:"A"}),
    claimSlot({...base,citaId:"B"})
  ]);
  assert.equal(results.filter(x=>x.claimed).length,1,"Exactly one claimant wins");
  const winner=results[0].claimed?"A":"B";
  const loser=winner==="A"?"B":"A";
  assert.equal(store.get("citas_publicas/"+slotKey).citaId,winner);
  assert.equal(await releaseOwnedClaim({db,slotKey,citaId:loser}),false,"Loser cannot release winner");
  assert.equal(await releaseOwnedClaim({db,slotKey,citaId:winner}),true,"Owner can rollback pending claim");
  assert.equal(store.get("citas_publicas/"+slotKey).status,"released");
  assert.equal((await claimSlot({...base,citaId:"C"})).claimed,true,"Slot reusable after rollback");
  store.get("citas_publicas/"+slotKey).status="confirmed";
  assert.equal(await releaseOwnedClaim({db,slotKey,citaId:"C"}),false,"Confirmed claim cannot be rolled back");
  assert.equal(store.get("citas_publicas/"+slotKey).citaId,"C");
  console.log("PASS: single winner, ownership, rollback, retry, confirmed protection");
  console.log("LIMITATION: mock tests do not verify real emulator contention or security rules.");
})().catch(e=>{console.error(e);process.exitCode=1;});
