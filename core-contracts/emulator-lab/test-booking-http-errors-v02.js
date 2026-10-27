"use strict";

const assert = require("node:assert/strict");
const { createBookingHttpLab } =
  require("./booking-http-lab.v0.2.js");

async function main() {
  let calls = 0;

  const server = createBookingHttpLab({
    async confirm() {
      calls++;
      throw new SyntaxError("detalle interno confidencial");
    }
  });

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const url =
      `http://127.0.0.1:${server.address().port}/booking/confirm`;

    async function send(body) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(3000)
      });
      return {
        status: response.status,
        payload: await response.json()
      };
    }

    let result = await send("{json-invalido");

    assert.equal(result.status, 400);
    assert.equal(calls, 0);
    console.log("PASS BCG40-H2-A: JSON inválido → HTTP 400");

    result = await send(JSON.stringify({
      requestId: "bcg40-h2-01",
      propiedadId: "prop-A1",
      fecha: "2026-11-20",
      hora: "10:00"
    }));

    assert.equal(result.status, 500);
    assert.equal(calls, 1);
    assert.equal(
      result.payload.error,
      "Error interno al procesar la reserva"
    );
    assert.ok(
      !JSON.stringify(result.payload).includes("confidencial")
    );

    console.log("PASS BCG40-H2-B: error interno → HTTP 500");
    console.log("PASS BCG40-H2-C: detalles internos protegidos");
    console.log("RESULTADO BCG40-H2: 3/3 PASS");
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
