"use strict";
const { validateBookingRequest } = require("./booking-commit-gate.v0.1.js");

function validateBookingRequestStrict(request) {
  const result = validateBookingRequest(request);
  const [year, month, day] = result.fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) {
    throw new Error("Fecha inexistente");
  }
  return result;
}

module.exports = Object.freeze({ validateBookingRequest: validateBookingRequestStrict });
