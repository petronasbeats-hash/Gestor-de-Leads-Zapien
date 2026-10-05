const firebase=require("firebase/compat/app");
require("firebase/compat/database");
const {claimSlot,finalizeClaim,releaseOwnedClaim}=require("./habitat-slot-claim.js");

const app=firebase.initializeApp({
  projectId:"demo-synapse-lab",
  databaseURL:"https://demo-synapse-lab.firebaseio.com"
});
const db=firebase.database();
db.useEmulator("127.0.0.1",9000);

(async()=>{
  const slotKey="2099-12-31_23:30";
  const ref=db.ref("citas_publicas/"+slotKey);
  await ref.remove();

  const base={
    db,slotKey,
    propiedadId:"LAB-HAB-PROP-01",
    unitId:"LAB-HAB-YANG-01",
    availabilityVersion:"1"
  };

  const attempts=Array.from({length:20},(_,i)=>
    claimSlot({...base,citaId:"RACE-"+String(i+1).padStart(2,"0")})
  );
  const results=await Promise.all(attempts);
  const winners=results.map((r,i)=>({r,i})).filter(x=>x.r.claimed);
  const finalValue=(await ref.once("value")).val();

  console.log("Intentos:",results.length);
  console.log("Ganadores:",winners.length);
  console.log("Ganador:",finalValue&&finalValue.citaId);
  console.log("Estado:",finalValue&&finalValue.status);

  if(winners.length!==1){
    console.error("FAIL: se esperaban exactamente 1 ganador");
    process.exitCode=1;
  }else if(!finalValue || finalValue.citaId!=="RACE-"+String(winners[0].i+1).padStart(2,"0")){
    console.error("FAIL: el registro final no coincide con el ganador");
    process.exitCode=1;
  }else if(finalValue.status!=="confirmed"){
    console.error("FAIL: el claim ganador no quedó confirmado en la misma transacción");
    process.exitCode=1;
  }else{
    console.log("PASS: un único ganador quedó confirmado atómicamente");
  }

  const finalization=await finalizeClaim({db,slotKey,citaId:finalValue&&finalValue.citaId});
  console.log("Finalización adicional necesaria:", !finalization);

  try{
    await releaseOwnedClaim({db,slotKey,citaId:finalValue&&finalValue.citaId});
    console.error("FAIL: rollback cliente no debería estar habilitado");
    process.exitCode=1;
  }catch(err){
    if(err.message==="ROLLBACK_REQUIRES_SERVER_AUTHORITY")
      console.log("Rollback cliente: deshabilitado correctamente");
    else{
      console.error("FAIL:",err.message);
      process.exitCode=1;
    }
  }

  await ref.remove();
  console.log("Limpieza de fixture:",(await ref.once("value")).val()===null?"OK":"FAIL");
  await app.delete();
})().catch(async e=>{
  console.error("ERROR:",e&&e.stack||e);
  try{await app.delete();}catch{}
  process.exitCode=1;
});
