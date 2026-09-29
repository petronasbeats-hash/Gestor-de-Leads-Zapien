import {createLabUnit,transition,STATES} from "./state-engine.js";
import {LAB_ROOT} from "./rtdb-lab-adapter.js";
import {buildAtomicPatch,persistAtomicTransition} from "./atomic-transition.js";
function assert(c,m){if(!c)throw new Error(m);}
function fakeDb(){
 const calls=[];
 return {calls,ref(path){return {parent:{update:async patch=>calls.push({path,patch})}};}};
}
export async function runAtomicTests(){
 const u=createLabUnit();
 const accepted=transition(u,STATES.HOLD,{holdId:"LAB-H1"});
 const p=buildAtomicPatch(accepted,"EVT-001",1);
 assert(p[`${LAB_ROOT}/events/LAB-YANG-07/EVT-001`].sequence===1,"PC015 event in patch");
 assert(p[`${LAB_ROOT}/units/LAB-YANG-07`].state===STATES.HOLD,"PC015 snapshot in same patch");

 const rejected=transition(u,STATES.HOLD,{holdId:"LAB-H2"});
 const rp=buildAtomicPatch(rejected,"EVT-002",2);
 assert(rp[`${LAB_ROOT}/events/LAB-YANG-07/EVT-002`].type==="CONFLICT_DETECTED","PC016 rejection evidenced");
 assert(!rp[`${LAB_ROOT}/units/LAB-YANG-07`],"PC016 rejected transition does not write snapshot");

 const db=fakeDb(); await persistAtomicTransition(db,accepted,"EVT-003",3);
 assert(db.calls.length===1 && Object.keys(db.calls[0].patch).length===2,"PC017 one multipath update");

 let bad=false; try{buildAtomicPatch(accepted,"EVT-004",0)}catch(e){bad=e.message==="EVENT_SEQUENCE_REQUIRED";}
 assert(bad,"PC018 invalid sequence blocked before write");
 return {PC015:true,PC016:true,PC017:true,PC018:true};
}
