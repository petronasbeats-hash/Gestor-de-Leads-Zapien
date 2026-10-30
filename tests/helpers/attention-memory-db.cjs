'use strict';
function memoryDb() {
  const data = new Map(), queues = new Map();
  let fail = false;
  const snapshot = value => ({val: () => structuredClone(value ?? null)});
  return {data, failNext() {fail = true;}, ref(path) {
    return {
      async get() { return snapshot(data.get(path)); },
      async set(value) { data.set(path, structuredClone(value)); },
      transaction(update) {
        const run = async () => {
          // Model the SDK's initial null callback before receiving remote state.
          let candidate = update(null);
          if (data.has(path)) candidate = update(structuredClone(data.get(path)));
          if (candidate === undefined) return {committed: false, snapshot: snapshot(data.get(path))};
          if (fail) {fail = false; throw Error('DATABASE_OFFLINE');}
          data.set(path, structuredClone(candidate));
          return {committed: true, snapshot: snapshot(candidate)};
        };
        const promise = (queues.get(path) || Promise.resolve()).then(run);
        queues.set(path, promise.catch(() => {}));
        return promise;
      }
    };
  }};
}
module.exports = {memoryDb};
