const assert=require("node:assert/strict");
const {claimSlot,finalizeClaim,releaseOwnedClaim}=require("./habitat-slot-claim.js");

function fakeDb(){
  const store=new Map();
  const db={
    ref(path){
      return {
        async transaction(fn){
          const current=store.has(path)?store.get(path):null;
          const input=current && typeof current==="object"?{...current}:current;
          const next=fn(input);
          if(next===undefined){
            return {committed:false,snapshot:{val:()=>current}};
          }
          if(next===null) store.delete(path);
          else store.set(path,next);
          return {committed:true,snapshot:{val:()=>next}};
        }
      };
    }
  };
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
  const loser=winner==="A"?"B":"A";

  assert.equal(await finalizeClaim({db,slotKey,citaId:loser}),false);
  assert.equal(await finalizeClaim({db,slotKey,citaId:winner}),true);
  assert.equal(store.get("citas_publicas/"+slotKey).status,"confirmed");
  assert.equal((await claimSlot({...base,citaId:"C"})).claimed,false);

  await assert.rejects(
    releaseOwnedClaim({db,slotKey,citaId:winner}),
    /ROLLBACK_REQUIRES_SERVER_AUTHORITY/
  );

  console.log("PASS: single winner, owner-only finalization, confirmed slot blocked, unsafe rollback disabled");
})().catch(e=>{console.error(e);process.exitCode=1;});
