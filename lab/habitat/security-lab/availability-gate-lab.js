"use strict";
// LAB ONLY. Trusted Admin read, fail closed; not an atomic inventory/booking transaction.
const {book}=require("./admin-booking-lab");
const MARKER="habitat-availability-gate-lab-v01";
function reject(code){const err=Error(code);err.code=code;throw err;}
async function bookWithAvailability(db,input){
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=="127.0.0.1:9100")reject("EMULATOR_REQUIRED");
 if(!input || !/^LAB-ADMIN-[A-Z0-9-]+$/.test(input.requestId) ||
    !/^LAB-HAB-[A-Z0-9-]+$/.test(input.unitId) ||
    !/^2099-\d\d-\d\d_\d\d:\d\d$/.test(input.slotKey))reject("INVALID_LAB_INPUT");
 const base=db.ref("lab_admin_booking");
 const request=(await base.child("requests/"+input.requestId).once("value")).val();
 const fingerprint=JSON.stringify([input.slotKey,input.unitId]);
 // A previously confirmed booking can be replayed even if the unit subsequently changes status.
 // Core transaction remains the authority for identity; never trust this pre-read to resolve conflicts.
 if(request && request.fingerprint!==fingerprint)reject("IDEMPOTENCY_CONFLICT");
 if(request && request.status==="confirmed")return book(db,input);
 const unit=(await db.ref("lab_availability_gate/units/"+input.unitId).once("value")).val();
 if(!unit || unit.marker!==MARKER)reject("UNIT_NOT_VERIFIED");
 if(unit.commercialStatus!=="available" || unit.visitsEnabled!==true)reject("UNIT_NOT_VISITABLE");
 if(!Number.isSafeInteger(unit.version)||unit.version<1)reject("INVALID_AVAILABILITY_VERSION");
 if(input.availabilityVersion!==unit.version)reject("STALE_AVAILABILITY");
 // Re-read immediately before booking, but status changes remain non-atomic with slot claim.
 const latest=(await db.ref("lab_availability_gate/units/"+input.unitId).once("value")).val();
 if(!latest || latest.marker!==MARKER || latest.version!==unit.version ||
    latest.commercialStatus!=="available" || latest.visitsEnabled!==true)reject("AVAILABILITY_CHANGED");
 return book(db,input);
}
module.exports={bookWithAvailability,MARKER};
