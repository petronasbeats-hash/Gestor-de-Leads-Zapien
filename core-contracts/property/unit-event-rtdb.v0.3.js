'use strict';

const { createEvent } = require('./unit-event-log.v0.1.js');

function createRtdbEventStore(database) {
  if (!database || typeof database.ref !== 'function') {
    throw new Error('Instancia RTDB obligatoria');
  }

  async function append(input) {
    const event = createEvent(input);

    const encodeRtdbKey = value =>
      encodeURIComponent(value).replace(/\./g, '%2E');

    const path =
      'propertyCore/eventsById/' +
      encodeRtdbKey(event.organizationId) + '/' +
      encodeRtdbKey(event.eventId);

    if (Buffer.byteLength(path, 'utf8') > 768) {
      throw new Error(
        'Ruta RTDB excede el límite de 768 bytes'
      );
    }

    const ref = database.ref(path);

    const result = await ref.transaction(
      current => {
        if (current !== null) return;
        return { ...event };
      },
      undefined,
      false
    );

    if (!result.committed) {
      const existing = result.snapshot.val();

      if (!existing) {
        throw new Error('Transacción no confirmada');
      }

      const serialized = Object.fromEntries(
        Object.entries(event).filter(([, value]) => value !== null)
      );

      const same =
        Object.keys(serialized).length === Object.keys(existing).length &&
        Object.keys(serialized).every(
          key => existing[key] === serialized[key]
        );

      if (!same) {
        throw new Error(
          'Conflicto: identificador reutilizado con contenido distinto'
        );
      }

      return Object.freeze({
        created: false,
        event: Object.freeze({ ...existing })
      });
    }

    return Object.freeze({
      created: true,
      event
    });
  }

  return Object.freeze({ append });
}

module.exports = Object.freeze({ createRtdbEventStore });
