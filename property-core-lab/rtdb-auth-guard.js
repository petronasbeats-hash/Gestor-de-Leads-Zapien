import {LAB_ROOT} from "./rtdb-lab-adapter.js";

export function assertAuthenticatedLabConnection(firebase){
  if(!firebase || typeof firebase.auth!=="function" || typeof firebase.database!=="function")
    throw new Error("FIREBASE_COMPAT_REQUIRED");
  const user=firebase.auth().currentUser;
  if(!user) throw new Error("AUTH_REQUIRED");
  return {db:firebase.database(),user,root:LAB_ROOT};
}

export function assertLabPath(path){
  const p=String(path||"");
  if(!(p===LAB_ROOT || p.startsWith(LAB_ROOT+"/"))) throw new Error("NON_LAB_PATH_REJECTED");
  return p;
}

export async function probeLabConnection(firebase){
  const {db,user,root}=assertAuthenticatedLabConnection(firebase);
  assertLabPath(root);
  const snap=await db.ref(root).once("value");
  return {ok:true,uid:user.uid,root,exists:snap.exists()};
}
