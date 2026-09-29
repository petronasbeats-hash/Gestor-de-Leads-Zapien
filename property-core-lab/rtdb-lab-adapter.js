// Property Core V0.1 — RTDB LAB persistence adapter.
// Contract-only: this module does not initialize Firebase and never points at production paths.

export const LAB_ROOT = "property_core_lab_v01";

function assertLabUnit(unit){
  if(!unit || unit.environment!=="LAB") throw new Error("LAB_ENVIRONMENT_REQUIRED");
  if(!String(unit.unitId||"").startsWith("LAB-")) throw new Error("LAB_UNIT_ID_REQUIRED");
}

export function pathsFor(unitId){
  if(!String(unitId||"").startsWith("LAB-")) throw new Error("LAB_UNIT_ID_REQUIRED");
  return {
    unit:`${LAB_ROOT}/units/${unitId}`,
    events:`${LAB_ROOT}/events/${unitId}`
  };
}

// db contract: Firebase Realtime Database compat instance exposing ref(path).
export async function persistSnapshot(db,unit){
  assertLabUnit(unit);
  const {unit:path}=pathsFor(unit.unitId);
  const snapshot={...unit,eventTrace:undefined};
  await db.ref(path).set(snapshot);
  return path;
}

export async function appendEvent(db,unit,event,eventId){
  assertLabUnit(unit);
  if(!event || event.environment!=="LAB") throw new Error("LAB_EVENT_REQUIRED");
  const {events}=pathsFor(unit.unitId);
  const key=eventId || db.ref(events).push().key;
  await db.ref(`${events}/${key}`).set({...event,eventId:key});
  return key;
}

export async function persistTransition(db,result,eventId){
  if(!result || !result.unit || !result.event) throw new Error("TRANSITION_RESULT_REQUIRED");
  await appendEvent(db,result.unit,result.event,eventId);
  if(result.ok) await persistSnapshot(db,result.unit);
  return result;
}

export function rebuildState(initialState,events){
  return Object.values(events||{})
    .filter(e=>e && e.environment==="LAB" && e.type==="UNIT_STATE_CHANGED")
    .reduce((state,e)=>e.to,state);
}
