"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { createBookingHttpLab } =
  require("./booking-http-lab.v0.2.js");

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

    const port = server.address().port;

    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: "/booking/confirm",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "1000"
        }
      });

      req.on("error", error => {
        if (error.code === "ECONNRESET") resolve();
        else reject(error);
      });

      req.on("response", response => {
        response.resume();
        reject(new Error("Respuesta inesperada"));
      });

      req.flushHeaders();
      req.write('{"requestId":"incompleto"');
      req.destroy();
    });

    assert.equal(calls, 0);
    console.log("PASS BCG40-H4-A: conexión interrumpida sin confirmar");
  } finally {
    server.closeAllConnections();
    await new Promise(ok => server.close(ok));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
