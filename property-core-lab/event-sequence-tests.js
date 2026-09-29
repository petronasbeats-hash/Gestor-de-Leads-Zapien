import {STATES} from "./state-engine.js";
import {normalizeEventSequence,rebuildStateOrdered} from "./event-sequence.js";
function assert(c,m){if(!c)throw new Error(m);}
export function runSequenceTests(){
 const events={
  z:{environment:"LAB",type:"UNIT_STATE_CHANGED",from:"HOLD",to:"OCCUPIED",sequence:2},
  a:{environment:"LAB",type:"UNIT_STATE_CHANGED",from:"AVAILABLE",to:"HOLD",sequence:1}
 };
 const ordered=normalizeEventSequence(events);
 assert(ordered[0].sequence===1 && ordered[1].sequence===2,"PC011 deterministic order");
 assert(rebuildStateOrdered(STATES.AVAILABLE,events)===STATES.OCCUPIED,"PC012 ordered replay");
 let missing=false; try{normalizeEventSequence({a:{environment:"LAB",type:"UNIT_STATE_CHANGED"}})}catch(e){missing=e.message==="EVENT_SEQUENCE_REQUIRED";}
 assert(missing,"PC013 missing sequence rejected");
 let duplicate=false; try{normalizeEventSequence({a:{environment:"LAB",sequence:1},b:{environment:"LAB",sequence:1}})}catch(e){duplicate=e.message==="DUPLICATE_EVENT_SEQUENCE";}
 assert(duplicate,"PC014 duplicate sequence rejected");
 return {PC011:true,PC012:true,PC013:true,PC014:true};
}
