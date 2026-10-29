'use strict';
const {createHash}=require('node:crypto'),M=require('../shared/destaca-model.js');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function createDestacaService({db,now=()=>new Date()}){
 const queues=new Map();
 const path=p=>{if(p?.role!=='agent')throw Error('AGENT_REQUIRED');return 'destaca_v1/orgs/'+M.id(p.organizationId)+'/agents/'+M.id(p.uid)+'/recommendations';};
 const fields=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('INVALID_FIELDS');};
 const visible=record=>{const{commands,...row}=record;return row;};
 const serial=(key,fn)=>{const task=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,task);return task.finally(()=>{if(queues.get(key)===task)queues.delete(key);});};
 return {
  async list(principal,input){fields(input,[]);const rows=Object.values((await db.ref(path(principal)).get()).val()||{}).filter(v=>v?.version).map(visible).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return {recommendations:rows,benefitsEnabled:false,eligibilityRulesConfigured:false};},
  async pending(principal,input){fields(input,[]);const records=Object.values((await db.ref(path(principal)).get()).val()||{});return {items:records.filter(r=>r?.version&&!['concretada','no_procede','archivada'].includes(r.stage)&&r.nextAction?.description).map(r=>({recommendationId:r.id,title:(r.referred.name||r.interest||'Recomendación').slice(0,180),description:r.nextAction.description,dueDate:r.nextAction.dueDate||'',version:r.version})),observedAt:now().toISOString()};},
  async save(principal,input){fields(input,['record','requestId','expectedVersion']);const base=path(principal),record=M.normalize(input.record),requestId=M.id(input.requestId);if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw Error('DESTACA_VERSION_CONFLICT');
   if(record.propertyId){if(!principal.propertyIds?.includes(record.propertyId))throw Error('PROPERTY_FORBIDDEN');if(!(await db.ref('propiedades/'+record.propertyId).get()).val())throw Error('PROPERTY_NOT_PUBLISHED');}
   return serial(base+'/'+record.id,async()=>{
    const at=now().toISOString(),fingerprint=hash({record,expectedVersion:input.expectedVersion});let failure,receipt;
    for(let attempt=0;attempt<2;attempt++){
     const result=await db.ref(base+'/'+record.id).transaction(current=>{
      failure=null;receipt=null;if(current===null&&input.expectedVersion!==0)return {schemaVersion:1};
      if(current?.version&&(current.createdBy!==principal.uid||current.organizationId!==principal.organizationId)){failure=Error('DESTACA_SCOPE_FORBIDDEN');return;}
      const prior=current?.commands?.[requestId];if(prior){if(prior.fingerprint!==fingerprint){failure=Error('DESTACA_COMMAND_CONFLICT');return;}receipt={...prior.receipt,replayed:true};return current;}
      if((current?.version||0)!==input.expectedVersion){failure=Error('DESTACA_VERSION_CONFLICT');return;}
      const version=(current?.version||0)+1;receipt={id:record.id,version,benefitsEnabled:false};
      const origin=current?.origin||{recommender:record.recommender,source:record.source,recordedAt:at,recordedBy:principal.uid};
      const event={at,actorUid:principal.uid,kind:current?.version?'recommendation_updated':'recommendation_recorded',stage:record.stage,previousStage:current?.stage||null,resultNote:record.resultNote,previousNextAction:current?.nextAction||null,nextAction:record.nextAction};
      const commands=Object.fromEntries(Object.entries({...current?.commands,[requestId]:{fingerprint,receipt,at}}).sort((a,b)=>(a[1].at||'').localeCompare(b[1].at||'')||a[0].localeCompare(b[0])).slice(-40));
      return {...record,origin,version,createdBy:principal.uid,organizationId:principal.organizationId,createdAt:current?.createdAt||at,updatedAt:at,commands,history:{...current?.history,[requestId]:event}};
     },undefined,false);
     if(failure)throw failure;if(result.committed&&receipt)return receipt;if(!result.committed)throw Error('DESTACA_VERSION_CONFLICT');
    }throw Error('DESTACA_VERSION_CONFLICT');
   });
  }
 };
}
module.exports={createDestacaService};
