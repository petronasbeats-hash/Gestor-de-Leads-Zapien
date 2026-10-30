"use strict";

const http = require("node:http");

function createBookingHttpLab(boundary) {
  if (!boundary || typeof boundary.confirm !== "function") {
    throw new TypeError("Frontera de reservas requerida");
  }

  return http.createServer(async (req, res) => {
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

    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 4096) {
          return reply(413, { error: "Solicitud demasiado grande" });
        }
        raw += chunk.toString("utf8");
      }

      const input = JSON.parse(raw);

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
      if (error instanceof SyntaxError) {
        return reply(400, { error: "JSON inválido" });
      }

      return reply(400, {
        error: "No fue posible confirmar la reserva"
      });
    }
  });
}

module.exports = Object.freeze({ createBookingHttpLab });
