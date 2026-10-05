"use strict";
// Run against the isolated HTTP server after restarting its Node process.
// Usage: node http-restart-recovery.test.js prepare
//        [stop and restart admin-booking-http-lab.js]
//        node http-restart-recovery.test.js verify
const assert = require("node:assert/strict");
const phase = process.argv[2];
if (!["prepare","verify"].includes(phase)) {
  console.error("Usage: node http-restart-recovery.test.js prepare|verify");
  process.exit(2);
}
const endpoint = "http://127.0.0.1:8787/lab/book";
const input = {
  requestId: "LAB-ADMIN-HTTP-RESTART-01",
  slotKey: "2099-12-26_12:00",
  unitId: "LAB-HAB-YANG-01"
};
async function post(payload) {
  const res = await fetch(endpoint, {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(payload)
  });
  return {status:res.status, body:await res.json()};
}
(async()=>{
  const result=await post(input);
  assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(result.body.citaId,"LAB-CITA-"+input.requestId);
  if(phase==="prepare"){
    console.log("PASS PREPARE: booking created; now restart HTTP server before VERIFY");
    return;
  }
  const conflict=await post({...input,slotKey:"2099-12-26_14:00"});
  assert.equal(conflict.status,409,JSON.stringify(conflict));
  assert.equal(conflict.body.error,"IDEMPOTENCY_CONFLICT");
  const contender=await post({
    requestId:"LAB-ADMIN-HTTP-RESTART-CONTENDER-01",
    slotKey:input.slotKey,
    unitId:input.unitId
  });
  assert.equal(contender.status,409,JSON.stringify(contender));
  assert.equal(contender.body.reason,"SLOT_TAKEN");
  console.log("PASS VERIFY: replay persists after restart, identity conflict and slot exclusion preserved");
})().catch(e=>{console.error("FAIL:",e);process.exitCode=1});
