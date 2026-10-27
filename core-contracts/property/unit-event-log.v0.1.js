(function(root) {
  'use strict';

  const VERSION = '0.1';

  const EVENT_TYPES = Object.freeze([
    'maintenance_started',
    'maintenance_updated',
    'inspection_recorded',
    'verification_completed',
    'unit_status_changed'
  ]);

  function nonEmpty(value) {
    return typeof value === 'string' &&
      value.trim().length > 0;
  }

  function validTimestamp(value) {
    if (!nonEmpty(value)) return false;

    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/
    );

    if (!match) return false;

    const [year, month, day, hour, minute, second] =
      match.slice(1, 7).map(Number);

    const calendar = new Date(Date.UTC(year, month - 1, day));

    return calendar.getUTCFullYear() === year &&
      calendar.getUTCMonth() === month - 1 &&
      calendar.getUTCDate() === day &&
      hour <= 23 &&
      minute <= 59 &&
      second <= 59 &&
      Number.isFinite(Date.parse(value));
  }

  function createEvent(input) {
    if (!input || typeof input !== 'object' ||
        Array.isArray(input)) {
      throw new TypeError('Evento inválido');
    }

    const required = [
      'eventId',
      'organizationId',
      'unitId',
      'actorId'
    ];

    for (const field of required) {
      if (!nonEmpty(input[field])) {
        throw new Error('Campo obligatorio: ' + field);
      }
    }

    if (!EVENT_TYPES.includes(input.type)) {
      throw new Error('Tipo de evento no permitido');
    }

    if (!validTimestamp(input.occurredAt)) {
      throw new Error('Fecha de evento inválida');
    }

    return Object.freeze({
      version: VERSION,
      eventId: input.eventId,
      organizationId: input.organizationId,
      unitId: input.unitId,
      type: input.type,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      evidenceId: nonEmpty(input.evidenceId)
        ? input.evidenceId : null
    });
  }

  const api = Object.freeze({
    VERSION,
    EVENT_TYPES,
    createEvent
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.UnitEventLog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
