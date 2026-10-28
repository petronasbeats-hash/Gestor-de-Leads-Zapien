'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../shared/territory-model.js'),{createTerritoryService}=require('../server/territory-service.cjs'),{database}=require('./helpers/workspace-db.cjs'),{createAttentionHttp}=require('../server/attention-http.cjs');
const principal={uid:'agent-A',organizationId:'org-A',role:'agent',propertyIds:['private-property']};
const fixture=()=>{const db=database({propiedades:{'private-property':{nombre:'Private fixture',activo:false},other:{nombre:'Other'}}});return {db,service:createTerritoryService({db,now:()=>new Date('2026-10-28T19:00:00Z')})};};
const command=(overrides={})=>({requestId:'request-1',capture:{id:'capture-A',title:'Fictional field observation',contact:{name:'PRIVATE_NAME',phone:'2380000000'},notes:'PRIVATE_NOTES'},expectedVersion:0,...overrides});
test('Territorio keeps capture, property and photograph locations independent and never invents EXIF date',()=>{
 const capture=M.normalize({id:'cap',captureLocation:{lat:18,lng:-97,source:'device',accuracyMeters:30},propertyLocation:{lat:19,lng:-98},photos:[{id:'photo',photoLocation:{lat:20,lng:-99},originalCapturedAt:'2020-01-01'}]});
 assert.equal(capture.captureLocation.lat,18);assert.equal(capture.propertyLocation.lat,19);assert.equal(capture.photos[0].photoLocation.lat,20);assert.equal(capture.photos[0].originalCapturedAt,null);
 const empty=M.normalize({id:'empty',captureLocation:{lat:18,lng:-97}});assert.equal(empty.propertyLocation,null);assert.deepEqual(empty.photos,[]);
 assert.equal(M.mapsUrl(capture.propertyLocation),'https://www.google.com/maps?q=19,-98');
});
test('Territorio validates coordinate pairs, dates, photo counts, phone and publication review',()=>{
 for(const point of [{lat:91,lng:0},{lat:1,lng:''},{lat:'x',lng:1}])assert.throws(()=>M.point(point),/INVALID_LOCATION/);
 assert.throws(()=>M.point({lat:1,lng:1,precision:'revisada'},{property:true}),/REVIEW_REQUIRED/);
 assert.throws(()=>M.normalize({id:'cap',stage:'preparada'}),/PUBLICATION_REVIEW_REQUIRED/);
 assert.throws(()=>M.normalize({id:'cap',stage:'vinculada'}),/LINK_REQUIRED/);
 assert.throws(()=>M.normalize({id:'cap',contact:{phone:'238,0000000'}}),/INVALID_PHONE/);
 assert.throws(()=>M.normalize({id:'cap',nextAction:{dueDate:'2026-02-30'}}),/INVALID_DATE/);
 assert.throws(()=>M.normalize({id:'cap',photos:[{id:'same'},{id:'same'}]}),/PHOTOS_LIMIT/);
 assert.equal(M.normalize({id:'cap',stage:'preparada',authorization:{publication:'autorizada',evidenceNote:'Fictional recorded permission'}}).stage,'preparada');
});
test('captures sync privately by organization and agent without changing public inventory or leads',async()=>{
 const {service,db}=fixture(),before=structuredClone(db.data.propiedades);await service.save(principal,command());
 const list=await service.list(principal,{});assert.equal(list.captures.length,1);assert.equal(list.privatePhotosEnabled,false);assert.equal(list.captures[0].commands,undefined);
 assert.equal((await service.list({...principal,uid:'agent-B'},{})).captures.length,0);assert.equal((await service.list({...principal,organizationId:'org-B'},{})).captures.length,0);
 assert.deepEqual(db.data.propiedades,before);assert.equal(db.data.leads,undefined);assert.equal(db.data.citas,undefined);
 await assert.rejects(service.save({...principal,role:'customer'},command()),/AGENT_REQUIRED/);
 await assert.rejects(service.save(principal,{...command(),organizationId:'forged'}),/INVALID_FIELDS/);
 assert.equal(list.captures[0].createdBy,principal.uid);assert.equal(list.captures[0].organizationId,principal.organizationId);
});
test('lost-response retries are idempotent, altered retries conflict, and concurrent edits have one winner',async()=>{
 const {service,db}=fixture();await service.save(principal,command());const replay=await service.save(principal,command());assert.equal(replay.replayed,true);
 await assert.rejects(service.save(principal,command({capture:{id:'capture-A',title:'Different'}})),/COMMAND_CONFLICT/);
 const race=await Promise.allSettled(['edit-A','edit-B'].map(requestId=>service.save(principal,command({requestId,expectedVersion:1,capture:{id:'capture-A',title:requestId}}))));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
 const saved=(await service.list(principal,{})).captures[0];assert.equal(saved.version,2);assert.equal(Object.keys(saved.history).length,2);
 db.failWhen(()=>true);await assert.rejects(service.save(principal,command({requestId:'failed',expectedVersion:2})),/DATABASE_OFFLINE/);assert.equal((await service.list(principal,{})).captures[0].version,2);
});
test('linking requires property authorization and preserves an unpublished catalog entry',async()=>{
 const {service,db}=fixture();assert.deepEqual((await service.properties(principal,{})).properties,[{id:'private-property',name:'Private fixture',published:false}]);
 await assert.rejects(service.save(principal,command({capture:{id:'capture-A',linkedPropertyId:'other'}})),/PROPERTY_FORBIDDEN/);
 await service.save(principal,command({capture:{id:'capture-A',linkedPropertyId:'private-property',stage:'vinculada'}}));assert.equal(db.data.propiedades['private-property'].activo,false);
 assert.equal(M.pending({stage:'archivada',nextAction:{description:'Old'}}),null);assert.equal(M.pending({stage:'contactar',nextAction:{description:'Call'}}).description,'Call');
});
async function http(handler,path,body,authorization='Bearer fixture'){
 const req={url:'/attention-api'+path,method:'POST',headers:{'content-type':'application/json',authorization},rawBody:Buffer.from(JSON.stringify(body))};const res={setHeader(){},end(v){this.body=JSON.parse(v)}};await handler(req,res);return res;
}
test('territory HTTP authenticates scope and rejects forged metadata and oversized bodies',async()=>{
 const {service}=fixture();let calls=0;const handler=createAttentionHttp({service:{},territoryService:service,authority:{agent:async(token,org)=>{calls++;if(!token)throw Error('AUTHENTICATION_REQUIRED');if(org!=='org-A')throw Error('ORGANIZATION_FORBIDDEN');return principal;}}});
 assert.equal((await http(handler,'/agent/territory/list',{organizationId:'org-A'},null)).statusCode,401);
 assert.equal((await http(handler,'/agent/territory/list',{organizationId:'other'})).statusCode,403);
 assert.equal((await http(handler,'/agent/territory/save',{organizationId:'org-A',...command(),createdBy:'forged'})).statusCode,400);
 assert.equal((await http(handler,'/agent/territory/save',{organizationId:'org-A',...command()})).statusCode,200);
 const before=calls;assert.equal((await http(handler,'/agent/territory/save',{notes:'x'.repeat(17000)})).statusCode,413);assert.equal(calls,before);
 assert.equal((await http(handler,'/agent/territory/unknown',{})).statusCode,404);
});
