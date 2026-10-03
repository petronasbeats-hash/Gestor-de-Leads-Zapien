const firebase=require('firebase/compat/app');
require('firebase/compat/database');
const {audit}=require('./habitat-integrity-audit.js');
const app=firebase.initializeApp({projectId:'demo-synapse-lab',databaseURL:'https://demo-synapse-lab.firebaseio.com'});
const db=firebase.database();
db.useEmulator('127.0.0.1',9000);
(async()=>{
  const result=await audit(db);
  console.log('Slots:',result.slotCount,'Citas:',result.citaCount);
  for(const issue of result.issues)console.log('ISSUE:',JSON.stringify(issue));
  console.log(result.issues.length?'REVIEW_REQUIRED':'PASS: no inconsistencies detected by audit');
  if(result.issues.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>app.delete());
