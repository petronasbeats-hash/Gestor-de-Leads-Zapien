import {createLabUnit,transition,STATES} from "./state-engine.js";
import {validateEventTrace,verifySnapshotAgainstTrace} from "./trace-integrity.js";

function assert(c,m){if(!c)throw new Error(m);}

export function runIntegrityTests(){
 const u=createLabUnit();
 const e1=transition(u,STATES.HOLD,{holdId:"LAB-H1"}).event;
 const e2=transition(u,STATES.OCCUPIED,{tenancyId:"LAB-T1"}).event;
 let r=validateEventTrace(STATES.AVAILABLE,{a:e1,b:e2});
 assert(r.ok && r.state===STATES.OCCUPIED,"PC007 valid trace");

 const foreign={type:"UNIT_STATE_CHANGED",environment:"PROD",from:STATES.OCCUPIED,to:STATES.VACATED};
 r=validateEventTrace(STATES.AVAILABLE,{a:e1,b:e2,c:foreign});
 assert(r.ok && r.state===STATES.OCCUPIED && r.rejected===1,"PC008 foreign event ignored");

 const broken={type:"UNIT_STATE_CHANGED",environment:"LAB",from:STATES.AVAILABLE,to:STATES.READY};
 r=validateEventTrace(STATES.AVAILABLE,{a:e1,b:broken});
 assert(!r.ok && r.reason==="TRACE_DISCONTINUITY","PC009 discontinuity detected");

 const v=verifySnapshotAgainstTrace(u,STATES.AVAILABLE,{a:e1,b:e2});
 assert(v.ok,"PC010 snapshot matches trace");
 const bad={...u,state:STATES.READY};
 const mismatch=verifySnapshotAgainstTrace(bad,STATES.AVAILABLE,{a:e1,b:e2});
 assert(!mismatch.ok && mismatch.reason==="SNAPSHOT_TRACE_MISMATCH","PC010 mismatch detected");
 return {PC007:true,PC008:true,PC009:true,PC010:true};
}
