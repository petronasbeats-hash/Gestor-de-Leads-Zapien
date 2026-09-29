import {runSequenceTests} from "./event-sequence-tests.js";
try{console.log(JSON.stringify({suite:"PROPERTY_CORE_V01_EVENT_SEQUENCE",status:"PASS",results:runSequenceTests()},null,2));}
catch(e){console.error(JSON.stringify({suite:"PROPERTY_CORE_V01_EVENT_SEQUENCE",status:"FAIL",error:e.message},null,2));process.exitCode=1;}
