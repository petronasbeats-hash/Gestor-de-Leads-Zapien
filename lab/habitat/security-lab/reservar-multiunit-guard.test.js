"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.resolve(__dirname,"../../../reservar.html"),"utf8");
assert.match(html,/if\(selectedProperty && selectedProperty\.unitId\)\s*\{\s*container\.innerHTML/,"Multiunit slots must be blocked pending trusted backend");
assert.match(html,/if\(propObjSeleccionada && propObjSeleccionada\.unitId\)\s*\{\s*alert\(/,"Multiunit submit must fail closed");
assert.match(html,/const claimResult = await window\.HabitatSlotClaim\.claimSlot/,"Legacy claim remains intact");
console.log("PASS: multiunit public booking fail-closed; legacy claim preserved");
