'use strict';
const PATHS=Object.freeze({horario:'disponibilidad/horarios',bloqueos:'disponibilidad/bloqueos',ocupados:'citas_publicas',propiedades:'propiedades'});
// Inject server-side readValue(path), implemented with Admin SDK ref(path).get().
// No fixture/cached fallback. Invoke for every attention and again on booking.
function createLiveAvailabilityReader({readValue,now=()=>new Date()}){
  if(typeof readValue!=='function')throw Error('LIVE_READER_REQUIRED');
  return async function readLiveAvailability(){
    const entries=await Promise.all(Object.entries(PATHS).map(async([key,path])=>[key,await readValue(path)]));
    const state=Object.fromEntries(entries);
    if(!state.horario||!state.propiedades)throw Error('LIVE_AVAILABILITY_UNAVAILABLE');
    return {...state,bloqueos:state.bloqueos||{},ocupados:state.ocupados||{},observedAt:now().toISOString(),mode:'live',timeZone:'America/Mexico_City'};
  };
}
module.exports={createLiveAvailabilityReader,PATHS};
