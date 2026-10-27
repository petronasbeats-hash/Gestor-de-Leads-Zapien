"use strict";

const { operationalSlot } = require(
  "./booking-operational-slot.v0.3.js"
);

const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const ROOT_RE = /^bookingCore\/labV03\/[a-zA-Z0-9_-]+$/;

function createBookingConfirmationAdapter(database, rootPath) {
  if (!database || typeof database.ref !== "function") {
    throw new TypeError("RTDB requerida");
  }

  if (typeof rootPath !== "string" ||
      !ROOT_RE.test(rootPath)) {
    throw new TypeError("Ruta de laboratorio requerida");
  }

  const root = database.ref(rootPath);

  async function confirm(input) {
    if (!input || typeof input !== "object") {
      throw new TypeError("Solicitud requerida");
    }

    const { fecha, hora, slotKey } = operationalSlot(input);
    const { requestId, citaId, propiedadId } = input;

    for (const [name, value] of Object.entries({
      requestId, citaId, propiedadId
    })) {
      if (typeof value !== "string" || !ID_RE.test(value)) {
        throw new TypeError(`${name} inválido`);
      }
    }

    const result = await root.transaction(current => {
      const state = current || {};
      const slots = state.slots || {};
      const requests = state.requests || {};
      const citas = state.citas || {};

      const previous = requests[requestId];

      if (previous) return;

      if (slots[slotKey] || citas[citaId]) return;

      return {
        ...state,
        slots: {
          ...slots,
          [slotKey]: { requestId, citaId, propiedadId }
        },
        requests: {
          ...requests,
          [requestId]: {
            citaId, propiedadId, fecha, hora, slotKey
          }
        },
        citas: {
          ...citas,
          [citaId]: {
            requestId,
            propiedadId,
            fecha,
            hora,
            estado: "pendiente"
          }
        }
      };
    }, undefined, false);

    if (result.committed) {
      return Object.freeze({
        created: true, requestId, citaId, slotKey
      });
    }

    const state = result.snapshot.val() || {};
    const previous = state.requests?.[requestId];

    if (previous) {
      const same =
        previous.citaId === citaId &&
        previous.propiedadId === propiedadId &&
        previous.fecha === fecha &&
        previous.hora === hora &&
        previous.slotKey === slotKey;

      if (!same) {
        throw new Error("requestId reutilizado");
      }

      const slot = state.slots?.[slotKey];
      const cita = state.citas?.[citaId];

      if (!slot ||
          slot.requestId !== requestId ||
          slot.citaId !== citaId ||
          slot.propiedadId !== propiedadId ||
          !cita ||
          cita.requestId !== requestId ||
          cita.propiedadId !== propiedadId ||
          cita.fecha !== fecha ||
          cita.hora !== hora) {
        throw new Error("Integridad de reserva inválida");
      }

      return Object.freeze({
        created: false, requestId, citaId, slotKey
      });
    }

    throw new Error("Horario o cita ocupado");
  }

  return Object.freeze({ confirm });
}

module.exports = Object.freeze({
  createBookingConfirmationAdapter
});
