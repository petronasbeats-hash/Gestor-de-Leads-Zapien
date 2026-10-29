(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseActionSources=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 function create({getUser,fetch:request,onChange,timeoutMs=15000}){
  let generation=0,uid='',inflight=null,controller,state={uid:'',items:[],status:'idle',failedSources:0,observedAt:null};
  const emit=value=>{state={...state,...value};onChange(structuredClone(state));};
  const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
  function stop(){generation++;controller?.abort();controller=null;inflight=null;uid='';emit({uid:'',items:[],status:'idle',failedSources:0,observedAt:null});}
  function start(value){stop();uid=value;emit({uid,status:'loading'});return refresh();}
  function refresh(){
   if(!uid)return Promise.resolve(state);if(inflight)return inflight;
   const at=generation,currentUid=uid,user=getUser();if(user?.uid!==uid){stop();return Promise.resolve(state);}
   const abort=new AbortController();controller=abort;const timer=setTimeout(()=>abort.abort(),timeoutMs);
   const abortable=promise=>new Promise((resolve,reject)=>{const cancelled=()=>reject(Error('SOURCE_TIMEOUT'));if(abort.signal.aborted){cancelled();return;}abort.signal.addEventListener('abort',cancelled,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>abort.signal.removeEventListener('abort',cancelled));});
   const current=()=>at===generation&&getUser()?.uid===currentUid;
   const json=async(url,token,body)=>{const response=await abortable(request(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:abort.signal,cache:'no-store'}));const value=await abortable(response.json());if(!response.ok)throw Error(value.error||'UNAVAILABLE');return value;};
   emit({status:'loading'});
   const task=Promise.resolve().then(async()=>{
    try{
     const token=await abortable(user.getIdToken());if(!current())return;
     const session=await json('/attention-api/agent/session',token);if(!current())return;
     if(!Array.isArray(session.organizations)||session.organizations.some(o=>!validId(o.id)))throw Error('INVALID_RESPONSE');
     const orgs=[...new Map(session.organizations.map(o=>[o.id,o])).values()];
     const sources=orgs.flatMap(org=>['territory','destaca','attention'].map(kind=>({org,kind})));
     const results=await Promise.allSettled(sources.map(async ({org,kind})=>{
      const value=await json('/attention-api/agent/'+(kind==='attention'?'':kind+'/')+'pending',token,{organizationId:org.id});
      if(!Array.isArray(value.items))throw Error('INVALID_RESPONSE');
      return value.items.map(item=>{const recordId=kind==='territory'?item.captureId:kind==='attention'?item.conversationId:item.recommendationId;if(!validId(recordId)||typeof item.title!=='string'||item.title.length>361||typeof item.description!=='string'||!item.description.trim()||item.description.length>400||typeof item.dueDate!=='string'||!Number.isSafeInteger(item.version)||item.version<1)throw Error('INVALID_RESPONSE');return {kind,recordId,...(kind==='attention'?{actionType:item.actionType==='followup'?'followup':'reply'}:{}),organizationId:org.id,title:item.title,description:item.description,dueDate:item.dueDate,version:item.version};});
     }));
     if(!current())return;const failures=results.filter(r=>r.status==='rejected').length;
     emit({items:results.flatMap(r=>r.status==='fulfilled'?r.value:[]),status:!orgs.length?'disabled':failures===sources.length?'error':failures?'partial':'ready',failedSources:failures,observedAt:new Date().toISOString()});
    }catch{if(current())emit({items:[],status:'error',observedAt:null});}
    finally{clearTimeout(timer);if(at===generation){inflight=null;controller=null;}}
    return state;
   });inflight=task;return task;
  }
  return Object.freeze({start,stop,refresh});
 }
 return Object.freeze({create});
});
