'use strict';

const {randomBytes} = require('node:crypto');
const continuity = require('../lab/attention/continuity-contract.js');
const {prepareEntry, dailyReport} = require('./attention-journal.cjs');
const lease = require('../shared/lease-continuity.js');
const {id, hash} = require('./attention-store.cjs');

function text(value, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value.trim())) throw Error('INVALID_TEXT');
  return value.trim();
}
function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw Error('INVALID_FIELDS');
}
function agent(principal) {
  if (!principal || principal.role !== 'agent') throw Error('AGENT_REQUIRED');
  id(principal.uid); id(principal.organizationId);
  return principal;
}
function permitted(principal, propertyId) {
  if (!Array.isArray(principal.propertyIds) || !principal.propertyIds.includes(propertyId)) throw Error('PROPERTY_FORBIDDEN');
}
function conversation(state, conversationId) {
  const result = state.conversations?.[id(conversationId)];
  if (!result) throw Error('CONVERSATION_NOT_FOUND');
  return result;
}
function revision(current, expected) {
  if (!Number.isSafeInteger(expected) || expected !== current.version) throw Error('VERSION_CONFLICT');
}
function publicSheet(sheet) {
  const result = Object.fromEntries(['propertyId', 'name', 'unitId', 'rent', 'photos', 'included', 'excluded', 'additional', 'pending'].map(key => [key, sheet[key]]));
  // Legacy free-text descriptions were not reviewed for exact addresses. A new
  // client view must not copy them merely because the catalog is publicly readable.
  result.description = sheet.publicDescription || 'Consulta con tu asesor las características y la zona del inmueble.';
  return result;
}

function createAttentionService({store, readAvailability, leaseConfig = {}, now = () => new Date(), randomToken = () => randomBytes(32).toString('base64url'), invitationBaseUrl}) {
  if (!store || typeof readAvailability !== 'function') throw Error('DEPENDENCIES_REQUIRED');
  async function readSnapshot() {
    const snapshot = await readAvailability();
    const properties = snapshot.propiedades || snapshot.properties;
    if (!properties || !snapshot.observedAt) throw Error('AVAILABILITY_UNAVAILABLE');
    return {...snapshot, properties};
  }
  function event(state, principal, requestId, current, kind, summary, extra = {}) {
    const entry = {...prepareEntry({id: requestId, conversationId: current.id, interactionId: requestId,
      kind, summary, source: current.context.source, entryChannel: current.context.entryChannel,
      currentChannel: current.context.currentChannel, propertyId: current.context.currentPropertyId,
      occurredAt: now().toISOString(), ...extra}, {agentUid: current.agentUid || principal.uid, organizationId: principal.organizationId}, now()),
      actorUid: principal.uid, actorRole: principal.role};
    state.journal = {...state.journal, [requestId]: entry};
  }
  async function live(principal, propertyId) {
    permitted(principal, propertyId);
    const snapshot = await readSnapshot();
    if (!snapshot.properties?.[propertyId] || snapshot.properties[propertyId].activo === false) throw Error('PROPERTY_NOT_PUBLISHED');
    return snapshot;
  }
  async function resolveInvitation(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw Error('INVITATION_INVALID');
    const tokenHash = hash(token);
    const locator = await store.locateInvitation(tokenHash);
    if (!locator || Date.parse(locator.expiresAt) <= now().getTime()) throw Error('INVITATION_INVALID');
    const state = await store.read(id(locator.organizationId));
    const current = conversation(state, locator.conversationId);
    if (current.invitation?.tokenHash !== tokenHash || current.invitation.revoked || Date.parse(current.invitation.expiresAt) <= now().getTime()) throw Error('INVITATION_INVALID');
    return {state, current, tokenHash, organizationId: locator.organizationId};
  }
  function guestCredential(secret) {
    if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secret)) throw Error('GUEST_ACCESS_REQUIRED');
    const secretHash = hash(secret);
    return {secretHash, uid: 'guest_' + secretHash.slice(0, 40)};
  }
  function activeGuestInvitation(current, tokenHash) {
    const invitation = current.invitation;
    if (!invitation || invitation.accessMode !== 'hype_business_guest' || invitation.tokenHash !== tokenHash || invitation.revoked || Date.parse(invitation.expiresAt) <= now().getTime()) throw Error('INVITATION_INVALID');
    return invitation;
  }
  function guestAccess(current, tokenHash, credential) {
    const invitation = activeGuestInvitation(current, tokenHash);
    if (current.guestAccess?.secretHash !== credential.secretHash || current.guestAccess?.tokenHash !== tokenHash || current.guestAccess?.threadId !== invitation.threadId) throw Error('GUEST_ACCESS_REQUIRED');
    return invitation;
  }
  return {
    async catalog(principal) {
      agent(principal);
      const snapshot = await readSnapshot();
      return {observedAt: snapshot.observedAt, properties: Object.entries(snapshot.properties).filter(([propertyId, property]) => principal.propertyIds.includes(propertyId) && property.activo !== false)
        .map(([propertyId, property]) => lease.propertySheet(propertyId, property, leaseConfig))};
    },
    async capture(principal, input) {
      agent(principal);
      fields(input, ['requestId', 'displayName', 'surname', 'phone', 'source', 'entryChannel', 'propertyId', 'question']);
      const requestId = id(input.requestId);
      text(input.displayName, 180); text(input.surname, 180); text(input.question, 500);
      const snapshot = await live(principal, input.propertyId);
      const context = continuity.prepareContext(input, snapshot.properties);
      return store.apply(principal.organizationId, requestId, principal.uid, {operation: 'capture', input}, state => {
        const current = {id: requestId, agentUid: principal.uid, context, version: 1, status: 'open', createdAt: now().toISOString(), observedAt: snapshot.observedAt};
        state.conversations = {...state.conversations, [requestId]: current};
        event(state, principal, requestId, current, 'attention_started', 'Atención iniciada. Consulta: ' + context.question,
          {nextAction: {description: 'Responder consulta y proponer visita', status: 'pending'}});
        return {state, receipt: {conversationId: requestId, version: 1, status: 'captured'}};
      });
    },
    async list(principal) {
      agent(principal);
      const state = await store.read(principal.organizationId);
      return Object.values(state.conversations || {}).filter(item => principal.propertyIds.includes(item.context.currentPropertyId));
    },
    async inspect(principal, conversationId) {
      agent(principal);
      const state = await store.read(principal.organizationId);
      const current = conversation(state, conversationId);
      permitted(principal, current.context.currentPropertyId);
      const snapshot = await live(principal, current.context.currentPropertyId);
      return {conversation: current, sheet: lease.propertySheet(current.context.currentPropertyId, snapshot.properties[current.context.currentPropertyId], leaseConfig),
        observedAt: snapshot.observedAt, messages: Object.values(state.messages?.[conversationId] || {}),
        journal: Object.values(state.journal || {}).filter(item => item.conversationId === conversationId)};
    },
    async changeInterest(principal, input) {
      agent(principal); fields(input, ['requestId', 'conversationId', 'propertyId', 'expectedVersion']);
      const snapshot = await live(principal, input.propertyId);
      return store.apply(principal.organizationId, id(input.requestId), principal.uid, {operation: 'change_interest', input}, state => {
        const current = conversation(state, input.conversationId); permitted(principal, current.context.currentPropertyId); revision(current, input.expectedVersion);
        current.context = continuity.changeInterest(current.context, input.propertyId, snapshot.properties);
        current.version++;
        event(state, principal, input.requestId, current, 'interest_changed', 'Se actualizó el inmueble de interés; se conserva la fuente y el inmueble de origen.');
        return {state, receipt: {conversationId: current.id, version: current.version}};
      });
    },
    async updateContact(principal, input) {
      agent(principal); fields(input, ['requestId', 'conversationId', 'expectedVersion', 'displayName', 'surname', 'phone']);
      const displayName = text(input.displayName, 180), surname = text(input.surname, 180);
      const phone = input.phone ? continuity.normalizePhone(input.phone) : '';
      return store.apply(principal.organizationId, id(input.requestId), principal.uid, {operation: 'update_contact', input}, state => {
        const current = conversation(state, input.conversationId); permitted(principal, current.context.currentPropertyId); revision(current, input.expectedVersion);
        if (current.context.phone !== phone) {
          delete current.customerUid;
          current.invitation = {...current.invitation, revoked: true};
          current.context.identityStatus = 'unverified';
        }
        Object.assign(current.context, {displayName, surname, phone}); current.version++;
        event(state, principal, input.requestId, current, 'contact_updated', 'Datos de contacto actualizados por el asesor. Un cambio de teléfono requiere nueva verificación.');
        return {state, receipt: {conversationId: current.id, version: current.version}};
      });
    },
    async summarize(principal, input) {
      agent(principal); fields(input, ['requestId', 'conversationId', 'summary', 'facts', 'openQuestions', 'topics', 'nextAction', 'occurredAt']);
      text(input.summary, 1000, true);
      return store.apply(principal.organizationId, id(input.requestId), principal.uid, {operation: 'summarize', input}, state => {
        const current = conversation(state, input.conversationId); permitted(principal, current.context.currentPropertyId);
        event(state, principal, input.requestId, current, 'interaction_summary', input.summary,
          {facts: input.facts, openQuestions: input.openQuestions, topics: input.topics, nextAction: input.nextAction, occurredAt: input.occurredAt || null});
        return {state, receipt: {conversationId: current.id, status: 'recorded'}};
      });
    },
    async invite(principal, input) {
      agent(principal); fields(input, ['requestId', 'conversationId', 'expectedVersion']);
      const token = randomToken();
      const url = continuity.buildAttentionUrl(invitationBaseUrl, token);
      const tokenHash = hash(token);
      const expiresAt = new Date(now().getTime() + 24 * 60 * 60 * 1000).toISOString();
      // The locator alone grants nothing. If the organization transaction fails,
      // the private orphan is invalid because the conversation has no matching hash.
      await store.indexInvitation(tokenHash, {organizationId: principal.organizationId, conversationId: id(input.conversationId), expiresAt});
      const receipt = await store.apply(principal.organizationId, id(input.requestId), principal.uid, {operation: 'invite', input}, state => {
        const current = conversation(state, input.conversationId); permitted(principal, current.context.currentPropertyId); revision(current, input.expectedVersion);
        current.invitation = {tokenHash, expiresAt, revoked: false, accessMode: 'hype_business_guest', threadId: 'thread_' + tokenHash.slice(0, 32)};
        delete current.guestAccess;
        current.version++;
        event(state, principal, input.requestId, current, 'invitation_created', 'Se preparó un enlace temporal; el envío al cliente se realiza por el canal autorizado.');
        return {state, receipt: {conversationId: current.id, version: current.version, expiresAt}};
      });
      if (receipt.replayed) throw Error('INVITATION_REISSUE_REQUIRED');
      return {...receipt, url};
    },
    async revoke(principal, input) {
      agent(principal); fields(input, ['requestId', 'conversationId', 'expectedVersion']);
      return store.apply(principal.organizationId, id(input.requestId), principal.uid, {operation: 'revoke', input}, state => {
        const current = conversation(state, input.conversationId); permitted(principal, current.context.currentPropertyId); revision(current, input.expectedVersion);
        current.invitation = {...current.invitation, revoked: true}; current.version++;
        event(state, principal, input.requestId, current, 'invitation_revoked', 'Se revocó el enlace de atención.');
        return {state, receipt: {conversationId: current.id, version: current.version}};
      });
    },
    async shareConditions(principal, input) {
      agent(principal); fields(input, ['requestId', 'conversationId', 'expectedVersion']);
      const current = conversation(await store.read(principal.organizationId), input.conversationId);
      const snapshot = await live(principal, current.context.currentPropertyId);
      const packet = lease.sharePacket(lease.propertySheet(current.context.currentPropertyId, snapshot.properties[current.context.currentPropertyId], leaseConfig));
      return store.apply(principal.organizationId, id(input.requestId), principal.uid, {operation: 'share_conditions', input}, state => {
        const target = conversation(state, input.conversationId); permitted(principal, target.context.currentPropertyId); revision(target, input.expectedVersion);
        if (target.context.currentPropertyId !== packet.propertyId) throw Error('VERSION_CONFLICT');
        target.sharedConditions = packet; target.version++;
        event(state, principal, input.requestId, target, 'conditions_shared', 'Se habilitaron los requisitos y condiciones de esta unidad, versión ' + packet.conditionsVersion + '.');
        return {state, receipt: {conversationId: target.id, version: target.version}};
      });
    },
    async sendMessage(principal, input) {
      fields(input, ['requestId', 'conversationId', 'text', 'token', 'threadId']);
      const messageText = text(input.text, 2000, true);
      let organizationId;
      let resolved;
      if (principal?.role === 'agent') { agent(principal); organizationId = principal.organizationId; }
      else {
        if (principal?.role !== 'customer') throw Error('CUSTOMER_VERIFICATION_REQUIRED');
        resolved = await resolveInvitation(input.token); organizationId = resolved.organizationId;
        if (resolved.current.id !== input.conversationId || resolved.current.customerUid !== principal.uid) throw Error('CUSTOMER_VERIFICATION_REQUIRED');
      }
      if (principal?.role !== 'agent' && input.threadId) throw Error('INVALID_FIELDS');
      const threadId = input.threadId ? id(input.threadId) : null;
      const safePayload = {operation: 'message', conversationId: input.conversationId, text: messageText, ...(threadId ? {threadId} : {}), tokenHash: resolved?.tokenHash || null};
      return store.apply(organizationId, id(input.requestId), id(principal.uid), safePayload, state => {
        const current = conversation(state, input.conversationId);
        if (principal.role === 'agent') permitted(principal, current.context.currentPropertyId);
        else if (current.customerUid !== principal.uid || current.invitation?.tokenHash !== resolved.tokenHash || current.invitation.revoked || Date.parse(current.invitation.expiresAt) <= now().getTime()) throw Error('CUSTOMER_VERIFICATION_REQUIRED');
        if (threadId && activeGuestInvitation(current, current.invitation?.tokenHash).threadId !== threadId) throw Error('GUEST_ACCESS_REQUIRED');
        state.messages = {...state.messages, [current.id]: {...state.messages?.[current.id], [input.requestId]: {id: input.requestId, actorRole: principal.role, threadId, text: messageText, recordedAt: now().toISOString()}}};
        event(state, {...principal, organizationId}, input.requestId, current, 'message_recorded', 'Mensaje de ' + (principal.role === 'agent' ? 'asesor' : 'cliente') + ': ' + messageText,
          {nextAction: {description: principal.role === 'customer' ? 'Responder al cliente' : 'Esperar respuesta del cliente', status: 'pending'}});
        return {state, receipt: {conversationId: current.id, messageId: input.requestId, status: 'recorded'}};
      });
    },
    async previewInvitation(token) {
      const {current} = await resolveInvitation(token);
      const snapshot = await readSnapshot();
      const propertyId = current.context.currentPropertyId;
      const property = snapshot.properties?.[propertyId];
      if (!property || property.activo === false) throw Error('PROPERTY_NOT_PUBLISHED');
      // Only public property data. Never return the lead's name, phone, history,
      // journal, address/coordinates, org identifiers or invitation hash here.
      const guest = current.invitation.accessMode === 'hype_business_guest';
      return {sheet: publicSheet(lease.propertySheet(propertyId, property, leaseConfig)), verificationRequired: !guest, accessMode: guest ? 'hype_business_guest' : 'verified_phone'};
    },
    async openGuest(input) {
      fields(input, ['requestId', 'token', 'secret']);
      const resolved = await resolveInvitation(input.token), credential = guestCredential(input.secret);
      activeGuestInvitation(resolved.current, resolved.tokenHash);
      return store.apply(resolved.organizationId, id(input.requestId), credential.uid, {operation: 'guest_open', tokenHash: resolved.tokenHash, secretHash: credential.secretHash}, state => {
        const current = conversation(state, resolved.current.id);
        const invitation = activeGuestInvitation(current, resolved.tokenHash);
        if (current.guestAccess && (current.guestAccess.secretHash !== credential.secretHash || current.guestAccess.tokenHash !== resolved.tokenHash)) throw Error('GUEST_LINK_IN_USE');
        if (!current.guestAccess) {
          current.guestAccess = {secretHash: credential.secretHash, tokenHash: resolved.tokenHash, threadId: invitation.threadId, identityStatus: 'unverified', openedAt: now().toISOString()};
          current.version++;
          event(state, {uid: credential.uid, role: 'guest', organizationId: resolved.organizationId}, input.requestId, current, 'guest_connected', 'Se abrió una conversación de invitado por enlace de Synapse Attention by HYPE Business. Identidad sin verificar.');
        }
        return {state, receipt: {conversationId: current.id, threadId: invitation.threadId, identityStatus: 'unverified'}};
      });
    },
    async guestView(input) {
      fields(input, ['token', 'secret']);
      const {state, current, tokenHash} = await resolveInvitation(input.token);
      const invitation = guestAccess(current, tokenHash, guestCredential(input.secret));
      const snapshot = await readSnapshot(), propertyId = current.context.currentPropertyId;
      const property = snapshot.properties?.[propertyId];
      if (!property || property.activo === false) throw Error('PROPERTY_NOT_PUBLISHED');
      const sheet = lease.propertySheet(propertyId, property, leaseConfig);
      return {conversationId: current.id, threadId: invitation.threadId, identityStatus: 'unverified', expiresAt: invitation.expiresAt,
        sheet: publicSheet(sheet), messages: Object.values(state.messages?.[current.id] || {}).filter(item => item.threadId === invitation.threadId),
        conditions: current.sharedConditions?.propertyId === propertyId && current.sharedConditions?.conditionsVersion === sheet.conditionsVersion ? current.sharedConditions : null};
    },
    async guestMessage(input) {
      fields(input, ['requestId', 'token', 'secret', 'text']);
      const messageText = text(input.text, 2000, true);
      const resolved = await resolveInvitation(input.token), credential = guestCredential(input.secret);
      guestAccess(resolved.current, resolved.tokenHash, credential);
      return store.apply(resolved.organizationId, id(input.requestId), credential.uid, {operation: 'guest_message', tokenHash: resolved.tokenHash, secretHash: credential.secretHash, text: messageText}, state => {
        const current = conversation(state, resolved.current.id);
        const invitation = guestAccess(current, resolved.tokenHash, credential);
        state.messages = {...state.messages, [current.id]: {...state.messages?.[current.id], [input.requestId]: {
          id: input.requestId, actorRole: 'guest', threadId: invitation.threadId, text: messageText, recordedAt: now().toISOString()}}};
        event(state, {uid: credential.uid, role: 'guest', organizationId: resolved.organizationId}, input.requestId, current, 'message_recorded', 'Mensaje de invitado: ' + messageText,
          {nextAction: {description: 'Responder al invitado', status: 'pending'}});
        return {state, receipt: {conversationId: current.id, messageId: input.requestId, status: 'recorded'}};
      });
    },
    async claim(principal, input) {
      fields(input, ['requestId', 'token']);
      if (principal?.role !== 'customer' || !principal.verifiedPhone) throw Error('CUSTOMER_VERIFICATION_REQUIRED');
      const resolved = await resolveInvitation(input.token);
      const phone = continuity.normalizePhone(principal.verifiedPhone);
      if (!resolved.current.context.phone || resolved.current.context.phone !== phone) throw Error('CUSTOMER_VERIFICATION_REQUIRED');
      return store.apply(resolved.organizationId, id(input.requestId), id(principal.uid), {operation: 'claim', tokenHash: resolved.tokenHash}, state => {
        const current = conversation(state, resolved.current.id);
        if (current.invitation?.tokenHash !== resolved.tokenHash || current.invitation.revoked || Date.parse(current.invitation.expiresAt) <= now().getTime()) throw Error('INVITATION_INVALID');
        if (current.context.phone !== phone || (current.customerUid && current.customerUid !== principal.uid)) throw Error('CUSTOMER_VERIFICATION_REQUIRED');
        current.customerUid = principal.uid; current.context.identityStatus = 'contact_verified'; current.version++;
        event(state, {...principal, organizationId: resolved.organizationId}, input.requestId, current, 'contact_verified', 'Titularidad del teléfono verificada para acceder a la atención; no equivale a validar identidad documental.');
        return {state, receipt: {conversationId: current.id, version: current.version, status: 'claimed'}};
      });
    },
    async customerView(principal, token) {
      const {state, current} = await resolveInvitation(token);
      if (principal?.role !== 'customer' || current.customerUid !== principal.uid) throw Error('CUSTOMER_VERIFICATION_REQUIRED');
      const snapshot = await readSnapshot();
      const propertyId = current.context.currentPropertyId;
      if (!snapshot.properties?.[propertyId] || snapshot.properties[propertyId].activo === false) throw Error('PROPERTY_NOT_PUBLISHED');
      const sheet = lease.propertySheet(propertyId, snapshot.properties[propertyId], leaseConfig);
      return {conversationId: current.id, sheet: publicSheet(sheet), messages: Object.values(state.messages?.[current.id] || {}).filter(item => !item.threadId),
        conditions: current.sharedConditions?.propertyId === propertyId && current.sharedConditions?.conditionsVersion === sheet.conditionsVersion ? current.sharedConditions : null};
    },
    async report(principal, date) {
      agent(principal);
      const state = await store.read(principal.organizationId);
      return dailyReport(Object.values(state.journal || {}).filter(item => principal.propertyIds.includes(item.propertyId) && principal.propertyIds.includes(state.conversations?.[item.conversationId]?.context.currentPropertyId)), date);
    }
  };
}
module.exports = {createAttentionService};
