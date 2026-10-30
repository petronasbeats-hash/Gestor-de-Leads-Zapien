"use strict";

const assert = require("node:assert/strict");
const { createBookingHttpLab } = require("./booking-http-lab.v0.1.js");

async function main() {
  let calls = 0;
  const server = createBookingHttpLab({
    async confirm() {
      calls++;
      return { created: true };
    }
  });

  try {
    await new Promise((ok, fail) => {
      server.once("error", fail);
      server.listen(0, "127.0.0.1", ok);
    });

    const url = `http://127.0.0.1:${server.address().port}/booking/confirm`;

    async function check(name, expected, options) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        ...options
      });
      assert.equal(response.status, expected, name);
      assert.equal(calls, 0, "No debe invocarse el adaptador");
      console.log(`PASS ${name}`);
    }

    await check("BCG40-D: método", 405, { method: "GET" });

    await check("BCG40-E: tipo", 415, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}"
    });

    await check("BCG40-F: JSON", 400, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalido"
    });

    await check("BCG40-G: arreglo", 400, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]"
    });

    await check("BCG40-H: tamaño", 413, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(5000)
    });

    console.log("RESULTADO BCG40-NEGATIVE: 5/5 PASS");
  } finally {
    server.closeAllConnections();
    await new Promise(ok => server.close(ok));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
