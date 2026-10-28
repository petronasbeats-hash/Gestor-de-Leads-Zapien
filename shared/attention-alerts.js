/* Synapse message signature and device-local read markers. No message content is stored. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseAlerts=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const signature = Object.freeze([[587.33,0,.15],[880,.16,.17],[1318.51,.34,.40]].map(Object.freeze));
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
    let context,enabled=false;
    function play(){
      if(!enabled||context?.state!=='running')return false;
      try{
        const base=context.currentTime+.015;
        for(const [frequency,offset,duration]of signature)for(const [multiple,volume]of [[1,.13],[2,.016]]){
          const oscillator=context.createOscillator(),gain=context.createGain(),start=base+offset;
          oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency*multiple,start);
          gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
          oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.01);
        }
        return true;
      }catch{enabled=false;return false;}
    }
    return {
      async enable(){const Audio=host.AudioContext||host.webkitAudioContext;if(!Audio)throw Error('AUDIO_UNAVAILABLE');if(!context){context=new Audio();context.onstatechange=onChange;}await context.resume();enabled=context.state==='running';if(!enabled)throw Error('AUDIO_BLOCKED');play();},
      mute(){enabled=false;},
      play,
      get enabled(){return enabled&&context?.state==='running';}
    };
  }
  return Object.freeze({signature,messageStats,createTracker,createSound});
});
