'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{administrator}=require('./activate-attention-access.cjs');
function policy(rules){
  const owner=administrator(rules);
  const normalize=value=>typeof value==='string'?value.replace(/\s/g,'').replace(/===/g,'=='):value;
  function strip(value){if(typeof value!=='string')return value;let s=value;while(s[0]==='('&&s.at(-1)===')'){let depth=0,outer=true;for(let i=0;i<s.length-1;i++){if(s[i]==='(')depth++;else if(s[i]===')')depth--;if(depth===0){outer=false;break;}}if(!outer)break;s=s.slice(1,-1);}return s;}
  const sameOwner=value=>{const s=strip(normalize(value));return s===`auth!=null&&auth.uid=='${owner}'`||s===`auth!=null&&auth.uid=="${owner}"`;};
  const yes=value=>value===true||strip(normalize(value))==='true';
  function ownerOrNew(value){const s=strip(normalize(value));if(typeof s!=='string')return false;let depth=0,split=-1;for(let i=0;i<s.length;i++){if(s[i]==='(')depth++;else if(s[i]===')')depth--;else if(depth===0&&s.slice(i,i+2)==='||'){if(split!==-1)return false;split=i;i++;}}if(split<0)return false;const a=strip(s.slice(0,split)),b=strip(s.slice(split+2));return sameOwner(a)&&b==='!data.exists()'||sameOwner(b)&&a==='!data.exists()';}
  const canWrite=value=>yes(value)||sameOwner(value)||strip(normalize(value))==='auth!=null'||ownerOrNew(value);
  const canRead=value=>yes(value)||sameOwner(value)||strip(normalize(value))==='auth!=null';
  const createsWithoutAuth=value=>yes(value)||ownerOrNew(value)||['!data.exists()','auth==null','auth==null&&!data.exists()','!data.exists()&&newData.exists()','auth==null&&!data.exists()&&newData.exists()'].includes(strip(normalize(value)));
  // A leaf transaction can use the sole wildcard's write rule; a collection
  // transaction still requires permission at the collection itself.
  function wildcard(node){const keys=Object.keys(node||{}).filter(key=>!key.startsWith('.'));return keys.length===1&&keys[0].startsWith('$')?node[keys[0]]:null;}
  return{sameOwner,yes,canWrite,canRead,createsWithoutAuth,wildcard};
}
function inspect(rules){const r=rules.rules,{sameOwner,yes,canWrite,canRead,createsWithoutAuth,wildcard}=policy(rules);
  const schemaCompatible=(node,isPublic=false)=>!node||typeof node!=='object'||Object.entries(node).every(([key,v])=>key==='.validate'?(isPublic?yes(v):canWrite(v)):key.startsWith('.')?true:schemaCompatible(v,isPublic));
  const eventLeaf=wildcard(r.citas),phoneLeaf=wildcard(r.telefonos_index),publicLeaf=wildcard(r.citas_publicas);
  const checks={contacts:sameOwner(r.leads?.['.read'])&&canWrite(r.leads?.['.write']),events:sameOwner(r.citas?.['.read'])&&(canWrite(r.citas?.['.write'])||canWrite(eventLeaf?.['.write'])),publicOccupancy:yes(r.citas_publicas?.['.read'])&&canWrite(r.citas_publicas?.['.write']),phoneIndex:(canRead(r.telefonos_index?.['.read'])||canRead(phoneLeaf?.['.read']))&&(canWrite(r.telefonos_index?.['.write'])||canWrite(phoneLeaf?.['.write'])),schemasCompatible:['leads','citas','citas_publicas','telefonos_index'].every(key=>schemaCompatible(r[key],key==='citas_publicas')),publicBooking:createsWithoutAuth(r.citas_publicas?.['.write'])||createsWithoutAuth(publicLeaf?.['.write'])};
  if(Object.values(checks).some(ok=>!ok)){const e=Error('WORKSPACE_PERMISSIONS_REQUIRE_REVIEW');e.checks=checks;throw e;}return{...checks,noRulesChanged:true};
}

function diagnose(rules){
  const owner=administrator(rules),literals=new Map(),names=new Map();
  const known=new Set(['leads','citas','citas_publicas','telefonos_index','propiedades','disponibilidad','horarios','bloqueos','nombre','telefono','fecha','hora','propiedadId','leadId','citaId','folio','estado','pendiente','confirmada','cancelada','realizada','hold','uid','admin']);
  function expression(value){if(typeof value==='boolean')return value;if(typeof value!=='string')return '[UNSUPPORTED_RULE_VALUE]';return value.replace(/(['"])((?:\\.|(?!\1)[^\\])*)\1/g,(whole,quote,literal)=>{if(literal===owner)return quote+'<ADMIN_UID>'+quote;if(known.has(literal))return whole;if(!literals.has(literal))literals.set(literal,'<LITERAL_'+(literals.size+1)+'>');return quote+literals.get(literal)+quote;});}
  function tree(node){if(!node||typeof node!=='object')return{missing:true};const output={};for(const[key,value]of Object.entries(node)){if(['.read','.write','.validate'].includes(key))output[key]=expression(value);else if(!key.startsWith('.')){let label=key;if(!known.has(key)&&!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(key)){if(!names.has(key))names.set(key,'<NODE_'+(names.size+1)+'>');label=names.get(key);}output[label]=tree(value);}}return output;}
  let checks;try{checks=inspect(rules);}catch(error){if(!error.checks)throw error;checks=error.checks;}
  const summary={};for(const key of ['.read','.write','.validate'])if(rules.rules[key]!==undefined)summary[key]=expression(rules.rules[key]);for(const key of ['leads','citas','citas_publicas','telefonos_index','propiedades','disponibilidad'])summary[key]=tree(rules.rules[key]);
  return{mode:'read-only-diagnostic',noRulesChanged:true,publicationAuthorized:false,checks,rulesSummary:summary};
}
function main(argv){const params={};let diagnostic=false;for(let i=0;i<argv.length;i++){if(argv[i]==='--diagnose'&&!diagnostic){diagnostic=true;continue;}if(!['--project','--instance'].includes(argv[i])||!argv[i+1]||params[argv[i]])throw Error('INVALID_ARGUMENTS');params[argv[i]]=argv[++i];}const project=params['--project'],instance=params['--instance'];if(!/^[a-z][a-z0-9-]{4,62}$/.test(project||'')||instance!==project+'-default-rtdb')throw Error('INVALID_PROJECT_OR_INSTANCE');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'synapse-workspace-check-'));fs.chmodSync(temp,0o700);const file=path.join(temp,'rules.json'),env={...process.env};for(const name of ['FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_EMULATOR_HUB','FIREBASE_DEBUG_MODE'])delete env[name];
  try{try{execFileSync('firebase',['database:get','/.settings/rules','--output',file,'--project',project,'--instance',instance],{cwd:temp,env,stdio:['ignore','pipe','pipe'],timeout:90000});}catch{throw Error('FIREBASE_RULES_READ_FAILED');}const rules=JSON.parse(fs.readFileSync(file,'utf8')),result=diagnostic?diagnose(rules):inspect(rules);console.log(JSON.stringify({projectId:project,...result},null,2));if(diagnostic)process.exitCode=2;}finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(JSON.stringify({error:e.message,checks:e.checks||null}));process.exitCode=1;}}
module.exports={inspect,diagnose,policy};
