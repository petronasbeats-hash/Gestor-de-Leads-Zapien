import {runIntegrityTests} from "./trace-integrity-tests.js";
try{console.log(JSON.stringify({suite:"PROPERTY_CORE_V01_TRACE_INTEGRITY",status:"PASS",results:runIntegrityTests()},null,2));}
catch(e){console.error(JSON.stringify({suite:"PROPERTY_CORE_V01_TRACE_INTEGRITY",status:"FAIL",error:e.message},null,2));process.exitCode=1;}
