import {LAB_ROOT,pathsFor} from "./rtdb-lab-adapter.js";

function assertLab(result){
 if(!result?.unit || result.unit.environment!=="LAB") throw new Error("LAB_UNIT_REQUIRED");
 if(!result?.event || result.event.environment!=="LAB") throw new Error("LAB_EVENT_REQUIRED");
}
export function buildAtomicPatch(result,eventId,sequence){
 assertLab(result);
 if(!eventId) throw new Error("EVENT_ID_REQUIRED");
 if(!Number.isInteger(sequence)||sequence<1) throw new Error("EVENT_SEQUENCE_REQUIRED");
 const p=pathsFor(result.unit.unitId);
 const event={...result.event,eventId,sequence};
 const patch={};
 patch[`${p.events}/${eventId}`]=event;
 if(result.ok){
   const {eventTrace,...snapshot}=result.unit;
   patch[p.unit]={...snapshot,lastEventId:eventId,lastSequence:sequence};
 }
 return patch;
}
export async function persistAtomicTransition(db,result,eventId,sequence){
 const patch=buildAtomicPatch(result,eventId,sequence);
 await db.ref().update(patch);
 return {ok:result.ok,eventId,sequence,paths:Object.keys(patch)};
}
