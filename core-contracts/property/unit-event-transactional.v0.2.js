(function(root) {
  'use strict';

  const eventLog = typeof module !== 'undefined' && module.exports
    ? require('./unit-event-log.v0.1.js')
    : root.UnitEventLog;

  function createTransactionalEventStore() {
    const eventsById = new Map();
    const historyByUnit = new Map();

    function key(...parts) {
      return JSON.stringify(parts);
    }

    function append(input) {
      return Promise.resolve().then(() => {
        const event = eventLog.createEvent(input);

        const idKey = key(
          event.organizationId,
          event.eventId
        );

        const existing = eventsById.get(idKey);

        if (existing) {
          if (
            JSON.stringify(existing) !==
            JSON.stringify(event)
          ) {
            throw new Error(
              'Conflicto: identificador reutilizado con contenido distinto'
            );
          }

          return Object.freeze({
            created: false,
            event: existing
          });
        }

        const unitKey = key(
          event.organizationId,
          event.unitId
        );

        const history = historyByUnit.get(unitKey) || [];

        history.push(event);
        historyByUnit.set(unitKey, history);
        eventsById.set(idKey, event);

        return Object.freeze({
          created: true,
          event
        });
      });
    }

    function list(organizationId, unitId) {
      if (
        typeof organizationId !== 'string' ||
        !organizationId.trim() ||
        typeof unitId !== 'string' ||
        !unitId.trim()
      ) {
        throw new Error(
          'Organización y unidad obligatorias'
        );
      }

      const history = historyByUnit.get(
        key(organizationId, unitId)
      ) || [];

      return Object.freeze([...history]);
    }

    return Object.freeze({
      append,
      list
    });
  }

  const api = Object.freeze({
    createTransactionalEventStore
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.UnitEventTransactional = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
