(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapsePublicSlot=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  async function claim(reference,marker){
    if(!reference||typeof reference.transaction!=='function'||typeof marker?.citaId!=='string')throw Error('RESERVATION_REFERENCE_REQUIRED');
    const result=await reference.transaction(current=>current==null?marker:undefined,undefined,false);
    const value=result.snapshot.val();
    if(!result.committed&&value?.citaId!==marker.citaId)throw Error('SLOT_NOT_AVAILABLE');
    return{citaId:marker.citaId,replayed:!result.committed};
  }
  async function release(reference,citaId){return reference.transaction(current=>current?.citaId===citaId?null:undefined,undefined,false);}
  async function claimInterval(reference,keys,marker,interval,duration=30){
    let failure;
    const result=await reference.transaction(current=>{
      failure=undefined;const state={...(current||{})};
      for(const [key,v]of Object.entries(state)){if(!v||v.citaId===marker.citaId)continue;const m=key.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}):(\d{2})$/);if(!m||m[1]!==interval.date)continue;const start=Number.isFinite(v.inicioMin)?v.inicioMin:Number(m[2])*60+Number(m[3]),end=Number.isFinite(v.finMin)?v.finMin:start+duration;if(interval.start<end&&interval.end>start){failure=Error('SLOT_NOT_AVAILABLE');return undefined;}}
      for(const key of keys){if(state[key]&&state[key].citaId!==marker.citaId){failure=Error('SLOT_NOT_AVAILABLE');return undefined;}state[key]={...marker,agenda:true,inicioMin:interval.start,finMin:interval.end,claimExpiresAt:new Date(Date.now()+120000).toISOString()};}return state;
    },undefined,false);
    if(failure)throw failure;if(!result.committed)throw Error('SLOT_NOT_AVAILABLE');return{citaId:marker.citaId};
  }
  async function releaseInterval(reference,citaId){return reference.transaction(current=>{if(!current)return null;const state={...current};for(const [key,value]of Object.entries(state))if(value?.citaId===citaId)delete state[key];return state;},undefined,false);}
  return Object.freeze({claim,release,claimInterval,releaseInterval});
});
