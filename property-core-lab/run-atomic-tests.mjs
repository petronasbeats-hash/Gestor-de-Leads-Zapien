import {runAtomicTests} from "./atomic-transition-tests.js";
try{console.log(JSON.stringify({suite:"PROPERTY_CORE_V01_ATOMIC_TRANSITION",status:"PASS",results:await runAtomicTests()},null,2));}
catch(e){console.error(JSON.stringify({suite:"PROPERTY_CORE_V01_ATOMIC_TRANSITION",status:"FAIL",error:e.message},null,2));process.exitCode=1;}
