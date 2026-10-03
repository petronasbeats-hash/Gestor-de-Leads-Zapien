/* Pure in-memory laboratory model. NOT a Firebase implementation. */
"use strict";
function createBookingModel(){
  const requests=new Map(), slots=new Map(), citas=new Map(), events=[];
  let sequence=0;
  function emit(type,requestId){events.push({type,requestId});}
  async function book({requestId,slotKey,unitId},injectFailure){
    if(!requestId||!slotKey||!unitId)throw Error("INVALID_REQUEST");
    const fingerprint=JSON.stringify([slotKey,unitId]);
    const previous=requests.get(requestId);
    if(previous){
      if(previous.fingerprint!==fingerprint)throw Error("IDEMPOTENCY_CONFLICT");
      if(previous.status==="confirmed")return {ok:true,citaId:previous.citaId,replayed:true};
      if(previous.status==="rejected")return {ok:false,reason:"SLOT_TAKEN",replayed:true};
    }
    // This section is synchronous until the first await. The model emulates
    // serialized server-side claims, not actual RTDB transaction semantics.
    const owner=slots.get(slotKey);
    if(owner&&owner!==requestId){
      requests.set(requestId,{fingerprint,status:"rejected"});
      emit("HABITAT_BOOKING_REJECTED_SLOT_TAKEN",requestId);
      return {ok:false,reason:"SLOT_TAKEN"};
    }
    const citaId=previous?.citaId||"LAB-CITA-"+(++sequence);
    requests.set(requestId,{fingerprint,status:"processing",citaId,slotKey,unitId});
    slots.set(slotKey,requestId);
    emit("HABITAT_SLOT_CLAIMED",requestId);
    if(injectFailure==="after_claim")throw Error("INJECTED_AFTER_CLAIM");
    if(!citas.has(citaId)){
      citas.set(citaId,{slotKey,unitId,requestId});
      emit("HABITAT_CITA_CREATED",requestId);
    }
    if(injectFailure==="after_cita")throw Error("INJECTED_AFTER_CITA");
    requests.get(requestId).status="confirmed";
    emit("HABITAT_BOOKING_CONFIRMED",requestId);
    return {ok:true,citaId,replayed:false};
  }
  async function recover(requestId){
    const request=requests.get(requestId);
    if(!request||request.status!=="processing")return {recovered:false,reason:"NOT_PROCESSING"};
    if(slots.get(request.slotKey)!==requestId)return {recovered:false,reason:"OWNER_CHANGED"};
    return book({requestId,slotKey:request.slotKey,unitId:request.unitId});
  }
  return {book,recover,requests,slots,citas,events};
}
module.exports={createBookingModel};
