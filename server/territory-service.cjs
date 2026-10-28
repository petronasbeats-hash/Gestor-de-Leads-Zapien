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
 return {
  async list(principal,input){fields(input,[]);const rows=(await db.ref(scope(principal)).get()).val()||{};return {captures:Object.values(rows).filter(row=>row?.version).map(visible).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),privatePhotosEnabled:false};},
  async properties(principal,input){fields(input,[]);scope(principal);const catalog=(await db.ref('propiedades').get()).val()||{};return {properties:Object.entries(catalog).filter(([id])=>principal.propertyIds?.includes(id)).map(([id,p])=>({id,name:p.nombre||'Inmueble',published:p.activo!==false}))};},
  async save(principal,input){
   fields(input,['requestId','capture','expectedVersion']);const base=scope(principal),requestId=M.id(input.requestId),capture=M.normalize(input.capture);
   if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw Error('TERRITORY_VERSION_CONFLICT');
   if(capture.linkedPropertyId){if(!principal.propertyIds?.includes(capture.linkedPropertyId))throw Error('PROPERTY_FORBIDDEN');if(!(await db.ref('propiedades/'+capture.linkedPropertyId).get()).val())throw Error('PROPERTY_NOT_PUBLISHED');}
   return serial(base+'/'+capture.id,async()=>{
   const fingerprint=hash({capture,expectedVersion:input.expectedVersion}),at=now().toISOString();let failure,receipt;
   for(let attempt=0;attempt<2;attempt++){
   const result=await db.ref(base+'/'+capture.id).transaction(current=>{
    failure=null;receipt=null;
    if(current===null&&input.expectedVersion!==0)return {schemaVersion:1};
    if(current?.version&&(current.createdBy!==principal.uid||current.organizationId!==principal.organizationId)){failure=Error('TERRITORY_SCOPE_FORBIDDEN');return;}
    const prior=current?.commands?.[requestId];
    if(prior){if(prior.fingerprint!==fingerprint){failure=Error('TERRITORY_COMMAND_CONFLICT');return;}receipt={...prior.receipt,replayed:true};return current;}
    if((current?.version||0)!==input.expectedVersion){failure=Error('TERRITORY_VERSION_CONFLICT');return;}
    const version=(current?.version||0)+1;receipt={id:capture.id,version,privatePhotosEnabled:false};
    const commands=Object.fromEntries(Object.entries({...current?.commands,[requestId]:{fingerprint,receipt}}).slice(-40));
    return {...capture,organizationId:principal.organizationId,createdBy:principal.uid,createdAt:current?.createdAt||at,updatedAt:at,version,commands,history:{...current?.history,[requestId]:{at,actorUid:principal.uid,kind:current?'capture_updated':'capture_created',previousStage:current?.stage||null,stage:capture.stage,publication:capture.authorization.publication}}};
   },undefined,false);
   if(failure)throw failure;if(receipt&&result.committed)return receipt;if(!result.committed)throw Error('TERRITORY_VERSION_CONFLICT');
   }throw Error('TERRITORY_VERSION_CONFLICT');
   });
  }
 };
}
module.exports={createTerritoryService};
