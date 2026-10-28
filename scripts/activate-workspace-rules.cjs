'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto'),{inspect,policy}=require('./check-workspace-access.cjs');
const stable=v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):Array.isArray(v)?v.map(stable):v;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const hash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function prepare(rules){
  const {sameOwner}=policy(rules),candidate=JSON.parse(JSON.stringify(rules)),node=candidate.rules.citas_publicas;
  if(!node||typeof node!=='object')throw Error('PUBLIC_OCCUPANCY_RULES_REQUIRED');
  let changed=false;
  if(!sameOwner(node['.write'])){
    if(node['.write']!==undefined&&node['.write']!==false)throw Error('EXISTING_PUBLIC_WRITE_REQUIRES_REVIEW');
    node['.write']=candidate.rules.leads['.write'];changed=true;
  }
  // Every other prerequisite must already be satisfied. No extra access grants
  // are inferred for events, phone indexes, data schemas or private roots.
  const checks=inspect(candidate);
  return{candidate,changed,checks,beforeHash:hash(rules),afterHash:hash(candidate),changes:changed?['rules.citas_publicas/.write']:[]};
}
function activate({projectId,instanceId,apply=false},io){
  if(!/^[a-z][a-z0-9-]{4,62}$/.test(projectId)||instanceId!==projectId+'-default-rtdb')throw Error('INVALID_PROJECT_OR_INSTANCE');
  const original=io.read(),plan=prepare(original);io.backup(original,plan.candidate);
  const receipt={projectId,instanceId,changes:plan.changes,administratorOnly:true,privateRulesUnchanged:true,beforeHash:plan.beforeHash,afterHash:plan.afterHash,applied:false};
  if(!apply)return receipt;
  if(!equal(io.read(),original))throw Error('RULES_CHANGED_BEFORE_DEPLOY');
  if(plan.changed)io.deploy();
  if(!equal(io.read(),plan.candidate))throw Error('RULES_READBACK_REQUIRES_REVIEW');
  return{...receipt,applied:plan.changed,alreadyConfigured:!plan.changed};
}
function main(argv){
  const args={};let apply=false;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--apply'&&!apply){apply=true;continue;}if(!['--project','--instance','--backup-dir'].includes(argv[i])||args[argv[i]]||!argv[i+1])throw Error('INVALID_ARGUMENTS');args[argv[i]]=argv[++i];}
  if(!args['--backup-dir'])throw Error('NEW_BACKUP_DIRECTORY_REQUIRED');
  const directory=path.resolve(args['--backup-dir']);if(fs.existsSync(directory))throw Error('BACKUP_DIRECTORY_ALREADY_EXISTS');
  const projectId=args['--project'],instanceId=args['--instance'];
  if(!/^[a-z][a-z0-9-]{4,62}$/.test(projectId||'')||instanceId!==projectId+'-default-rtdb')throw Error('INVALID_PROJECT_OR_INSTANCE');
  fs.mkdirSync(directory,{mode:0o700});fs.chmodSync(directory,0o700);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'synapse-workspace-rules-'));fs.chmodSync(temp,0o700);
  const env={...process.env};for(const key of ['FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_EMULATOR_HUB','FIREBASE_DEBUG_MODE'])delete env[key];
  let sequence=0;
  function cli(command){try{execFileSync('firebase',command,{cwd:temp,env,stdio:['ignore','pipe','pipe'],timeout:120000});}catch{throw Error('FIREBASE_RULES_OPERATION_FAILED');}}
  const flags=['--project',projectId,'--instance',instanceId];
  function write(name,value){fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});}
  try{
    const receipt=activate({projectId,instanceId,apply},{
      read(){const file=path.join(temp,'read-'+(++sequence)+'.json');cli(['database:get','/.settings/rules','--output',file,...flags]);return JSON.parse(fs.readFileSync(file,'utf8'));},
      backup(original,candidate){write('before.rules.json',original);write('after.rules.json',candidate);write('apply.firebase.json',{database:[{instance:instanceId,rules:'after.rules.json'}]});write('rollback.firebase.json',{database:[{instance:instanceId,rules:'before.rules.json'}]});},
      deploy(){cli(['deploy','--only','database','--config',path.join(directory,'apply.firebase.json'),'--project',projectId,'--non-interactive']);}
    });
    console.log(JSON.stringify({...receipt,backupDirectory:directory},null,2));
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{main(process.argv.slice(2));}catch(error){console.error(JSON.stringify({error:error.message,checks:error.checks||null}));process.exitCode=1;}}
module.exports={prepare,activate};
