export const STATES = Object.freeze({
  AVAILABLE:"AVAILABLE", HOLD:"HOLD", OCCUPIED:"OCCUPIED", VACATED:"VACATED",
  TURNOVER:"TURNOVER", MAINTENANCE:"MAINTENANCE", VERIFIED:"VERIFIED", READY:"READY"
});

const ALLOWED = Object.freeze({
  AVAILABLE:["HOLD"],
  HOLD:["OCCUPIED","AVAILABLE"],
  OCCUPIED:["VACATED"],
  VACATED:["TURNOVER"],
  TURNOVER:["MAINTENANCE"],
  MAINTENANCE:["VERIFIED"],
  VERIFIED:["READY"],
  READY:["AVAILABLE"]
});

export function createLabUnit(overrides={}) {
  return {
    environment:"LAB", propertyId:"LAB-ADN-001", buildingId:"LAB-YANG",
    unitId:"LAB-YANG-07", commercialName:"Suite Helix Test",
    state:STATES.AVAILABLE, activeHoldId:null, activeTenancyId:null, eventTrace:[], ...overrides
  };
}

export function transition(unit,to,context={}) {
  const from=unit.state;

  // A competing HOLD is a business conflict, not a generic invalid transition.
  if (to===STATES.HOLD && unit.activeHoldId) {
    const conflict={type:"CONFLICT_DETECTED",unitId:unit.unitId,from,to,
      reason:"ACTIVE_HOLD",activeHoldId:unit.activeHoldId,requestedHoldId:context.holdId || null,environment:"LAB"};
    unit.eventTrace.push(conflict);
    return {ok:false,event:conflict,unit};
  }

  const allowed=ALLOWED[from] || [];
  if (!allowed.includes(to)) {
    const rejected={type:"INVALID_TRANSITION_ATTEMPT",unitId:unit.unitId,from,to,
      reason:context.reason || (unit.activeTenancyId ? "ACTIVE_TENANCY" : "TRANSITION_NOT_ALLOWED"),
      environment:"LAB"};
    unit.eventTrace.push(rejected);
    return {ok:false,event:rejected,unit};
  }

  unit.state=to;
  if (to===STATES.HOLD) unit.activeHoldId=context.holdId || "LAB-HOLD-001";
  if (from===STATES.HOLD && to!==STATES.HOLD) unit.activeHoldId=null;
  if (to===STATES.OCCUPIED) unit.activeTenancyId=context.tenancyId || "LAB-TEN-001";
  if (to===STATES.VACATED) unit.activeTenancyId=null;

  const event={type:"UNIT_STATE_CHANGED",unitId:unit.unitId,from,to,
    source:context.source || "LAB_TEST",environment:"LAB"};
  unit.eventTrace.push(event);
  return {ok:true,event,unit};
}
