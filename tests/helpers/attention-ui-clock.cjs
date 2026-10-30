'use strict';
function uiClock(){let next=0;const timers=new Map();return {setTimeout(fn,delay){const id=++next;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},get size(){return timers.size;},async tick(){const entry=timers.entries().next().value;if(!entry)throw Error('NO_POLL_SCHEDULED');timers.delete(entry[0]);await entry[1].fn();return entry[1].delay;}};}
function audioHost(){
  const state={contexts:0,starts:0,stops:0,fetches:0,decodes:0,played:[]};
  const bytes=require('node:fs').readFileSync(require.resolve('../../assets/audio/synapse-nexo-v1.wav'));
  class AudioContext{
    constructor(){state.contexts++;this.state='suspended';this.currentTime=0;}
    async resume(){this.state='running';}
    async decodeAudioData(value){state.decodes++;const data=Buffer.from(value);if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')throw Error('INVALID_AUDIO');return{duration:(data.length-44)/2/44100,bytes:data};}
    createBufferSource(){return{connect(){},disconnect(){},start(){state.starts++;state.played.push(this.buffer);},stop(){state.stops++;this.onended?.();}};}
  }
  return {state,AudioContext,fetch:async()=>{state.fetches++;return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}};
}
module.exports={uiClock,audioHost};
