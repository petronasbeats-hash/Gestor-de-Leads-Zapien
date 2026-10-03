"use strict";

const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9100") {
  throw Error("EMULATOR_REQUIRED");
}

const app = initializeApp({
  projectId: "demo-habitat-security-lab",
  databaseURL: "https://demo-habitat-security-lab-default-rtdb.firebaseio.com"
}, "admin-transaction-diagnostic");

const db = getDatabase(app);
const root = db.ref("lab_admin_transaction_diagnostic");
const marker = "LAB-TX-DIAG";

async function clean() {
  const snap = await root.once("value");
  const value = snap.val();
  if (value && value.marker === marker) await root.remove();
}

(async () => {
  await clean();
  await root.set({ marker });

  const callbacks = [];

  const jobs = Array.from({ length: 20 }, (_, i) => {
    const id = "REQ-" + String(i + 1).padStart(2, "0");
    const ref = root.child("requests/" + id);

    return ref.transaction(
      current => {
        callbacks.push({
          id,
          currentType: current === null ? "null" : typeof current,
          currentValue: current
        });

        if (current === null) {
          return { id, fingerprint: "FP-" + id, marker };
        }

        if (current.id === id && current.fingerprint === "FP-" + id) {
          return current;
        }

        return;
      },
      undefined,
      false
    ).then(result => ({ id, committed: result.committed, value: result.snapshot.val() }));
  });

  const results = await Promise.all(jobs);

  console.log("RESULTS");
  console.log(JSON.stringify(results, null, 2));
  console.log("CALLBACKS");
  console.log(JSON.stringify(callbacks, null, 2));

  assert.equal(results.length, 20);

  const failed = results.filter(x => !x.committed);
  if (failed.length) {
    throw Error("ADMIN_TRANSACTION_UNEXPECTED_ABORTS:" + failed.map(x => x.id).join(","));
  }

  for (const result of results) {
    assert.equal(result.value.id, result.id);
    assert.equal(result.value.fingerprint, "FP-" + result.id);
  }

  console.log("PASS: 20 independent Admin SDK transactions committed on isolated child refs");
})()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await clean();
    await deleteApp(app);
  });
