// Deterministic ordering contract for Property Core LAB events.
export function normalizeEventSequence(events){
  const list=Object.entries(events||{}).map(([key,event])=>({key,...event}));
  const accepted=list.filter(e=>e && e.environment==="LAB");
  const seen=new Set();
  for(const e of accepted){
    if(!Number.isInteger(e.sequence) || e.sequence<1) throw new Error("EVENT_SEQUENCE_REQUIRED");
    if(seen.has(e.sequence)) throw new Error("DUPLICATE_EVENT_SEQUENCE");
    seen.add(e.sequence);
  }
  return accepted.sort((a,b)=>a.sequence-b.sequence || String(a.key).localeCompare(String(b.key)));
}

export function rebuildStateOrdered(initialState,events){
  return normalizeEventSequence(events)
    .filter(e=>e.type==="UNIT_STATE_CHANGED")
    .reduce((state,e)=>e.to,state);
}
