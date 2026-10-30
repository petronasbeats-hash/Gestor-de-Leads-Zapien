"use strict";

function createBookingRtdbAdapter(database) {
  if (!database || typeof database.ref !== "function") {
    throw new TypeError("Instancia RTDB obligatoria");
  }

  const encode = value =>
    Buffer.from(value, "utf8").toString("hex");

  async function confirm(prepared) {
    if (!prepared || !prepared.booking ||
        !prepared.identity || prepared.identity.valid !== true) {
      throw new TypeError("Reserva preparada inválida");
    }

    const booking = prepared.booking;

    const requestKey = encode(booking.requestId);
    const slotKey = encode(booking.fecha + "_" + booking.hora);

    if (!requestKey || !slotKey ||
        requestKey.length > 512 || slotKey.length > 512) {
      throw new Error("Identificador fuera de límites");
    }

    const ref = database.ref("bookingCore/v01");

    const result = await ref.transaction(current => {
      const root = current || {};
      const requests = root.requests || {};
      const slots = root.slots || {};

      const existing = requests[requestKey];
      const occupied = slots[slotKey];

      if (existing || occupied) return;

      return {
        ...root,
        requests: {
          ...requests,
          [requestKey]: {
            requestId: booking.requestId,
            propiedadId: booking.propiedadId,
            fecha: booking.fecha,
            hora: booking.hora,
            operationalIdentity: prepared.identity.operationalIdentity || null,
            estado: "confirmada"
          }
        },
        slots: {
          ...slots,
          [slotKey]: requestKey
        }
      };
    }, undefined, false);

    if (!result.committed) {
      throw new Error("Reserva no confirmada: horario o solicitud ocupados");
    }

    return Object.freeze({
      created: true,
      requestId: booking.requestId,
      propiedadId: booking.propiedadId,
      fecha: booking.fecha,
      hora: booking.hora
    });
  }

  return Object.freeze({ confirm });
}

module.exports = Object.freeze({ createBookingRtdbAdapter });
