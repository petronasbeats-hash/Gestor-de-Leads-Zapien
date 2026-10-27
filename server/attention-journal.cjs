'use strict';
const {createHash}=require('node:crypto');
const TIME_ZONE='America/Mexico_City';
function businessDate(value){
  const date=new Date(value);if(Number.isNaN(date.getTime()))throw Error('INVALID_DATE');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');
}
const text=(value,max=1000)=>String(value||'').trim().slice(0,max);
const identifier=value=>{const id=text(value,160);if(!/^[a-zA-Z0-9_-]{1,160}$/.test(id))throw Error('INVALID_IDENTIFIER');return id;};
function prepareEntry(input,authority,now=new Date()){
  if(!authority?.agentUid||!authority.organizationId)throw Error('AUTHORIZED_AGENT_REQUIRED');
  if(!text(input.summary))throw Error('SUMMARY_REQUIRED');
  const occurredAt=input.occurredAt?new Date(input.occurredAt).toISOString():null;
  const recordedAt=now.toISOString();
  const entry={
    id:identifier(input.id),organizationId:identifier(authority.organizationId),agentUid:identifier(authority.agentUid),
    conversationId:identifier(input.conversationId),interactionId:identifier(input.interactionId),
    kind:text(input.kind||'interaction_summary',80),summary:text(input.summary),
    source:text(input.source,100),entryChannel:text(input.entryChannel,80),currentChannel:text(input.currentChannel,80),
    propertyId:input.propertyId?identifier(input.propertyId):null,folio:text(input.folio,120)||null,
    facts:(input.facts||[]).slice(0,30).map(value=>text(value,400)),
    openQuestions:(input.openQuestions||[]).slice(0,20).map(value=>text(value,300)),
    topics:(input.topics||[]).slice(0,20).map(value=>text(value,80)),
    nextAction:input.nextAction?{description:text(input.nextAction.description,400),dueDate:text(input.nextAction.dueDate,10)||null,status:input.nextAction.status==='done'?'done':'pending'}:null,
    occurredAt,recordedAt,businessDate:businessDate(occurredAt||recordedAt),dateBasis:occurredAt?'occurred':'recorded',
    schemaVersion:1
  };
  const {recordedAt:ignored,...identity}=entry;
  // Imported interactions retain their first recording date on a retry.
  if(!occurredAt)delete identity.businessDate;
  entry.fingerprint=createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return Object.freeze(entry);
}
function createRtdbJournal({db,organizationId}){
  const organization=identifier(organizationId);
  return {
    async append(entry){
      if(entry.organizationId!==organization)throw Error('ORGANIZATION_SCOPE_MISMATCH');
      const reference=db.ref('atencion_v1/orgs/'+organization+'/journal/'+identifier(entry.id));
      const result=await reference.transaction(current=>{
        if(current===null)return entry;
        if(current.fingerprint===entry.fingerprint)return current;
        return undefined;
      },undefined,false);
      if(!result.committed)throw Error('JOURNAL_EVENT_CONFLICT');
      return result.snapshot.val();
    }
  };
}
function dailyReport(entries,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('INVALID_DAY');
  const day=entries.filter(entry=>entry.businessDate===date);
  const latest=new Map();
  for(const entry of entries.filter(entry=>entry.businessDate<=date&&entry.nextAction).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)))latest.set(entry.conversationId,entry);
  const pending=[...latest.values()].filter(entry=>entry.nextAction?.status==='pending'&&(!entry.nextAction.dueDate||entry.nextAction.dueDate<=date)).map(entry=>({conversationId:entry.conversationId,folio:entry.folio,source:entry.source,action:entry.nextAction.description,openQuestions:entry.openQuestions}));
  const topicEvidence=new Map();
  for(const entry of day)for(const topic of entry.topics){if(!topicEvidence.has(topic))topicEvidence.set(topic,new Map());topicEvidence.get(topic).set(entry.conversationId,entry.id);}
  const recurring=[...topicEvidence.entries()].filter(([,sessions])=>sessions.size>=2).map(([topic,sessions])=>({topic,conversations:sessions.size,evidence:[...sessions.values()]}));
  return {date,timeZone:TIME_ZONE,summaries:day.length,interactions:new Set(day.map(entry=>entry.interactionId)).size,importedWithUnknownDate:day.filter(entry=>entry.dateBasis==='recorded').length,
    reservations:[...new Set(day.filter(entry=>entry.kind==='reservation_registered'&&entry.folio).map(entry=>entry.folio))],
    pending,recurring,improvementProposals:recurring.map(item=>({status:'for_review',proposal:'Revisar la información y la respuesta frecuente de «'+item.topic+'».',evidence:item.evidence}))};
}
module.exports={prepareEntry,createRtdbJournal,dailyReport,businessDate,TIME_ZONE};
