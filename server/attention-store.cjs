'use strict';

const {createHash} = require('node:crypto');
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw Error('INVALID_IDENTIFIER');
  return value;
};
const hash = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const fingerprint = value => hash(JSON.stringify(canonical(value)));

// All conversation changes and their journal event commit at one organization
// root. No client receives this root or a database credential.
function createAttentionStore(db) {
  if (!db || typeof db.ref !== 'function') throw Error('DATABASE_REQUIRED');
  // The SDK can surface an empty local view while a same-path transaction is
  // being aborted/replayed. Keep reads out of that transient window. Remote
  // transactions still arbitrate concurrent instances; this is not a cloud lock.
  const queues = new Map();
  function serial(organizationId, action) {
    const key=id(organizationId), previous=queues.get(key)||Promise.resolve();
    const current=previous.catch(()=>{}).then(action);queues.set(key,current);
    return current.finally(()=>{if(queues.get(key)===current)queues.delete(key);});
  }
  return {
    async read(organizationId) {
      return serial(organizationId,async()=>(await db.ref('atencion_v1/orgs/' + id(organizationId)).get()).val() || {});
    },
    async apply(organizationId, requestId, actorUid, payload, reduce) {
      id(organizationId); id(requestId); id(actorUid);
      return serial(organizationId, async () => {
      const signature = fingerprint({actorUid, payload});
      const reference = db.ref('atencion_v1/orgs/' + organizationId);
      // RTDB may first invoke a transaction with null before loading remote data.
      // A seed-only commit is harmless; never interpret that callback as a missing
      // conversation, and never overwrite a remote root with a local empty cache.
      for (let attempt = 0; attempt < 3; attempt++) {
        let failure;
        const result = await reference.transaction(current => {
          failure = undefined;
          if (current === null) return {schemaVersion: 1};
          try {
            const previous = current.commands?.[requestId];
            if (previous) {
              if (previous.fingerprint !== signature) throw Error('COMMAND_ID_CONFLICT');
              return undefined;
            }
            const {state, receipt} = reduce(structuredClone(current));
            return {...state, commands: {...state.commands, [requestId]: {fingerprint: signature, receipt}}};
          } catch (error) { failure = error; return undefined; }
        }, undefined, false);
        if (failure) throw failure;
        const command = result.snapshot.val()?.commands?.[requestId];
        if (command) {
          if (command.fingerprint !== signature) throw Error('COMMAND_ID_CONFLICT');
          return {...command.receipt, replayed: !result.committed};
        }
        if (!result.committed) throw Error('TRANSACTION_NOT_COMMITTED');
      }
      throw Error('TRANSACTION_NOT_COMMITTED');
      });
    },
    async locateInvitation(tokenHash) {
      if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw Error('INVITATION_INVALID');
      return (await db.ref('atencion_invites/' + tokenHash).get()).val();
    },
    async indexInvitation(tokenHash, locator) {
      if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw Error('INVITATION_INVALID');
      await db.ref('atencion_invites/' + tokenHash).set({organizationId: id(locator.organizationId), conversationId: id(locator.conversationId), expiresAt: locator.expiresAt});
    }
  };
}
module.exports = {createAttentionStore, id, hash, fingerprint};
