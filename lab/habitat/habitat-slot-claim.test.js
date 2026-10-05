const assert=require("node:assert/strict");
const {claimSlot,finalizeClaim,releaseOwnedClaim}=require("./habitat-slot-claim.js");

function fakeDb(){
  const store=new Map();
  const db={ref(path){return {async transaction(fn){
    const current=store.has(path)?store.get(path):null;
    const next=fn(current && typeof current==="object"?{...current}:current);
    if(next===undefined) return {committed:false,snapshot:{val:()=>current}};
    if(next===null) store.delete(path); else store.set(path,next);
    return {committed:true,snapshot:{val:()=>next}};
  }}}};
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
  assert.equal(results.filter(x=>x.claimed).length,1);
  const winner=results[0].claimed?"A":"B";
  assert.equal(store.get("citas_publicas/"+slotKey).citaId,winner);
  assert.equal(store.get("citas_publicas/"+slotKey).status,"confirmed");
  assert.equal(await finalizeClaim({db,slotKey,citaId:winner}),true);
  assert.equal((await claimSlot({...base,citaId:"C"})).claimed,false);
  await assert.rejects(releaseOwnedClaim({db,slotKey,citaId:winner}),/ROLLBACK_REQUIRES_SERVER_AUTHORITY/);
  console.log("PASS: single atomic confirmed winner, duplicate blocked, unsafe rollback disabled");
})().catch(e=>{console.error(e);process.exitCode=1;});
