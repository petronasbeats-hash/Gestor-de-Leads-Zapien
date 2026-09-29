import {LAB_ROOT} from "./rtdb-lab-adapter.js";
import {persistAtomicTransition} from "./atomic-transition.js";

export async function preflightLiveLab(db,auth){
 if(!auth?.currentUser) throw new Error("AUTH_REQUIRED");
 const root=await db.ref(LAB_ROOT).once("value");
 return {ok:true,root:LAB_ROOT,exists:root.exists()};
}

export async function executeCanary(db,auth,result,eventId,sequence){
 await preflightLiveLab(db,auth);
 if(result?.unit?.unitId!=="LAB-YANG-07") throw new Error("CANARY_UNIT_REQUIRED");
 const write=await persistAtomicTransition(db,result,eventId,sequence);
 const [unitSnap,eventSnap]=await Promise.all([
   db.ref(`${LAB_ROOT}/units/LAB-YANG-07`).once("value"),
   db.ref(`${LAB_ROOT}/events/LAB-YANG-07/${eventId}`).once("value")
 ]);
 if(!unitSnap.exists() || !eventSnap.exists()) throw new Error("CANARY_VERIFY_FAILED");
 return {ok:true,write,unit:unitSnap.val(),event:eventSnap.val()};
}

export async function rollbackCanary(db,auth){
 await preflightLiveLab(db,auth);
 const patch={};
 patch[`${LAB_ROOT}/units/LAB-YANG-07`]=null;
 patch[`${LAB_ROOT}/events/LAB-YANG-07`]=null;
 await db.ref().update(patch);
 return {ok:true,removed:Object.keys(patch)};
}
