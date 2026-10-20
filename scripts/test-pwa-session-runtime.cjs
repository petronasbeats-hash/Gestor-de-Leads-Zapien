#!/usr/bin/env node
// Execute the actual session lifecycle block from index.html with Firebase/DOM stubs.
// This is a unit harness, NOT an emulator or backend authorization test.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const sessionListeners = [];');
const end = html.indexOf('/* =========================================================', start);
assert.ok(start > 0 && end > start, 'Session block not found');
const block = html.slice(start, end);
const subscriptions = [];
let authCallback;
const state = {login:0, app:0, start:0, load:0};
const context = {
  firebase: {auth:()=>({onAuthStateChanged:cb=>{authCallback=cb;}})},
  showLogin:()=>state.login++,
  showApp:()=>state.app++,
  startListening:()=>state.start++,
  loadAdminData:()=>state.load++,
  leads:{old:1}, propiedades:{old:1}, ultimasCitas:{old:1},
  ocupados:{old:1}, horario:{old:1}, adminDataLoaded:true
};
vm.createContext(context);
vm.runInContext(block, context);
assert.equal(typeof authCallback,'function');
authCallback(null);
assert.equal(state.login,1,'Initial signed-out state must show login');
assert.equal(context.leads.old,undefined);
const makeRef=()=>({
  on(event, cb){subscriptions.push({event,cb,active:true});},
  off(event, cb){
    const sub=subscriptions.find(x=>x.event===event&&x.cb===cb&&x.active);
    assert.ok(sub,'Listener removed using wrong callback');
    sub.active=false;
  }
});
authCallback({uid:'A'});
assert.equal(state.app,1);
assert.equal(state.login,2,'Old UI must be hidden before showing authenticated app');
vm.runInContext("listenForSession(globalTestRef, 'value', globalTestCallback)",Object.assign(context,{globalTestRef:makeRef(),globalTestCallback:()=>{}}));
assert.equal(subscriptions.filter(x=>x.active).length,1);
authCallback({uid:'A'});
assert.equal(state.start,1,'Same user must not initialize twice');
let oldInvocations = 0;
vm.runInContext("listenForSession(globalTestRef2, 'value', globalTestCallback2)", Object.assign(context, {globalTestRef2:makeRef(),globalTestCallback2:()=>oldInvocations++}));
const delayedCallback = subscriptions[1].cb;
authCallback({uid:'B'});
delayedCallback({});
assert.equal(oldInvocations,0,'Late callbacks from prior user must be ignored');
assert.equal(subscriptions.filter(x=>x.active).length,0,'Old user listeners must detach');
assert.equal(state.start,2,'New user must initialize');
assert.equal(state.login,3,'Previous admin UI must be concealed on account switch');
authCallback(null);
assert.equal(state.login,4,'Logout must show login again');
authCallback(null);
assert.equal(state.login,4,'Repeated signed-out callback must not redraw login');
assert.equal(state.start,2);
console.log('PASS: simulated initial logout, login, duplicate auth, account switch and logout');
