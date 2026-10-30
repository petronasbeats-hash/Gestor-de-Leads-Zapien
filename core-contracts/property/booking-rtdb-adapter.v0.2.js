"use strict";

function createBookingRtdbAdapter(database, rootPath = "bookingCore/v01") {
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
    const operationalIdentity = prepared.identity.operationalIdentity;

    const required = [
      "organizationId",
      "propertyGroupId",
      "unitId",
      "propiedadId"
    ];

    if (!operationalIdentity ||
        !required.every(key =>
          typeof operationalIdentity[key] === "string" &&
          operationalIdentity[key].trim().length > 0
        ) ||
        operationalIdentity.propiedadId !== booking.propiedadId) {
      throw new TypeError("Identidad operativa inválida");
    }

    const validText = (value, max) =>
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= max &&
      value.trim() === value &&
      !/[\u0000-\u001f\u007f]/.test(value);

    if (!validText(booking.requestId, 256) ||
        !validText(booking.propiedadId, 256)) {
      throw new TypeError("Identificador de reserva inválido");
    }

    if (typeof booking.fecha !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(booking.fecha)) {
      throw new TypeError("Fecha de reserva inválida");
    }

    const [year, month, day] = booking.fecha.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (year < 1000 ||
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() + 1 !== month ||
        parsed.getUTCDate() !== day) {
      throw new TypeError("Fecha de reserva inválida");
    }

    if (typeof booking.hora !== "string" ||
        !/^(?:09|1[0-9]|20):(?:00|30)$/.test(booking.hora) ||
        booking.hora === "20:30") {
      throw new TypeError("Horario de reserva inválido");
    }

    const requestKey = encode(booking.requestId);
    const slotKey = encode(JSON.stringify([
      operationalIdentity.organizationId,
      operationalIdentity.propertyGroupId,
      operationalIdentity.unitId,
      booking.fecha,
      booking.hora
    ]));

    if (!requestKey || !slotKey ||
        requestKey.length > 512 || slotKey.length > 2048) {
      throw new Error("Identificador fuera de límites");
    }

    const ref = database.ref(rootPath);

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
      const state = result.snapshot.val() || {};
      const existing = state.requests?.[requestKey];

      const expected = {
        requestId: booking.requestId,
        propiedadId: booking.propiedadId,
        fecha: booking.fecha,
        hora: booking.hora,
        operationalIdentity: prepared.identity.operationalIdentity || null,
        estado: "confirmada"
      };

      const sameBooking = Boolean(existing) &&
        ["requestId", "propiedadId", "fecha", "hora", "estado"]
          .every(k => existing[k] === expected[k]) &&
        ["organizationId", "propertyGroupId", "unitId", "propiedadId"]
          .every(k =>
            existing.operationalIdentity?.[k] ===
            expected.operationalIdentity?.[k]
          );

      if (sameBooking && state.slots?.[slotKey] === requestKey) {
        return Object.freeze({
          created: false,
          requestId: booking.requestId,
          propiedadId: booking.propiedadId,
          fecha: booking.fecha,
          hora: booking.hora
        });
      }

      throw new Error("Reserva no confirmada: conflicto de horario o solicitud");
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
