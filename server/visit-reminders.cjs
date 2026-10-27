'use strict';
const OFFSETS=Object.freeze([48*60,24*60,60]);
function iso(value){const date=new Date(value);if(Number.isNaN(date.getTime()))throw Error('INVALID_APPOINTMENT_TIME');return date;}
function planVisitReminders(appointment,{now=new Date(),channel='synapse_attention',automaticChannels=[]}={}){
  if(!['pendiente','confirmada'].includes(appointment.estado)||appointment.notificationsOptOut)return [];
  const start=iso(appointment.startsAt);const created=iso(appointment.createdAt);const at=iso(now);
  const revision=String(appointment.revision||1);
  return OFFSETS.map(minutes=>({minutes,due:new Date(start.getTime()-minutes*60000)}))
    .filter(item=>item.due>at&&item.due>created)
    .map(item=>({id:[appointment.organizationId,appointment.id,revision,'before',item.minutes].join('_'),appointmentId:appointment.id,revision,
      type:appointment.estado==='confirmada'?'visit_reminder':'attendance_confirmation_request',offsetMinutes:item.minutes,dueAt:item.due.toISOString(),
      conversationId:appointment.conversationId,channel,status:automaticChannels.includes(channel)?'scheduled':'manual_required',deliveryStatus:'not_sent'}));
}
function reconcileReminderPlan(previous,next){
  const wanted=new Set(next.map(job=>job.id));const existing=new Set(previous.map(job=>job.id));
  return {cancel:previous.filter(job=>['scheduled','manual_required','pending'].includes(job.status)&&!wanted.has(job.id)).map(job=>job.id),create:next.filter(job=>!existing.has(job.id))};
}
function postVisitAction(appointment){
  if(appointment.estado!=='realizada'||!appointment.completedAt)return null;
  return {type:'post_visit_interest_followup',appointmentId:appointment.id,conversationId:appointment.conversationId,folio:appointment.folio,
    availableSince:iso(appointment.completedAt).toISOString(),status:'pending',clientAction:'request_lease_preparation'};
}
module.exports={OFFSETS,planVisitReminders,reconcileReminderPlan,postVisitAction};
