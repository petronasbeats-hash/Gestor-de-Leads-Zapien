import {STATES} from "./state-engine.js";
import {rebuildState} from "./rtdb-lab-adapter.js";

const VALID=new Set(Object.values(STATES));

export function validateEventTrace(initialState,events){
  if(!VALID.has(initialState)) return {ok:false,reason:"INVALID_INITIAL_STATE"};
  let current=initialState, accepted=0, rejected=0;
  const ordered=Object.values(events||{});
  for(const e of ordered){
    if(!e || e.environment!=="LAB"){ rejected++; continue; }
    if(e.type!=="UNIT_STATE_CHANGED"){ continue; }
    if(e.from!==current) return {ok:false,reason:"TRACE_DISCONTINUITY",expectedFrom:current,actualFrom:e.from,event:e};
    if(!VALID.has(e.to)) return {ok:false,reason:"UNKNOWN_STATE",event:e};
    current=e.to; accepted++;
  }
  return {ok:true,state:current,accepted,rejected};
}

export function verifySnapshotAgainstTrace(snapshot,initialState,events){
  if(!snapshot || snapshot.environment!=="LAB") return {ok:false,reason:"LAB_SNAPSHOT_REQUIRED"};
  const trace=validateEventTrace(initialState,events);
  if(!trace.ok) return trace;
  const rebuilt=rebuildState(initialState,events);
  if(snapshot.state!==rebuilt) return {ok:false,reason:"SNAPSHOT_TRACE_MISMATCH",snapshotState:snapshot.state,rebuiltState:rebuilt};
  return {ok:true,state:rebuilt};
}
