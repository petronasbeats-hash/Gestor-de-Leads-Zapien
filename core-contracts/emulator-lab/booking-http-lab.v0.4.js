"use strict";

const http = require("node:http");

function createBookingHttpLab(boundary) {
  if (!boundary || typeof boundary.confirm !== "function") {
    throw new TypeError("Frontera de reservas requerida");
  }

  const server = http.createServer(async (req, res) => {
    function reply(status, payload) {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(payload));
    }

    if (req.url !== "/booking/confirm") {
      return reply(404, { error: "Ruta no encontrada" });
    }

    if (req.method !== "POST") {
      return reply(405, { error: "Método no permitido" });
    }

    if (!/^application\/json(?:\s*;|\s*$)/i.test(
      req.headers["content-type"] || ""
    )) {
      return reply(415, { error: "Se requiere JSON" });
    }

    let raw = "";
    let bytes = 0;
    let receptionExpired = false;

    const deadline = setTimeout(() => {
      receptionExpired = true;

      if (!res.destroyed && !res.headersSent) {
        reply(408, { error: "Tiempo de recepción agotado" });
      }

      req.destroy();
    }, 5000);

    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 4096) {
          return reply(413, { error: "Solicitud demasiado grande" });
        }
        raw += chunk.toString("utf8");
      }

      clearTimeout(deadline);

      if (receptionExpired) return;

      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        return reply(400, { error: "JSON inválido" });
      }

      if (!input || typeof input !== "object" ||
          Array.isArray(input)) {
        return reply(400, { error: "Solicitud inválida" });
      }

      const allowed = [
        "requestId", "propiedadId", "fecha", "hora"
      ];

      if (Object.keys(input).some(k => !allowed.includes(k))) {
        return reply(400, { error: "Campos no permitidos" });
      }

      const result = await boundary.confirm(input);

      return reply(200, {
        created: result.created === true,
        requestId: result.requestId || input.requestId
      });
    } catch (error) {
      if (receptionExpired || res.destroyed || res.headersSent) return;

      return reply(500, {
        error: "Error interno al procesar la reserva"
      });
    } finally {
      clearTimeout(deadline);
    }
  });

  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.timeout = 5000;

  return server;
}

module.exports = Object.freeze({ createBookingHttpLab });
