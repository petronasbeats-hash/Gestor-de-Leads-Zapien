import {createLabUnit,transition,STATES} from "./state-engine.js";

function assert(condition,message){ if(!condition) throw new Error(message); }

export function testPC001(){
  const u=createLabUnit();
  const path=[STATES.HOLD,STATES.OCCUPIED,STATES.VACATED,STATES.TURNOVER,STATES.MAINTENANCE,STATES.VERIFIED,STATES.READY,STATES.AVAILABLE];
  path.forEach((s,i)=>assert(transition(u,s,{holdId:"LAB-HOLD-001",tenancyId:"LAB-TEN-001"}).ok,`PC001 failed step ${i+1}`));
  assert(u.state===STATES.AVAILABLE,"PC001 final state");
  return true;
}

export function testPC002(){
  const u=createLabUnit({state:STATES.OCCUPIED,activeTenancyId:"LAB-TEN-001"});
  const r=transition(u,STATES.AVAILABLE);
  assert(!r.ok && u.state===STATES.OCCUPIED,"PC002 must reject OCCUPIED→AVAILABLE");
  return true;
}

export function testPC003(){
  const u=createLabUnit();
  assert(transition(u,STATES.HOLD,{holdId:"LAB-HOLD-001"}).ok,"PC003 first hold");
  const r=transition(u,STATES.HOLD,{holdId:"LAB-HOLD-002"});
  assert(!r.ok && u.activeHoldId==="LAB-HOLD-001","PC003 second hold must conflict");
  return true;
}

export function synapseHoldRequest(unit,{leadId,holdId}){
  if(!leadId) return {ok:false,reason:"LEAD_REQUIRED"};
  return transition(unit,STATES.HOLD,{holdId,source:"SYNAPSE_ADAPTER"});
}

export function testPC004(){
  const u=createLabUnit();
  const r=synapseHoldRequest(u,{leadId:"LAB-LEAD-001",holdId:"LAB-HOLD-SYN-001"});
  assert(r.ok && u.state===STATES.HOLD && r.event.source==="SYNAPSE_ADAPTER","PC004 adapter");
  return true;
}

export function runAll(){
  return {PC001:testPC001(),PC002:testPC002(),PC003:testPC003(),PC004:testPC004()};
}
