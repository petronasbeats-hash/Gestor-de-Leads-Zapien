'use strict';

const ID = /^[A-Za-z0-9_-]{1,100}$/;

function validSlot(slot) {
  if (typeof slot !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})_([01]\d|2[0-3]):([0-5]\d)$/.exec(slot);
  if (!match) return false;

  const [, yy, mm, dd, hh, mi] = match;
  const y = Number(yy), m = Number(mm), d = Number(dd);
  const h = Number(hh), minute = Number(mi);
  const date = new Date(Date.UTC(y, m - 1, d));

  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d &&
    h * 60 + minute >= 540 &&
    h * 60 + minute <= 1200 &&
    minute % 30 === 0;
}

function buildRescheduleRequest(input) {
  if (!input || typeof input !== 'object') {
    throw Error('INVALID_INPUT');
  }

  const {
    commandId, citaId, expectedSlot,
    newSlot, expectedVersion
  } = input;

  if (!ID.test(commandId) || !ID.test(citaId)) {
    throw Error('INVALID_IDENTITY');
  }

  if (!validSlot(expectedSlot) || !validSlot(newSlot)) {
    throw Error('INVALID_SLOT');
  }

  if (expectedSlot === newSlot) {
    throw Error('SAME_SLOT');
  }

  if (!Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1) {
    throw Error('INVALID_VERSION');
  }

  return Object.freeze({
    type: 'RESCHEDULE',
    commandId,
    citaId,
    expectedSlot,
    slot: newSlot,
    expectedVersion
  });
}

module.exports = {
  buildRescheduleRequest,
  validSlot
};
