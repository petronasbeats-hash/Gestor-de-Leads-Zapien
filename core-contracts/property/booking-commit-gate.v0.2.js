"use strict";
const { validateBookingRequest } = require("./booking-commit-gate.v0.1.1.js");
const { revalidateBookingIdentity } = require("./booking-identity-guard.v0.1.1.js");

function prepareBooking(request, trustedContext) {
  const booking = validateBookingRequest(request);
  if (!trustedContext || typeof trustedContext !== "object" ||
      Array.isArray(trustedContext)) {
    throw new TypeError("Contexto confiable requerido");
  }
  const { catalog, original } = trustedContext;
  const identity = revalidateBookingIdentity(catalog, original);
  if (booking.propiedadId !== identity.propiedadId) {
    throw new Error("Conflicto entre solicitud e identidad");
  }
  return Object.freeze({ booking, identity });
}

module.exports = Object.freeze({ prepareBooking });
