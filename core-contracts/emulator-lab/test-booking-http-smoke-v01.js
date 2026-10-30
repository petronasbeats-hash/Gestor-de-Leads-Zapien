"use strict";

const assert = require("node:assert/strict");
const { createBookingHttpLab } = require("./booking-http-lab.v0.1.js");

async function main() {
  let calls = 0;

  const server = createBookingHttpLab({
    async confirm(input) {
      calls++;
      return { created: true, requestId: input.requestId };
    }
  });

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const base = `http://127.0.0.1:${server.address().port}`;
    const request = {
      requestId: "bcg40-smoke-01",
      propiedadId: "prop-A1",
      fecha: "2026-11-20",
      hora: "10:00"
    };

    const send = (path, body) => fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });

    let response = await send("/booking/confirm", request);
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    console.log("PASS BCG40-A: solicitud válida");

    response = await send("/ruta-inexistente", request);
    assert.equal(response.status, 404);
    assert.equal(calls, 1);
    console.log("PASS BCG40-B: ruta desconocida");

    response = await send("/booking/confirm", {
      ...request,
      organizationId: "org-falsa"
    });
    assert.equal(response.status, 400);
    assert.equal(calls, 1);
    console.log("PASS BCG40-C: identidad adicional rechazada");

    console.log("RESULTADO BCG40-SMOKE: 3/3 PASS");
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
