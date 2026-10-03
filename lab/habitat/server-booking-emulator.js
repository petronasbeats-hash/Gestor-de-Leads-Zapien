/* Habitat Lab: booking protocol prototype over RTDB Emulator.
   LAB ONLY. Uses demo-synapse-lab and synthetic fixture IDs.
   Do not deploy to production. */
"use strict";

function validateLab(db){
  if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9000" &&
     process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="localhost:9000")
    throw Error("EMULATOR_REQUIRED");
  if(process.env.GCLOUD_PROJECT!=="demo-synapse-lab" &&
     process.env.GOOGLE_CLOUD_PROJECT!=="demo-synapse-lab")
    throw Error("DEMO_PROJECT_REQUIRED");
  if(!db||typeof db.ref!=="function")throw Error("DB_REQUIRED");
}

function assertFixture({requestId,slotKey,unitId}){
  if(!/^LAB-REQ-[A-Z0-9-]+$/.test(requestId))throw Error("LAB_REQUEST_ONLY");
  if(!/^2099-/.test(slotKey))throw Error("LAB_SLOT_ONLY");
  if(!/^LAB-HAB-/.test(unitId))throw Error("LAB_UNIT_ONLY");
}

async function read(db,path){
  return (await db.ref(path).once("value")).val();
}
async function emit(db,type,requestId,extra={}){
  const ref=db.ref("system_events").push();
  await ref.set({type,requestId,source:"habitat_server_booking_emulator_v01",at:Date.now(),...extra});
}

async function bookFixture(db,{requestId,slotKey,unitId,propiedadId},injectFailure){
  validateLab(db);
  assertFixture({requestId,slotKey,unitId});

  const reqPath="booking_requests/"+requestId;
  const reqRef=db.ref(reqPath);
  const fingerprint=JSON.stringify([slotKey,unitId,propiedadId||null]);
  const previous=await read(db,reqPath);
  if(!previous)await emit(db,"HABITAT_BOOKING_REQUEST_RECEIVED",requestId,{slotKey,unitId});

  if(previous){
    if(previous.fingerprint!==fingerprint)throw Error("IDEMPOTENCY_CONFLICT");
    if(previous.status==="confirmed")
      return {ok:true,citaId:previous.citaId,replayed:true};
    if(previous.status==="rejected")
      return {ok:false,reason:"SLOT_TAKEN",replayed:true};
  }

  const citaId=previous?.citaId||("LAB-CITA-"+requestId.replace("LAB-REQ-",""));
  const slotRef=db.ref("citas_publicas/"+slotKey);

  const claim=await slotRef.transaction(current=>{
    if(current===null){
      return {
        requestId,
        citaId,
        status:"processing",
        propiedadId:propiedadId||null,
        unitId,
        fixtureMarker:"server-booking-emulator-v01"
      };
    }
    if(current.requestId===requestId && current.citaId===citaId)return current;
    return;
  },undefined,false);

  if(!claim.committed){
    await emit(db,"HABITAT_BOOKING_REJECTED_SLOT_TAKEN",requestId,{slotKey});
    await emit(db,"HABITAT_SLOT_CLAIMED",requestId,{slotKey,citaId});
  await reqRef.set({
      requestId,fingerprint,slotKey,unitId,propiedadId:propiedadId||null,
      status:"rejected",updatedAt:Date.now()
    });
    return {ok:false,reason:"SLOT_TAKEN"};
  }

  await reqRef.set({
    requestId,fingerprint,slotKey,unitId,propiedadId:propiedadId||null,
    citaId,status:"processing",updatedAt:Date.now()
  });

  if(injectFailure==="after_claim")throw Error("INJECTED_AFTER_CLAIM");

  const citaRef=db.ref("citas/"+citaId);
  const existingCita=await citaRef.once("value");
  if(!existingCita.exists()){
    await citaRef.set({
      fecha:slotKey.slice(0,10),
      hora:slotKey.slice(11),
      propiedadId:propiedadId||null,
      unitId,
      intentType:"request_visit",
      requestId,
      estado:"pendiente",
      fixtureMarker:"server-booking-emulator-v01"
    });
    await emit(db,"HABITAT_CITA_CREATED",requestId,{slotKey,citaId});
  }

  if(injectFailure==="after_cita")throw Error("INJECTED_AFTER_CITA");

  const currentSlot=await read(db,"citas_publicas/"+slotKey);
  if(!currentSlot||currentSlot.requestId!==requestId||currentSlot.citaId!==citaId)
    throw Error("SLOT_OWNER_CHANGED");

  await slotRef.update({status:"confirmed"});
  await reqRef.update({status:"confirmed",updatedAt:Date.now()});
  await emit(db,"HABITAT_BOOKING_CONFIRMED",requestId,{slotKey,citaId});

  return {ok:true,citaId,replayed:false};
}

async function recoverFixture(db,requestId){
  validateLab(db);
  if(!/^LAB-REQ-[A-Z0-9-]+$/.test(requestId))throw Error("LAB_REQUEST_ONLY");
  const request=await read(db,"booking_requests/"+requestId);
  if(!request||request.status!=="processing")
    return {recovered:false,reason:"NOT_PROCESSING"};
  await emit(db,"HABITAT_BOOKING_RECOVERY_REQUIRED",requestId,{slotKey:request.slotKey});
  const result=await bookFixture(db,{
    requestId,
    slotKey:request.slotKey,
    unitId:request.unitId,
    propiedadId:request.propiedadId||null
  });
  await emit(db,"HABITAT_BOOKING_RECOVERED",requestId,{slotKey:request.slotKey,citaId:result.citaId||null});
  return {recovered:true,result};
}

module.exports={bookFixture,recoverFixture};
