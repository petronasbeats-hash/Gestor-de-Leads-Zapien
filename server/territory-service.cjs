'use strict';
const {createHash}=require('node:crypto');
const M=require('../shared/territory-model.js');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function createTerritoryService({db,now=()=>new Date()}){
 if(!db?.ref)throw Error('DATABASE_REQUIRED');
 const scope=p=>{if(p?.role!=='agent')throw Error('AGENT_REQUIRED');return 'territorio_v1/orgs/'+M.id(p.organizationId)+'/agents/'+M.id(p.uid)+'/captures';};
 const queues=new Map();
 const serial=(key,fn)=>{const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,next);return next.finally(()=>{if(queues.get(key)===next)queues.delete(key);});};
 const fields=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('INVALID_FIELDS');};
 const visible=row=>{const{commands,...value}=row;return value;};
 async function rows(principal){return Object.values((await db.ref(scope(principal)).get()).val()||{}).filter(row=>row?.version);}
 async function mutate(principal,{requestId,captureId,expectedVersion,payload},reduce){
  const base=scope(principal);M.id(requestId);M.id(captureId);
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw Error('TERRITORY_VERSION_CONFLICT');
  return serial(base+'/'+captureId,async()=>{
   const fingerprint=hash(payload.kind==='save'?{capture:payload.capture,expectedVersion}:{payload,expectedVersion}),at=now().toISOString();let failure,receipt;
   for(let attempt=0;attempt<2;attempt++){
    const result=await db.ref(base+'/'+captureId).transaction(current=>{
     failure=null;receipt=null;
     // RTDB can call with an empty cache before loading the remote record.
     if(current===null&&expectedVersion!==0)return {schemaVersion:1};
     try{
      if(current?.version&&(current.createdBy!==principal.uid||current.organizationId!==principal.organizationId))throw Error('TERRITORY_SCOPE_FORBIDDEN');
      const prior=current?.commands?.[requestId];
      if(prior){if(prior.fingerprint!==fingerprint)throw Error('TERRITORY_COMMAND_CONFLICT');receipt={...prior.receipt,replayed:true};return current;}
      if((current?.version||0)!==expectedVersion)throw Error('TERRITORY_VERSION_CONFLICT');
      const changed=reduce(current,at),version=(current?.version||0)+1;
      receipt={id:captureId,version,privatePhotosEnabled:false,...changed.receipt};
      const commands=Object.fromEntries(Object.entries({...current?.commands,[requestId]:{fingerprint,receipt,at}}).sort((a,b)=>(a[1].at||'').localeCompare(b[1].at||'')||a[0].localeCompare(b[0])).slice(-40));
      return {...changed.capture,organizationId:principal.organizationId,createdBy:principal.uid,createdAt:current?.createdAt||at,updatedAt:at,version,commands,history:{...current?.history,[requestId]:{at,actorUid:principal.uid,...changed.event}}};
     }catch(e){failure=e;return;}
    },undefined,false);
    if(failure)throw failure;if(receipt&&result.committed)return receipt;if(!result.committed)throw Error('TERRITORY_VERSION_CONFLICT');
   }throw Error('TERRITORY_VERSION_CONFLICT');
  });
 }
 return {
  async list(principal,input){fields(input,[]);return {captures:(await rows(principal)).map(visible).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),privatePhotosEnabled:false};},
  async pending(principal,input){fields(input,[]);const items=(await rows(principal)).flatMap(row=>{const action=M.pending(row);return action?[{...action,title:row.title,version:row.version}]:[];});return {items,observedAt:now().toISOString()};},
  async properties(principal,input){fields(input,[]);scope(principal);const catalog=(await db.ref('propiedades').get()).val()||{};return {properties:Object.entries(catalog).filter(([id])=>principal.propertyIds?.includes(id)).map(([id,p])=>({id,name:p.nombre||'Inmueble',published:p.activo!==false}))};},
  async save(principal,input){
   fields(input,['requestId','capture','expectedVersion']);scope(principal);const capture=M.normalize(input.capture);
   if(capture.linkedPropertyId){if(!principal.propertyIds?.includes(capture.linkedPropertyId))throw Error('PROPERTY_FORBIDDEN');if(!(await db.ref('propiedades/'+capture.linkedPropertyId).get()).val())throw Error('PROPERTY_NOT_PUBLISHED');}
   return mutate(principal,{...input,captureId:capture.id,payload:{kind:'save',capture}},current=>{
    if(current?.nextAction?.description&&!capture.nextAction.description)throw Error('TERRITORY_ACTION_RESULT_REQUIRED');
    return {capture,event:{kind:current?.version?'capture_updated':'capture_created',previousStage:current?.stage||null,stage:capture.stage,publication:capture.authorization.publication,previousNextAction:current?.nextAction||null,nextAction:capture.nextAction}};
   });
  },
  async completeAction(principal,input){
   fields(input,['requestId','captureId','expectedVersion','resolution','result']);scope(principal);
   if(!['realizada','cancelada'].includes(input.resolution))throw Error('TERRITORY_ACTION_RESOLUTION_REQUIRED');
   const result=M.text(input.result,2000);if(!result)throw Error('TERRITORY_ACTION_RESULT_REQUIRED');
   const payload={kind:'complete-action',captureId:input.captureId,resolution:input.resolution,result};
   return mutate(principal,{...input,payload},current=>{
    if(!current?.version||!M.pending(current))throw Error('TERRITORY_ACTION_NOT_PENDING');
    return {capture:{...visible(current),nextAction:{description:'',dueDate:''}},receipt:{actionClosed:true},event:{kind:'action_closed',resolution:input.resolution,result,previousNextAction:current.nextAction,stage:current.stage}};
   });
  }
 };
}
module.exports={createTerritoryService};
