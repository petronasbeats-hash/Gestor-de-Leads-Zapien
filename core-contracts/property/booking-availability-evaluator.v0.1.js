"use strict";

const { operationalSlot } = require(
  "./booking-operational-slot.v0.3.js"
);

function minutes(time) {
  if (typeof time !== "string" ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new TypeError("Hora inválida");
  }

  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function evaluateAvailability(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Contexto requerido");
  }

  const { fecha, hora, slotKey } = operationalSlot(input);

  const {
    duracionMin,
    rangos,
    bloqueos,
    citas,
    propiedadActiva
  } = input;

  if (propiedadActiva !== true) {
    return { available: false, reason: "PROPERTY_INACTIVE" };
  }

  if (!Number.isInteger(duracionMin) ||
      duracionMin <= 0 || duracionMin > 480) {
    throw new TypeError("Duración inválida");
  }

  if (!Array.isArray(rangos) ||
      !Array.isArray(bloqueos) ||
      !Array.isArray(citas)) {
    throw new TypeError("Disponibilidad incompleta");
  }

  const start = minutes(hora);
  const end = start + duracionMin;

  const withinRange = rangos.some(r => {
    const rangeStart = minutes(r.inicio);
    const rangeEnd = minutes(r.fin);

    return start >= rangeStart && end <= rangeEnd;
  });

  if (!withinRange) {
    return { available: false, reason: "OUTSIDE_SCHEDULE" };
  }

  if (bloqueos.includes(hora)) {
    return { available: false, reason: "BLOCKED" };
  }

  for (const cita of citas) {
    if (cita.fecha !== fecha) continue;

    const otherStart = minutes(cita.hora);
    const otherDuration = cita.duracionMin ?? duracionMin;

    if (!Number.isInteger(otherDuration) ||
        otherDuration <= 0) {
      throw new TypeError("Duración de cita inválida");
    }

    const otherEnd = otherStart + otherDuration;

    if (start < otherEnd && otherStart < end) {
      return { available: false, reason: "OVERLAP" };
    }
  }

  return {
    available: true,
    reason: "AVAILABLE",
    slotKey
  };
}

module.exports = Object.freeze({
  evaluateAvailability
});
