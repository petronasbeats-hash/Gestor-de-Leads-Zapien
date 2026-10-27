"use strict";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:09|1[0-9]|20):(?:00|30)$/;

function operationalSlot({ fecha, hora }) {
  if (typeof fecha !== "string" || !DATE_RE.test(fecha)) {
    throw new TypeError("Fecha operativa inválida");
  }

  const [year, month, day] = fecha.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new TypeError("Fecha inexistente");
  }

  if (
    typeof hora !== "string" ||
    !TIME_RE.test(hora) ||
    hora === "20:30"
  ) {
    throw new TypeError("Horario operativo inválido");
  }

  return Object.freeze({
    fecha,
    hora,
    slotKey: `${fecha}_${hora}`
  });
}

module.exports = Object.freeze({ operationalSlot });
