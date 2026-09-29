import {runPersistenceContract} from "./persistence-contract-tests.js";
try{
 const results=await runPersistenceContract();
 console.log(JSON.stringify({suite:"PROPERTY_CORE_V01_PERSISTENCE_CONTRACT",status:"PASS",results},null,2));
}catch(error){
 console.error(JSON.stringify({suite:"PROPERTY_CORE_V01_PERSISTENCE_CONTRACT",status:"FAIL",error:error.message},null,2));
 process.exitCode=1;
}
