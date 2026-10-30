"use strict";

function validateBookingRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("Solicitud de reserva inválida");
  }
  const fields = ["requestId", "propiedadId", "fecha", "hora"];
  for (const field of fields) {
    if (typeof request[field] !== "string" || !request[field].trim()) {
      throw new Error("Campo obligatorio: " + field);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.fecha)) {
    throw new Error("Fecha inválida");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.hora)) {
    throw new Error("Hora inválida");
  }
  return Object.freeze({
    requestId: request.requestId.trim(),
    propiedadId: request.propiedadId.trim(),
    fecha: request.fecha,
    hora: request.hora
  });
}

module.exports = Object.freeze({ validateBookingRequest });
