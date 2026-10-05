const assert=require("node:assert/strict");
const {createBookingModel}=require("./server-booking-model.js");
(async()=>{
  const model=createBookingModel();
  const attempts=await Promise.all(Array.from({length:20},(_,i)=>
    model.book({requestId:"R"+i,slotKey:"2099-12-01_12:00",unitId:"YANG-01"})
  ));
  assert.equal(attempts.filter(x=>x.ok).length,1);
  assert.equal(model.citas.size,1);
  const winner=attempts.findIndex(x=>x.ok);
  const replay=await model.book({requestId:"R"+winner,slotKey:"2099-12-01_12:00",unitId:"YANG-01"});
  assert.equal(replay.replayed,true);
  assert.equal(model.citas.size,1);
  await assert.rejects(()=>model.book({requestId:"R"+winner,slotKey:"DIFFERENT",unitId:"YANG-01"}),/IDEMPOTENCY_CONFLICT/);
  const broken=createBookingModel();
  await assert.rejects(()=>broken.book({requestId:"A",slotKey:"2099-12-02_12:00",unitId:"YANG-01"},"after_claim"),/INJECTED_AFTER_CLAIM/);
  assert.equal(broken.citas.size,0);
  assert.equal((await broken.recover("A")).ok,true);
  assert.equal(broken.citas.size,1);
  assert.equal((await broken.recover("A")).reason,"NOT_PROCESSING");
  const afterCita=createBookingModel();
  await assert.rejects(()=>afterCita.book({requestId:"B",slotKey:"2099-12-03_12:00",unitId:"YANG-01"},"after_cita"),/INJECTED_AFTER_CITA/);
  assert.equal((await afterCita.recover("B")).ok,true);
  assert.equal(afterCita.citas.size,1);
  console.log("PASS: 20-way race, replay, conflict, after-claim and after-cita recovery");
})().catch(e=>{console.error(e);process.exitCode=1});
