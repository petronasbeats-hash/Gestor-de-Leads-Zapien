'use strict';
const copy=v=>v==null?null:JSON.parse(JSON.stringify(v));
function database(initial={}){
  let data=copy(initial),tail=Promise.resolve(),fault,counter=0;const writes=[],listeners=new Map();
  const get=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
  const snapshot=path=>({val:()=>copy(get(path)),exists:()=>get(path)!==null});
  function put(path,value){const keys=path.split('/').filter(Boolean);if(!keys.length){data=copy(value);return;}let p=data;for(const key of keys.slice(0,-1)){if(!p[key]||typeof p[key]!=='object')p[key]={};p=p[key];}if(value===null)delete p[keys.at(-1)];else p[keys.at(-1)]=copy(value);}
  function notify(paths){for(const[key,fns]of listeners)if(paths.some(p=>!p||key===p||key.startsWith(p+'/')||p.startsWith(key+'/')))for(const fn of fns)queueMicrotask(()=>fn(snapshot(key)));}
  function serial(run){const result=tail.catch(()=>{}).then(run);tail=result;return result;}
  return{get data(){return data;},writes,failWhen(fn){fault=fn;},ref(path=''){return{
    key:path.split('/').at(-1),async get(){return snapshot(path);},async once(){return snapshot(path);},push(){return{key:'push_'+String(++counter).padStart(10,'0')};},
    on(event,fn){if(!listeners.has(path))listeners.set(path,new Set());listeners.get(path).add(fn);queueMicrotask(()=>fn(snapshot(path)));},off(event,fn){listeners.get(path)?.delete(fn);},
    set(value){return serial(async()=>{if(fault?.(path,value)){fault=undefined;throw Error('DATABASE_OFFLINE');}put(path,value);writes.push(path);notify([path]);});},
    update(values){return serial(async()=>{const old=copy(data),changed=[];for(const[k,v]of Object.entries(values)){const target=[path,k].filter(Boolean).join('/');put(target,v);changed.push(target);}if(fault?.(path,data)){fault=undefined;data=old;throw Error('DATABASE_OFFLINE');}writes.push(path);notify(changed);});},
    transaction(update){return serial(async()=>{update(null);const candidate=update(copy(get(path)));if(candidate===undefined)return{committed:false,snapshot:snapshot(path)};if(fault?.(path,candidate)){fault=undefined;throw Error('DATABASE_OFFLINE');}put(path,candidate);writes.push(path);notify([path]);return{committed:true,snapshot:snapshot(path)};});}
  };}};
}
module.exports={database};
