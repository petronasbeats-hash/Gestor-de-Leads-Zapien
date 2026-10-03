"use strict";
const assert=require("node:assert/strict");
const admin=require("firebase-admin/app");
const {getDatabase}=require("firebase-admin/database");
const firebase=require("firebase/compat/app");
require("firebase/compat/database");
const projectId="demo-habitat-security-lab";
const host="127.0.0.1:9100";
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!==host)
  throw Error("Start isolated emulator on port 9100 and export FIREBASE_DATABASE_EMULATOR_HOST="+host);
const namespace=projectId+"-default-rtdb";
const url="https://"+namespace+".firebaseio.com";
const app=admin.initializeApp({projectId,databaseURL:url},"habitat-security-lab");
const db=getDatabase(app);
if(!db.ref().toString().includes(namespace))throw Error("ADMIN_NAMESPACE_MISMATCH");
const clientApp=firebase.initializeApp({projectId,databaseURL:url},"habitat-security-public");
const client=clientApp.database();
client.useEmulator("127.0.0.1",9100);
if(!client.ref().toString().includes(namespace))throw Error("CLIENT_NAMESPACE_MISMATCH");
async function denied(path){
  try{await client.ref(path).set({unsafe:true});throw Error("CLIENT_WRITE_UNEXPECTEDLY_ALLOWED: "+path)}
  catch(e){if(String(e).includes("CLIENT_WRITE_UNEXPECTEDLY_ALLOWED"))throw e;
    assert(/permission_denied|permission denied/i.test(String(e)),"Expected permission denied at "+path+": "+e);}
}
(async()=>{
  const marker="LAB-SECURITY-GATE-01";
  const protectedPaths=["citas_publicas","booking_requests","citas","system_events","leads","telefonos_index"];
  for(const path of protectedPaths)await denied(path+"/"+marker);
  await assert.rejects(client.ref("citas/"+marker).once("value"),/permission_denied|permission denied/i);
  const pub=db.ref("public_availability/"+marker);
  try{
    await pub.set({available:true,fixtureMarker:marker});
    const snap=await client.ref("public_availability/"+marker).once("value");
    assert.equal(snap.val().available,true);
    const serverCita=db.ref("citas/"+marker);
    await serverCita.set({fixtureMarker:marker});
    assert.equal((await serverCita.once("value")).val().fixtureMarker,marker);
    console.log("PASS: isolated emulator denies public writes, allows public projection reads and Admin SDK writes");
  }finally{
    await pub.remove();
    const serverCita=db.ref("citas/"+marker);
    if((await serverCita.once("value")).val()?.fixtureMarker===marker)await serverCita.remove();
  }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await clientApp.delete();await app.delete()});
