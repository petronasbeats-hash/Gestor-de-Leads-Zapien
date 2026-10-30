(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseTerritoryDrafts=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 function open(indexedDB){if(!indexedDB)return Promise.reject(Error('LOCAL_DRAFTS_UNAVAILABLE'));return new Promise((resolve,reject)=>{const request=indexedDB.open('synapse-territorio-v1',1);request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'key'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('LOCAL_DRAFTS_UNAVAILABLE'));request.onblocked=()=>reject(Error('LOCAL_DRAFTS_UNAVAILABLE'));});}
 function create({indexedDB,organizationId,uid}){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('LOCAL_DRAFT_SCOPE_REQUIRED');
  const prefix=organizationId+'/'+uid+'/',connection=open(indexedDB);
  async function transaction(mode,fn){const db=await connection;return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),store=tx.objectStore('drafts');let value;fn(store,v=>{value=v;});tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(Error('LOCAL_DRAFT_WRITE_FAILED'));tx.onabort=()=>reject(Error('LOCAL_DRAFT_WRITE_FAILED'));});}
  return {async list(){return transaction('readonly',(store,set)=>{const request=store.getAll();request.onsuccess=()=>set(request.result.filter(v=>v.key.startsWith(prefix)).map(({key,...v})=>v));});},async put(value){if(!/^[A-Za-z0-9_-]{1,128}$/.test(value.id))throw Error('LOCAL_DRAFT_ID_REQUIRED');return transaction('readwrite',store=>store.put({...value,key:prefix+value.id}));},async close(){(await connection).close();}};
 }
 return Object.freeze({create});
});
