'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {memoryDb}=require('./helpers/attention-memory-db.cjs'),{createAttentionStore}=require('../server/attention-store.cjs'),{createAttentionService}=require('../server/attention-service.cjs'),{createAttentionHttp}=require('../server/attention-http.cjs');
const {responseStats}=require('../shared/attention-alerts.js');
async function fixture(){
 const store=createAttentionStore(memoryDb()),principal={uid:'agent',organizationId:'org',role:'agent',propertyIds:['property']};let now=new Date('2026-10-28T20:00:00Z');
 const service=createAttentionService({store,now:()=>new Date(now),invitationBaseUrl:'https://example.test',readAvailability:async()=>({observedAt:now.toISOString(),properties:{property:{nombre:'Fictional property',activo:true,precio:1}}})});
 const input={requestId:'conversation',displayName:'Fictional client',phone:'2381111111',source:'marketplace_facebook',entryChannel:'messenger',propertyId:'property'};
 await service.capture(principal,input);const invite=await service.invite(principal,{requestId:'invite',conversationId:'conversation',expectedVersion:1}),token=new URL(invite.url).hash.slice(1),secret=Buffer.alloc(32,4).toString('base64url');
 await service.openGuest({requestId:'open',token,secret});
 return {service,store,principal,token,secret,advance(ms){now=new Date(+now+ms);},incoming:id=>service.guestMessage({requestId:id,token,secret,text:'PRIVATE_MESSAGE_BODY'})};
}
test('Radar tracks unanswered messages independently from reading and resolves equal-timestamp causal replies',async()=>{
 const f=await fixture();await f.incoming('incoming');const before=await f.store.read('org');
 await f.service.inspect(f.principal,'conversation');const projected=await f.service.pending(f.principal,{});
 assert.equal(projected.items[0].actionType,'reply');assert.match(projected.items[0].description,/1 mensaje/);assert.ok(!JSON.stringify(projected).includes('PRIVATE_MESSAGE_BODY'));assert.ok(!JSON.stringify(projected).includes('2381111111'));assert.ok(!JSON.stringify(projected).includes(f.secret));assert.deepEqual(await f.store.read('org'),before);
 const current=(await f.service.inspect(f.principal,'conversation')).conversation;
 await f.service.sendMessage(f.principal,{requestId:'answer',conversationId:current.id,threadId:current.invitation.threadId,text:'Fictional answer'});
 assert.equal((await f.service.pending(f.principal,{})).items.length,0);
 await f.incoming('incoming-again');assert.equal((await f.service.pending(f.principal,{})).items[0].actionType,'reply');
});
test('unproven legacy ties stay pending and a reply in a different guest thread cannot close them',()=>{
 const at='2026-10-28T20:00:00Z',incoming={id:'a',actorRole:'guest',recordedAt:at,threadId:'thread1'};
 assert.equal(responseStats([incoming,{id:'b',actorRole:'agent',threadId:'thread1',recordedAt:at}]).count,1);
 assert.equal(responseStats([{...incoming,sequence:1},{id:'b',actorRole:'agent',threadId:'thread2',sequence:2,recordedAt:at}]).count,1);
 assert.equal(responseStats([incoming,{id:'b',actorRole:'agent',threadId:'thread1',recordedAt:'2026-10-28T20:00:01Z'}]).count,0);
});
test('external response rejects a stale incoming message and retries never resolve a newer question',async()=>{
 const f=await fixture();await f.incoming('first');await f.incoming('second');
 const base={requestId:'external',conversationId:'conversation',channel:'whatsapp',result:'Answered manually in the agreed channel.'};
 await assert.rejects(()=>f.service.recordExternalReply(f.principal,{...base,incomingId:'first'}),/VERSION_CONFLICT/);
 const reply=await f.service.recordExternalReply(f.principal,{...base,incomingId:'second'});assert.equal(reply.delivery,'not_verified');assert.equal((await f.service.pending(f.principal,{})).items.length,0);
 await f.incoming('third');const replay=await f.service.recordExternalReply(f.principal,{...base,incomingId:'second'});assert.equal(replay.replayed,true);assert.equal((await f.service.pending(f.principal,{})).items[0].actionId,'third');
 const state=await f.store.read('org');assert.equal(state.messages.conversation.third.answeredBy,undefined);assert.match(state.journal.external.summary,/no acredita envío, entrega ni lectura/);
});
test('pending projections and external closures are isolated by agent, organization and allowed property',async()=>{
 const f=await fixture();await f.incoming('incoming');
 assert.deepEqual((await f.service.pending({...f.principal,uid:'other-agent'},{})).items,[]);
 assert.deepEqual((await f.service.pending({...f.principal,organizationId:'other-org'},{})).items,[]);
 assert.deepEqual((await f.service.pending({...f.principal,propertyIds:[]},{})).items,[]);
 await assert.rejects(()=>f.service.recordExternalReply({...f.principal,uid:'other-agent'},{requestId:'bad',conversationId:'conversation',incomingId:'incoming',channel:'whatsapp',result:'Not authorized'}),/PROPERTY_FORBIDDEN/);
 await assert.rejects(()=>f.service.pending({role:'customer'},{}),/AGENT_REQUIRED/);
});
test('a guest explicitly chooses a preferred channel without changing attribution, identity or access',async()=>{
 const f=await fixture(),before=(await f.service.inspect(f.principal,'conversation')).conversation;
 await f.service.setContactPreference(null,{requestId:'channel',token:f.token,secret:f.secret,preferredChannel:'whatsapp'});
 const after=(await f.service.inspect(f.principal,'conversation')).conversation;
 assert.equal(after.context.preferredChannel,'whatsapp');for(const key of ['source','entryChannel','currentChannel','identityStatus','phone'])assert.equal(after.context[key],before.context[key]);assert.deepEqual(after.invitation,before.invitation);assert.deepEqual(after.guestAccess,before.guestAccess);assert.equal((await f.service.guestView({token:f.token,secret:f.secret})).preferredChannel,'whatsapp');
 await assert.rejects(()=>f.service.setContactPreference(null,{requestId:'wrong-secret',token:f.token,secret:Buffer.alloc(32,9).toString('base64url'),preferredChannel:'messenger'}),/GUEST_ACCESS_REQUIRED/);
 await assert.rejects(()=>f.service.setContactPreference(f.principal,{requestId:'bad-channel',conversationId:'conversation',preferredChannel:'sms'}),/CONTACT_CHANNEL_INVALID/);
 await f.service.revoke(f.principal,{requestId:'revoke',conversationId:'conversation',expectedVersion:after.version});
 await assert.rejects(()=>f.service.setContactPreference(null,{requestId:'expired-channel',token:f.token,secret:f.secret,preferredChannel:'synapse'}),/INVITATION_INVALID/);
});
test('explicit follow-ups retain their original action until a result closes the same action',async()=>{
 const f=await fixture();await f.service.summarize(f.principal,{requestId:'summary',conversationId:'conversation',summary:'Synthetic note',nextAction:{description:'Review synthetic information',dueDate:'2026-10-29',status:'pending'}});
 assert.equal((await f.service.pending(f.principal,{})).items[0].actionId,'summary');
 await assert.rejects(()=>f.service.completeAction(f.principal,{requestId:'stale',conversationId:'conversation',actionId:'conversation',result:'Wrong action'}),/VERSION_CONFLICT/);
 await f.service.completeAction(f.principal,{requestId:'complete',conversationId:'conversation',actionId:'summary',result:'Reviewed.'});assert.deepEqual((await f.service.pending(f.principal,{})).items,[]);
 await f.incoming('after-closure');assert.equal((await f.service.pending(f.principal,{})).items[0].actionType,'reply');
});
test('HTTP authorizes each pending query and channel choice; it exposes no credentials in errors',async()=>{
 const f=await fixture(),http=createAttentionHttp({service:f.service,authority:{agent:async bearer=>{if(bearer!=='Bearer valid')throw Error('AUTHENTICATION_REQUIRED');return f.principal;}}});
 async function post(url,body,authorization){const req={url,method:'POST',headers:{'content-type':'application/json',authorization},rawBody:Buffer.from(JSON.stringify(body))},res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};await http(req,res);return res;}
 assert.equal((await post('/attention-api/agent/pending',{organizationId:'org'},'Bearer missing')).statusCode,401);
 assert.equal((await post('/attention-api/agent/pending',{organizationId:'org'},'Bearer valid')).statusCode,200);
 assert.equal((await post('/attention-api/guest/channel',{requestId:'set',token:f.token,secret:f.secret,preferredChannel:'messenger'})).statusCode,200);
 assert.deepEqual((await post('/attention-api/guest/channel',{requestId:'bad',token:f.token,secret:'bad',preferredChannel:'messenger'})).body,{error:'GUEST_ACCESS_REQUIRED'});
});

test('an unpublished property does not strand an assigned agent conversation in Radar or reopen its public invitation',async()=>{
 const store=createAttentionStore(memoryDb()),principal={uid:'agent',role:'agent',organizationId:'org',propertyIds:['property']};let active=true;
 const service=createAttentionService({store,invitationBaseUrl:'https://example.test',readAvailability:async()=>({observedAt:new Date().toISOString(),properties:{property:{nombre:'Synthetic property',precio:2800,activo:active}}})});await service.capture(principal,{requestId:'conversation',propertyId:'property',displayName:'Synthetic client',source:'directa',entryChannel:'web'});const invite=await service.invite(principal,{requestId:'invite',conversationId:'conversation',expectedVersion:1});active=false;
 assert.equal((await service.pending(principal,{})).items.length,1);const view=await service.inspect(principal,'conversation');assert.equal(view.publicationActive,false);assert.equal(view.sheet.name,'Synthetic property');await assert.rejects(()=>service.inspect({...principal,propertyIds:[]},'conversation'),/PROPERTY_FORBIDDEN/);await assert.rejects(()=>service.previewInvitation(new URL(invite.url).hash.slice(1)),/PROPERTY_NOT_PUBLISHED/);
});
