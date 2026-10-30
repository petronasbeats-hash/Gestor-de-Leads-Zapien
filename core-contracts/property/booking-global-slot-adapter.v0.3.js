"use strict";

const { operationalSlot } = require(
  "./booking-operational-slot.v0.3.js"
);

function createGlobalSlotAdapter(database, rootPath) {
  if (!database || typeof database.ref !== "function") {
    throw new TypeError("RTDB requerida");
  }

  if (
    typeof rootPath !== "string" ||
    !/^bookingCore\/labV03\/[a-zA-Z0-9_-]+$/.test(rootPath)
  ) {
    throw new TypeError("Ruta de laboratorio requerida");
  }

  async function reserve({ fecha, hora, requestId }) {
    const { slotKey } = operationalSlot({ fecha, hora });

    if (
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)
    ) {
      throw new TypeError("requestId inválido");
    }

    const ref = database.ref(`${rootPath}/slots/${slotKey}`);

    const result = await ref.transaction(current => {
      if (current !== null) return;
      return { requestId, fecha, hora };
    }, undefined, false);

    if (!result.committed) {
      const existing = result.snapshot.val();

      if (existing?.requestId === requestId &&
          existing?.fecha === fecha &&
          existing?.hora === hora) {
        return Object.freeze({
          created: false,
          requestId,
          slotKey
        });
      }

      throw new Error("Horario global ocupado");
    }

    return Object.freeze({
      created: true,
      requestId,
      slotKey
    });
  }

  return Object.freeze({ reserve });
}

module.exports = Object.freeze({ createGlobalSlotAdapter });
