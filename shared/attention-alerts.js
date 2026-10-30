/* Synapse message signature and device-local read markers. No message content is stored. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseAlerts=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const signature = Object.freeze([[554.37,.025,.24],[830.61,.145,.24],[739.99,.395,.50]].map(Object.freeze));
  const signatureAsset = '/assets/audio/synapse-nexo-v1.wav';
  // Reading a message never resolves it. Same-timestamp legacy replies remain
  // pending unless causality is proven by a sequence or an explicit resolution.
  function responseStats(messages) {
    const rows=Array.isArray(messages)?messages:[],incoming=rows.filter(m=>['customer','guest'].includes(m.actorRole));
    const replies=new Map();
    for(const message of rows.filter(m=>m.actorRole==='agent')){const key=message.threadId||'',latest=replies.get(key)||{sequence:0,timestamp:-Infinity,legacyTimestamp:-Infinity},at=Date.parse(message.recordedAt);if(Number.isSafeInteger(message.sequence))latest.sequence=Math.max(latest.sequence,message.sequence);else if(Number.isFinite(at))latest.legacyTimestamp=Math.max(latest.legacyTimestamp,at);if(Number.isFinite(at))latest.timestamp=Math.max(latest.timestamp,at);replies.set(key,latest);}
    const pending=incoming.filter(m=>{if(m.answeredBy)return false;const reply=replies.get(m.threadId||'');return !reply||!(Number.isSafeInteger(m.sequence)?reply.sequence>m.sequence||reply.legacyTimestamp>Date.parse(m.recordedAt):reply.timestamp>Date.parse(m.recordedAt));});
    const sort=(a,b)=>(a.sequence||0)-(b.sequence||0)||String(a.recordedAt).localeCompare(String(b.recordedAt))||String(a.id).localeCompare(String(b.id));
    pending.sort(sort);incoming.sort(sort);
    return {count:pending.length,lastIncomingId:incoming.at(-1)?.id||'',lastId:pending.at(-1)?.id||'',firstAt:pending[0]?.recordedAt||'',pendingIds:pending.map(m=>m.id)};
  }
  function messageStats(messages, incomingRoles) {
    const rows=[...messages].sort((a,b)=>String(a.recordedAt).localeCompare(String(b.recordedAt))||String(a.id).localeCompare(String(b.id)));
    let count=0,lastId='',lastAt='',lastReply='';
    for(const item of rows){
      if(incomingRoles.includes(item.actorRole)){count++;lastId=item.id;lastAt=item.recordedAt;}
      else if(['agent','customer','guest'].includes(item.actorRole))lastReply=String(item.recordedAt);
    }
    const sinceReply=rows.filter(item=>incomingRoles.includes(item.actorRole)&&String(item.recordedAt)>=lastReply).length;
    return {count,sinceReply,lastId,lastAt};
  }
  function createTracker(storage, key) {
    let seen={};const observed=new Map(),latest=new Map();
    try{const value=JSON.parse(storage?.getItem(key)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))seen=value;}catch{}
    function persist(){try{storage?.setItem(key,JSON.stringify(seen));}catch{}}
    return {
      observe(id,stats){
        if(!stats||!Number.isSafeInteger(stats.count)||stats.count<0)return {fresh:0,unread:0};
        const before=observed.get(id);observed.set(id,stats.count);latest.set(id,stats);
        let changed=false;
        if(!Object.hasOwn(seen,id)||!Number.isSafeInteger(seen[id])||seen[id]<0){seen[id]=Math.max(0,stats.count-(stats.sinceReply||0));changed=true;}
        if(seen[id]>stats.count){seen[id]=stats.count;changed=true;}
        if(changed)persist();return {fresh:before===undefined?0:Math.max(0,stats.count-before),unread:Math.max(0,stats.count-seen[id])};
      },
      read(id,renderedCount){const stats=latest.get(id);if(!stats)return;const next=Math.max(seen[id]||0,Math.min(renderedCount,stats.count));if(next!==seen[id]){seen[id]=next;persist();}},
      unread(id){return Math.max(0,(latest.get(id)?.count||0)-(seen[id]||0));}
    };
  }
  function createSound(host,onChange=()=>{}) {
    let context,buffer,loading,enabled=false,activation=0;
    const sources=new Set();
    async function load(){
      if(buffer)return buffer;
      if(!loading)loading=(async()=>{
        const response=await host.fetch(signatureAsset,{cache:'force-cache'});
        if(!response.ok)throw Error('AUDIO_UNAVAILABLE');
        const decoded=await context.decodeAudioData(await response.arrayBuffer());
        buffer=decoded;return decoded;
      })().catch(error=>{loading=null;throw error;});
      return loading;
    }
    function play(){
      if(!enabled||!buffer||context?.state!=='running')return false;
      try{
        const source=context.createBufferSource();source.buffer=buffer;
        source.connect(context.destination);sources.add(source);
        source.onended=()=>{sources.delete(source);source.disconnect();};
        source.start(context.currentTime+.015);
        return true;
      }catch{enabled=false;return false;}
    }
    return {
      async enable({preview=true}={}){
        const Audio=host.AudioContext||host.webkitAudioContext;
        if(!Audio||typeof host.fetch!=='function')throw Error('AUDIO_UNAVAILABLE');
        const attempt=++activation;
        if(!context){context=new Audio();context.onstatechange=onChange;}
        await context.resume();if(attempt!==activation)return false;
        await load();if(attempt!==activation)return false;
        enabled=context.state==='running';if(!enabled)throw Error('AUDIO_BLOCKED');
        if(preview&&!play())throw Error('AUDIO_UNAVAILABLE');return true;
      },
      mute(){enabled=false;activation++;for(const source of sources){try{source.stop();}catch{}}},
      play,
      get enabled(){return enabled&&context?.state==='running';}
    };
  }
  return Object.freeze({signature,signatureAsset,messageStats,responseStats,createTracker,createSound});
});
