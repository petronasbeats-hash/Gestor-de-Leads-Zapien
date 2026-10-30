(function(root) {
  'use strict';

  const eventLog = typeof module !== 'undefined' && module.exports
    ? require('./unit-event-log.v0.1.js')
    : root.UnitEventLog;

  function createEventStore() {
    const events = new Map();
    const eventIds = new Set();

    function key(organizationId, unitId) {
      return JSON.stringify([organizationId, unitId]);
    }

    function append(input) {
      const event = eventLog.createEvent(input);
      const uniqueId = JSON.stringify([
        event.organizationId,
        event.eventId
      ]);

      if (eventIds.has(uniqueId)) {
        throw new Error('Evento duplicado en la organización');
      }

      const unitKey = key(event.organizationId, event.unitId);
      const history = events.get(unitKey) || [];

      history.push(event);
      events.set(unitKey, history);
      eventIds.add(uniqueId);

      return event;
    }

    function list(organizationId, unitId) {
      if (
        typeof organizationId !== 'string' ||
        !organizationId.trim() ||
        typeof unitId !== 'string' ||
        !unitId.trim()
      ) {
        throw new Error('Organización y unidad obligatorias');
      }

      const history = events.get(key(organizationId, unitId)) || [];

      return Object.freeze([...history]);
    }

    return Object.freeze({
      append,
      list
    });
  }

  const api = Object.freeze({
    createEventStore
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.UnitEventStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
