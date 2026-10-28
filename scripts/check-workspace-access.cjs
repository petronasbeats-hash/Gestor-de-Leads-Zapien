'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{administrator}=require('./activate-attention-access.cjs');
function inspect(rules){const owner=administrator(rules),r=rules.rules;const normalize=value=>typeof value==='string'?value.replace(/\s/g,'').replace(/===/g,'=='):value;
  const sameOwner=value=>normalize(value)===`auth!=null&&auth.uid=='${owner}'`||normalize(value)===`auth!=null&&auth.uid=="${owner}"`;
  const yes=value=>value===true||normalize(value)==='true';
  const canWrite=value=>yes(value)||sameOwner(value)||normalize(value)==='auth!=null';
  const schemaCompatible=node=>!node||typeof node!=='object'||Object.entries(node).every(([key,v])=>key==='.validate'?canWrite(v):key.startsWith('.')?true:schemaCompatible(v));
  // Only known expressions are accepted; do not evaluate downloaded rules as JS.
  const createsWithoutAuth=value=>yes(value)||['!data.exists()','auth==null','auth==null&&!data.exists()','!data.exists()&&newData.exists()','auth==null&&!data.exists()&&newData.exists()'].includes(normalize(value));
  const checks={contacts:sameOwner(r.leads?.['.read'])&&canWrite(r.leads?.['.write']),events:sameOwner(r.citas?.['.read'])&&canWrite(r.citas?.['.write']),publicOccupancy:yes(r.citas_publicas?.['.read'])&&canWrite(r.citas_publicas?.['.write']),phoneIndex:canWrite(r.telefonos_index?.['.write'])||Object.entries(r.telefonos_index||{}).some(([key,node])=>key.startsWith('$')&&canWrite(node['.write'])),schemasCompatible:['leads','citas','citas_publicas'].every(key=>schemaCompatible(r[key])),publicBooking:createsWithoutAuth(r.citas_publicas?.['.write'])||Object.entries(r.citas_publicas||{}).some(([key,node])=>key.startsWith('$')&&createsWithoutAuth(node['.write']))};
  if(Object.values(checks).some(ok=>!ok)){const e=Error('WORKSPACE_PERMISSIONS_REQUIRE_REVIEW');e.checks=checks;throw e;}return{...checks,noRulesChanged:true};
}
function main(argv){const params={};for(let i=0;i<argv.length;i+=2){if(!['--project','--instance'].includes(argv[i])||!argv[i+1])throw Error('INVALID_ARGUMENTS');params[argv[i]]=argv[i+1];}const project=params['--project'],instance=params['--instance'];if(!/^[a-z][a-z0-9-]{4,62}$/.test(project||'')||instance!==project+'-default-rtdb')throw Error('INVALID_PROJECT_OR_INSTANCE');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'synapse-workspace-check-'));fs.chmodSync(temp,0o700);const file=path.join(temp,'rules.json'),env={...process.env};for(const name of ['FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_EMULATOR_HUB','FIREBASE_DEBUG_MODE'])delete env[name];
  try{execFileSync('firebase',['database:get','/.settings/rules','--output',file,'--project',project,'--instance',instance],{cwd:temp,env,stdio:['ignore','pipe','pipe'],timeout:90000});const result=inspect(JSON.parse(fs.readFileSync(file,'utf8')));console.log(JSON.stringify({projectId:project,...result},null,2));}finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({error:e.message,checks:e.checks||null}));process.exitCode=1;}}
module.exports={inspect};
