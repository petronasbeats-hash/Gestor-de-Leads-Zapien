const firebase = require("firebase/compat/app");
require("firebase/compat/database");
const {claimSlot, releaseOwnedClaim} = require("./habitat-slot-claim.js");

const app = firebase.initializeApp({
  projectId: "demo-synapse-lab",
  databaseURL: "https://demo-synapse-lab.firebaseio.com"
});
const db = firebase.database();
db.useEmulator("127.0.0.1", 9000);

(async()=>{
  const slotKey="2099-12-31_23:30";
  const ref=db.ref("citas_publicas/"+slotKey);
  await ref.remove();

  const base={
    db, slotKey,
    propiedadId:"LAB-HAB-PROP-01",
    unitId:"LAB-HAB-YANG-01",
    availabilityVersion:"1"
  };

  const attempts = Array.from({length:20},(_,i)=>
    claimSlot({...base,citaId:"RACE-"+String(i+1).padStart(2,"0")})
  );

  const results = await Promise.all(attempts);
  const winners = results.map((r,i)=>({r,i})).filter(x=>x.r.claimed);

  const finalSnap = await ref.once("value");
  const finalValue = finalSnap.val();

  console.log("Intentos:", results.length);
  console.log("Ganadores:", winners.length);
  console.log("Ganador:", finalValue && finalValue.citaId);

  if(winners.length !== 1){
    console.error("FAIL: se esperaban exactamente 1 ganador");
    process.exitCode=1;
  } else if(!finalValue || finalValue.citaId !== "RACE-"+String(winners[0].i+1).padStart(2,"0")){
    console.error("FAIL: el registro final no coincide con el ganador");
    process.exitCode=1;
  } else {
    console.log("PASS: el emulador permitió un único ganador real");
  }

  if(finalValue && finalValue.citaId){
    const released = await releaseOwnedClaim({db,slotKey,citaId:finalValue.citaId});
    const cleanupSnap = await ref.once("value");
    const cleanupValue = cleanupSnap.val();
    console.log("Release reportado:", released ? "true" : "false");
    console.log("Nodo tras limpieza:", cleanupValue === null ? "null" : JSON.stringify(cleanupValue));
    if(cleanupValue !== null){
      console.error("FAIL: el claim siguió presente tras rollback");
      process.exitCode=1;
    } else {
      console.log("Limpieza: OK");
    }
  }

  await app.delete();
})().catch(async e=>{
  console.error("ERROR:", e && e.stack || e);
  try{ await app.delete(); }catch{}
  process.exitCode=1;
});
