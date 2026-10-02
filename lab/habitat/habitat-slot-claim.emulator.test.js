const firebase = require("firebase/compat/app");
require("firebase/compat/database");
const {claimSlot, finalizeClaim, releaseOwnedClaim} = require("./habitat-slot-claim.js");

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
    const beforeFinalize=(await ref.once("value")).val();
    console.log("Lectura previa a finalize:", JSON.stringify(beforeFinalize));

    let seenRoot="NOT_CALLED";
    const diagRoot=await ref.transaction(current=>{
      seenRoot=current;
      return undefined;
    });
    console.log("transaction(root) vio:", JSON.stringify(seenRoot));
    console.log("transaction(root) committed:", diagRoot.committed);

    const statusRef=ref.child("status");
    let seenStatus="NOT_CALLED";
    const diagStatus=await statusRef.transaction(current=>{
      seenStatus=current;
      return undefined;
    });
    console.log("transaction(status) vio:", JSON.stringify(seenStatus));
    console.log("transaction(status) committed:", diagStatus.committed);

    const wrong=await finalizeClaim({db,slotKey,citaId:"NOT-THE-OWNER"});
    const confirmed=await finalizeClaim({db,slotKey,citaId:finalValue.citaId});
    const after=(await ref.once("value")).val();

    console.log("Finalización ajena rechazada:", !wrong);
    console.log("Finalización propia:", confirmed);
    console.log("Estado final:", after && after.status);

    try{
      await releaseOwnedClaim({db,slotKey,citaId:finalValue.citaId});
      process.exitCode=1;
    }catch(err){
      if(err.message!=="ROLLBACK_REQUIRES_SERVER_AUTHORITY") process.exitCode=1;
      else console.log("Rollback inseguro: deshabilitado correctamente");
    }

    await ref.remove();
    console.log("Limpieza de fixture:", (await ref.once("value")).val()===null?"OK":"FAIL");

    if(wrong) process.exitCode=1;
    if(seenRoot===null || seenStatus===null){
      console.error("DIAG: transaction() no está observando el estado persistido que once() sí ve");
    }
  }

  await app.delete();
})().catch(async e=>{
  console.error("ERROR:", e && e.stack || e);
  try{ await app.delete(); }catch{}
  process.exitCode=1;
});
