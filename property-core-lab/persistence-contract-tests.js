import {createLabUnit,transition,STATES} from "./state-engine.js";
import {LAB_ROOT,pathsFor,persistTransition,rebuildState} from "./rtdb-lab-adapter.js";

function assert(c,m){if(!c)throw new Error(m);}
function fakeDb(){
  const store={}; let seq=0;
  return {store,ref(path){return {
    set:async value=>{store[path]=value;},
    push:()=>({key:`EVT-${++seq}`})
  };}};
}

export async function runPersistenceContract(){
  const db=fakeDb(), u=createLabUnit();
  const hold=transition(u,STATES.HOLD,{holdId:"LAB-HOLD-001"});
  await persistTransition(db,hold,"EVT-001");
  assert(db.store[`${LAB_ROOT}/units/LAB-YANG-07`].state===STATES.HOLD,"snapshot persisted");
  assert(db.store[`${LAB_ROOT}/events/LAB-YANG-07/EVT-001`].type==="UNIT_STATE_CHANGED","event appended");

  const rejected=transition(u,STATES.HOLD,{holdId:"LAB-HOLD-002"});
  await persistTransition(db,rejected,"EVT-002");
  assert(db.store[`${LAB_ROOT}/events/LAB-YANG-07/EVT-002`].type==="CONFLICT_DETECTED","conflict evidenced");
  assert(db.store[`${LAB_ROOT}/units/LAB-YANG-07`].activeHoldId==="LAB-HOLD-001","rejection did not overwrite snapshot");

  const rebuilt=rebuildState(STATES.AVAILABLE,{
    a:db.store[`${LAB_ROOT}/events/LAB-YANG-07/EVT-001`],
    b:db.store[`${LAB_ROOT}/events/LAB-YANG-07/EVT-002`]
  });
  assert(rebuilt===STATES.HOLD,"state rebuild from valid events");
  assert(pathsFor("LAB-YANG-07").unit.startsWith("property_core_lab_v01/"),"isolated root");
  return {PC005:true,PC006:true,root:LAB_ROOT,rebuilt};
}
