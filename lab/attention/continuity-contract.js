/* Synapse Attention continuity contract. Pure functions, no database writes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SynapseContinuity = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const sources = Object.freeze({
    marketplace_facebook: 'Marketplace Facebook', facebook: 'Facebook',
    whatsapp: 'WhatsApp', casa_login: 'Casa Login',
    hype_synapse_experience: 'HYPE by Synapse Experience', directa: 'Directa'
  });
  const channels = Object.freeze({messenger: 'Messenger', whatsapp: 'WhatsApp', web: 'Web', hype: 'HYPE'});
  const clean = (value, max = 180) => String(value == null ? '' : value).trim().slice(0, max);
  function fail(code) { throw new Error(code); }
  function normalizePhone(value) {
    let digits = clean(value, 30).replace(/[\s().+-]/g, '');
    if (!/^\d+$/.test(digits)) fail('PHONE_REQUIRED');
    if (/^52\d{10}$/.test(digits)) digits = digits.slice(2);
    if (!/^\d{10}$/.test(digits)) fail('PHONE_INVALID');
    return '+52' + digits;
  }
  function prepareContext(input, publications) {
    if (!Object.hasOwn(sources, input.source)) fail('SOURCE_REQUIRED');
    if (!Object.hasOwn(channels, input.entryChannel)) fail('ENTRY_CHANNEL_REQUIRED');
    const property = publications[input.propertyId];
    if (!property || property.activo === false) fail('PROPERTY_NOT_PUBLISHED');
    return Object.freeze({
      displayName: clean(input.displayName), surname: clean(input.surname),
      phone: input.phone ? normalizePhone(input.phone) : '',
      identityStatus: 'unverified', source: input.source,
      entryChannel: input.entryChannel, currentChannel: 'synapse_attention',
      originalPropertyId: input.propertyId, currentPropertyId: input.propertyId,
      question: clean(input.question || '¿Sigue disponible?', 500),
      entryType: input.source === 'directa' || input.source === 'hype_synapse_experience' ? 'direct' : 'referred'
    });
  }
  function changeInterest(context, propertyId, publications) {
    if (!publications[propertyId] || publications[propertyId].activo === false) fail('PROPERTY_NOT_PUBLISHED');
    return Object.freeze({...context, currentPropertyId: propertyId});
  }
  function buildAttentionUrl(baseUrl, token) {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) fail('INVALID_INVITATION_TOKEN');
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') fail('HTTPS_REQUIRED');
    url.pathname = '/atencion'; url.search = ''; url.hash = token;
    return url.toString();
  }
  function buildBookingCommand(context, input) {
    const name = clean(input.name);
    if (!name) fail('NAME_REQUIRED');
    if (!/^[a-zA-Z0-9_-]{12,128}$/.test(input.requestId || '')) fail('REQUEST_ID_REQUIRED');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeKey || '')) fail('SLOT_REQUIRED');
    if (input.propertyId !== context.currentPropertyId) fail('PROPERTY_SCOPE_MISMATCH');
    return Object.freeze({
      requestId: input.requestId, conversationId: clean(input.conversationId),
      customer: {name, surname: clean(input.surname), phone: normalizePhone(input.phone), identityStatus: 'unverified'},
      propertyId: context.currentPropertyId, dateKey: input.dateKey, timeKey: input.timeKey,
      attribution: {source: context.source, entryChannel: context.entryChannel,
        currentChannel: 'synapse_attention', originalPropertyId: context.originalPropertyId},
      requestedStatus: 'registered'
    });
  }
  // Production passes the SAME trusted booking gateway as the public portal.
  // The gateway must authorize the conversation, revalidate availability,
  // atomically claim the slot and persist lead/cita/folio with idempotency.
  async function registerVisit(context, input, gateway) {
    const command = buildBookingCommand(context, input);
    if (!gateway || typeof gateway.book !== 'function') fail('TRUSTED_GATEWAY_REQUIRED');
    const result = await gateway.book(command);
    if (!result || result.status !== 'registered' || !result.citaId || !result.folio || !result.leadId) fail('BOOKING_NOT_REGISTERED');
    if (result.propertyId !== command.propertyId || result.dateKey !== command.dateKey || result.timeKey !== command.timeKey) fail('BOOKING_RESULT_MISMATCH');
    return Object.freeze({
      citaId: result.citaId, leadId: result.leadId, folio: result.folio,
      dateKey: result.dateKey, timeKey: result.timeKey, propertyId: result.propertyId,
      registrationStatus: 'registered', appointmentStatus: 'pendiente', replayed: Boolean(result.replayed)
    });
  }
  return Object.freeze({sources, channels, normalizePhone, prepareContext, changeInterest, buildAttentionUrl, buildBookingCommand, registerVisit});
});
