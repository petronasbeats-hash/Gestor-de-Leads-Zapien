/* Habitat availability adapter V1 — pure functions; no Firebase access. */
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.HabitatAvailability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const BLOCKED_OCCUPANCY = new Set(['occupied','ocupada','ocupado']);
  const BLOCKED_OPERATIONAL = new Set(['maintenance','mantenimiento','out_of_service','fuera_de_servicio','preparation','preparacion']);
  const BLOCKED_COMMERCIAL = new Set(['held','apartada','apartado','unavailable','no_disponible','inactive','inactiva','ocupada','occupied']);
  function normalize(value){ return String(value == null ? '' : value).trim().toLowerCase(); }
  function assess(publication, unit){
    if(!publication || publication.activo === false)
      return {canRequestVisit:false,canRequestHold:false,reason:'PUBLICATION_INACTIVE',requiresRevalidation:true};
    // Legacy properties remain visitable; do not invent occupancy or grant holds.
    if(!publication.unitId)
      return {canRequestVisit:true,canRequestHold:false,reason:'LEGACY_VISIT_ONLY',requiresRevalidation:true};
    if(!unit || String(unit.unitId || '') !== String(publication.unitId))
      return {canRequestVisit:false,canRequestHold:false,reason:'UNIT_UNVERIFIED',requiresRevalidation:true};
    if(BLOCKED_OPERATIONAL.has(normalize(unit.operationalStatus)))
      return {canRequestVisit:false,canRequestHold:false,reason:'UNIT_NOT_OPERATIONAL',requiresRevalidation:true};
    if(BLOCKED_OCCUPANCY.has(normalize(unit.occupancyStatus)))
      return {canRequestVisit:false,canRequestHold:false,reason:'UNIT_OCCUPIED',requiresRevalidation:true};
    if(BLOCKED_COMMERCIAL.has(normalize(unit.commercialAvailability || unit.commercialStatus)))
      return {canRequestVisit:false,canRequestHold:false,reason:'UNIT_NOT_AVAILABLE',requiresRevalidation:true};
    // An unknown status is not permission to promise a hold.
    const commercial = normalize(unit.commercialAvailability || unit.commercialStatus);
    const available = commercial === 'available' || commercial === 'disponible';
    return {canRequestVisit:available,canRequestHold:false,reason:available?'VISIT_REQUEST_ALLOWED':'STATUS_UNVERIFIED',requiresRevalidation:true};
  }
  function makeIntent(input){
    const allowed = ['request_visit','request_hold','request_information','request_application'];
    if(!input || !allowed.includes(input.intentType)) throw new Error('Invalid intentType');
    if(!input.propiedadId) throw new Error('propiedadId required');
    return {
      intentType:input.intentType,
      propiedadId:String(input.propiedadId),
      unitId:input.unitId ? String(input.unitId) : null,
      availabilityVersion:input.availabilityVersion == null ? null : String(input.availabilityVersion),
      status:'draft'
    };
  }
  return Object.freeze({assess,makeIntent});
});
