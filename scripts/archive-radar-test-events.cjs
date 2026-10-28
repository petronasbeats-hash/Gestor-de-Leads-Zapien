'use strict';
// Explicitly scoped to the seven cards identified as tests by the operator.
// No contacts, operations or unrelated events are selected by this script.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const targets=Object.freeze([
 ['Mini Departamento Serdan','2026-08-08','11:30'],['Cuarto 8 Dr Manuel Pereyra Mejia 124','2026-08-27','11:30'],['Mini Departamento Serdan','2026-08-27','17:00'],['Cuarto 8 Dr Manuel Pereyra Mejia 124','2026-08-27','17:30'],['Mini Departamento Serdan','2026-09-07','09:30'],['ADN · YANG 10 · Suite Sierra','2026-10-07','09:00'],['ADN · YANG 10 · Suite Sierra','2026-10-07','09:30']
]);
const batch='radar-tests-20261028',canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v??null))).digest('hex');
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const title=e=>e.titulo||e.propiedadNombre||e.nombre||'';
function plan(citas={},publicas={},at=new Date().toISOString()){
 const selected=targets.map(([name,date,time])=>{const found=Object.entries(citas).filter(([,e])=>e&&e.fecha===date&&e.hora===time&&norm(title(e))===norm(name));if(found.length!==1)throw Error('TEST_EVENT_MATCH_REQUIRES_REVIEW: '+name+' · '+date+' · '+time+' · coincidencias '+found.length);const[id,event]=found[0];if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('EVENT_IDENTIFIER_REQUIRES_REVIEW');if(event._agenda?.sync==='pending')throw Error('PENDING_EVENT_SYNC_REQUIRES_REVIEW');if(['realizada','cancelada','no_asistio'].includes(event.estado)&&event._synapseTest?.batch!==batch)throw Error('EVENT_ALREADY_CLOSED_REQUIRES_REVIEW');return{id,event,name,date,time};});
 const patch={},before={citas:{},citas_publicas:{}},review=[];let changed=0;
 for(const s of selected){if(s.event._synapseTest?.batch===batch)continue;changed++;before.citas[s.id]=s.event;const prefix='citas/'+s.id+'/';patch[prefix+'estado']='cancelada';patch[prefix+'version']=(s.event.version||0)+1;patch[prefix+'updatedAt']=at;patch[prefix+'_synapseTest']={batch,archived:true,reason:'El operador identificó esta cita como un registro de prueba.',archivedAt:at};patch[prefix+'historial/'+batch]={tipo:'prueba_archivada',fecha:at,estado:'cancelada',resultado:'Registro de prueba archivado; no representa una actividad realizada.'};
  for(const[k,v]of Object.entries(publicas)){if(v?.citaId===s.id){if(!k.startsWith(s.date+'_'))throw Error('TEST_EVENT_OCCUPANCY_REQUIRES_REVIEW');before.citas_publicas[k]=v;patch['citas_publicas/'+k]=null;}}
  const k=s.date+'_'+s.time;if(publicas[k]&&!publicas[k].citaId)review.push(k);
 }
 return{selected,patch,before,changed,legacyBlocksRetained:review.length};
}
function archive({projectId,instanceId,apply=false},io){
 if(projectId!=='gestor-leads-zapien'||instanceId!=='gestor-leads-zapien-default-rtdb')throw Error('EXPLICIT_SYNAPSE_PROJECT_REQUIRED');
 const citas=io.read('/citas')||{},publicas=io.read('/citas_publicas')||{},prepared=plan(citas,publicas,io.now?.()||new Date().toISOString());
 const receipt={projectId,selected:prepared.selected.map(s=>({inmueble:s.name,fecha:s.date,hora:s.time})),changes:prepared.changed,legacyBlocksRetained:prepared.legacyBlocksRetained,applied:false};
 if(!apply||!prepared.changed)return{...receipt,alreadyArchived:!prepared.changed};
 io.backup({batch,projectId,instanceId,before:prepared.before,patch:prepared.patch});
 const latest=io.read('/citas')||{},latestPublic=io.read('/citas_publicas')||{};
 for(const s of prepared.selected)if(hash(latest[s.id])!==hash(citas[s.id]))throw Error('TEST_EVENT_CHANGED_BEFORE_WRITE');
 for(const[k,v]of Object.entries(prepared.before.citas_publicas))if(hash(latestPublic[k])!==hash(v))throw Error('OCCUPANCY_CHANGED_BEFORE_WRITE');
 // Atomic, narrowly scoped multi-location PATCH. No complete event is replaced.
 io.update('/',prepared.patch);
 const after=io.read('/citas')||{};for(const s of prepared.selected)if(after[s.id]?.estado!=='cancelada'||after[s.id]?._synapseTest?.batch!==batch)throw Error('ARCHIVE_READBACK_REQUIRES_REVIEW');
 return{...receipt,applied:true};
}
function main(argv){const args={};let apply=false;for(let i=0;i<argv.length;i++){if(argv[i]==='--apply'&&!apply){apply=true;continue;}if(!['--project','--instance','--backup-dir'].includes(argv[i])||args[argv[i]]||!argv[i+1])throw Error('INVALID_ARGUMENTS');args[argv[i]]=argv[++i];}
 const projectId=args['--project'],instanceId=args['--instance'];if(apply&&!args['--backup-dir'])throw Error('NEW_BACKUP_DIRECTORY_REQUIRED');
 const directory=args['--backup-dir']&&path.resolve(args['--backup-dir']);if(directory&&fs.existsSync(directory))throw Error('BACKUP_DIRECTORY_ALREADY_EXISTS');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'synapse-test-archive-'));fs.chmodSync(temp,0o700);let sequence=0;const env={...process.env};for(const key of ['FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_EMULATOR_HUB','FIREBASE_DEBUG_MODE'])delete env[key];
 const flags=['--project',projectId,'--instance',instanceId];function cli(command){try{execFileSync('firebase',command.concat(flags),{cwd:temp,env,stdio:['ignore','pipe','pipe'],timeout:90000});}catch{throw Error('FIREBASE_ARCHIVE_OPERATION_FAILED');}}
 try{const result=archive({projectId,instanceId,apply},{read(p){const file=path.join(temp,'read-'+(++sequence)+'.json');cli(['database:get',p,'--output',file]);return JSON.parse(fs.readFileSync(file,'utf8'));},backup(value){fs.mkdirSync(directory,{mode:0o700});fs.writeFileSync(path.join(directory,'archive-backup.json'),JSON.stringify(value,null,2),{mode:0o600});},update(p,patch){const file=path.join(temp,'patch.json');fs.writeFileSync(file,JSON.stringify(patch),{mode:0o600});cli(['database:update',p,file,'--force']);}});console.log(JSON.stringify({...result,...(apply&&result.applied?{backupDirectory:directory}:{})},null,2));}finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({error:e.message}));process.exitCode=1;}}
module.exports={targets,plan,archive};
