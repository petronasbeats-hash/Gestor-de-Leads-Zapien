'use strict';
const knownErrors = new Set(['INVALID_IDENTIFIER', 'INVALID_FIELDS', 'INVALID_TEXT', 'PHONE_REQUIRED', 'PHONE_INVALID', 'NAME_REQUIRED', 'SOURCE_REQUIRED', 'ENTRY_CHANNEL_REQUIRED', 'PROPERTY_NOT_PUBLISHED', 'PROPERTY_FORBIDDEN', 'AUTHENTICATION_REQUIRED', 'ORGANIZATION_FORBIDDEN', 'AGENT_REQUIRED', 'CONVERSATION_NOT_FOUND', 'VERSION_CONFLICT', 'COMMAND_ID_CONFLICT', 'INVITATION_INVALID', 'INVITATION_REISSUE_REQUIRED', 'CUSTOMER_VERIFICATION_REQUIRED', 'CONDITIONS_NOT_CONFIGURED', 'AVAILABILITY_UNAVAILABLE', 'GUEST_ACCESS_REQUIRED', 'GUEST_LINK_IN_USE', 'BOOKING_NOT_AVAILABLE', 'BOOKING_REFERENCE_CONFLICT', 'BOOKING_NOT_READY']);
function createAttentionHttp({service, authority, territoryService, destacaService}) {
  return async function attentionHttp(req, res) {
    const reply = (status, payload) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify(payload));
    };
    const path = new URL(req.url, 'https://localhost').pathname.replace(/^\/attention-api(?=\/)/, '');
    if (req.method === 'GET' && path === '/health') return reply(200, {service: 'synapse-attention', intake: true, guestConversation: true, messageAlerts: true, operatorVisitRegistration: true, territory: Boolean(territoryService), territoryPrivatePhotos: false, territoryRadar: Boolean(territoryService), territoryActionClosure: Boolean(territoryService), destaca: Boolean(destacaService), destacaBenefits: false, hypeProfiles: false, booking: false, reminders: false});
    if (req.method === 'GET' && path === '/agent/session') {
      try { return reply(200, await authority.session(req.headers.authorization)); }
      catch { return reply(401, {error: 'AUTHENTICATION_REQUIRED'}); }
    }
    if (req.method !== 'POST') return reply(405, {error: 'METHOD_NOT_ALLOWED'});
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return reply(415, {error: 'JSON_REQUIRED'});
    try {
      let raw;
      if (Buffer.isBuffer(req.rawBody)) raw = req.rawBody;
      else {
        const chunks = []; let bytes = 0;
        for await (const chunk of req) {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 16384) return reply(413, {error: 'BODY_TOO_LARGE'});
          chunks.push(Buffer.from(chunk));
        }
        raw = Buffer.concat(chunks);
      }
      if (raw.length > 16384) return reply(413, {error: 'BODY_TOO_LARGE'});
      let body;
      try { body = JSON.parse(raw.toString('utf8')); } catch { return reply(400, {error: 'JSON_INVALID'}); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, {error: 'INVALID_FIELDS'});
      const bearer = req.headers.authorization;
      if (path === '/invitation/preview') {
        if (Object.keys(body).some(key => key !== 'token')) throw Error('INVALID_FIELDS');
        return reply(200, await service.previewInvitation(body.token));
      }
      if (path === '/guest/open') return reply(200, await service.openGuest(body));
      if (path === '/guest/view') return reply(200, await service.guestView(body));
      if (path === '/guest/message') return reply(200, await service.guestMessage(body));
      if (path === '/customer/claim') return reply(200, await service.claim(await authority.customer(bearer), body));
      if (path === '/customer/view') {
        if (Object.keys(body).some(key => key !== 'token')) throw Error('INVALID_FIELDS');
        return reply(200, await service.customerView(await authority.customer(bearer), body.token));
      }
      if (path === '/customer/message') return reply(200, await service.sendMessage(await authority.customer(bearer), body));
      if(path.startsWith('/agent/destaca/')){
        const methods={'/agent/destaca/list':'list','/agent/destaca/save':'save','/agent/destaca/pending':'pending'};
        if(!methods[path])return reply(404,{error:'NOT_FOUND'});
        if(!destacaService)return reply(503,{error:'DESTACA_NOT_CONNECTED'});
        const {organizationId,...input}=body;
        return reply(200,await destacaService[methods[path]](await authority.agent(bearer,organizationId),input));
      }
      if (path.startsWith('/agent/territory/')) {
        const methods = {'/agent/territory/list':'list','/agent/territory/save':'save','/agent/territory/properties':'properties','/agent/territory/pending':'pending','/agent/territory/complete-action':'completeAction'};
        if (!methods[path]) return reply(404, {error:'NOT_FOUND'});
        if (!territoryService) return reply(503, {error:'TERRITORY_NOT_CONNECTED'});
        const {organizationId,...input}=body;
        const principal=await authority.agent(bearer,organizationId);
        return reply(200,await territoryService[methods[path]](principal,input));
      }
      const routes = {
        '/agent/catalog': (principal, input) => { if (Object.keys(input).length) throw Error('INVALID_FIELDS'); return service.catalog(principal); },
        '/agent/list': (principal, input) => { if (Object.keys(input).length) throw Error('INVALID_FIELDS'); return service.list(principal); },
        '/agent/inspect': (principal, input) => { if (Object.keys(input).some(key => key !== 'conversationId')) throw Error('INVALID_FIELDS'); return service.inspect(principal, input.conversationId); },
        '/agent/capture': service.capture,
        '/agent/interest': service.changeInterest,
        '/agent/visit': service.recordVisit,
        '/agent/contact': service.updateContact,
        '/agent/summary': service.summarize,
        '/agent/invite': service.invite,
        '/agent/revoke': service.revoke,
        '/agent/conditions': service.shareConditions,
        '/agent/message': service.sendMessage,
        '/agent/report': (principal, input) => { if (Object.keys(input).some(key => key !== 'date')) throw Error('INVALID_FIELDS'); return service.report(principal, input.date); }
      };
      if (!routes[path]) return reply(404, {error: 'NOT_FOUND'});
      const {organizationId, ...input} = body;
      const principal = await authority.agent(bearer, organizationId);
      return reply(200, await routes[path](principal, input));
    } catch (error) {
      const code = error.message;
      const destacaError=/^DESTACA_(INVALID_ID|INVALID_TEXT|INVALID_CHOICE|INVALID_DATE|INVALID_PHONE|INVALID_RECORD|RECOMMENDER_REQUIRED|CONTACT_PERMISSION_REQUIRED|RESULT_REQUIRED|INVALID_FOLIO|VERSION_CONFLICT|COMMAND_CONFLICT|SCOPE_FORBIDDEN)$/.test(code);
      const territoryError = /^TERRITORY_(INVALID_ID|INVALID_TEXT|INVALID_CHOICE|INVALID_DATE|INVALID_LOCATION|LOCATION_REVIEW_REQUIRED|INVALID_PHONE|PHOTOS_LIMIT|PUBLICATION_REVIEW_REQUIRED|LINK_REQUIRED|INVALID_CAPTURE|VERSION_CONFLICT|COMMAND_CONFLICT|SCOPE_FORBIDDEN|ACTION_RESULT_REQUIRED|ACTION_RESOLUTION_REQUIRED|ACTION_NOT_PENDING)$/.test(code);
      const status = code === 'AUTHENTICATION_REQUIRED' ? 401
        : /FORBIDDEN|AGENT_REQUIRED|CUSTOMER_VERIFICATION_REQUIRED|GUEST_ACCESS_REQUIRED/.test(code) ? 403
        : /CONFLICT|REISSUE|GUEST_LINK_IN_USE/.test(code) ? 409
        : code === 'CONVERSATION_NOT_FOUND' || code === 'INVITATION_INVALID' ? 404
        : knownErrors.has(code) || territoryError || destacaError ? 400 : 503;
      return reply(status, {error: knownErrors.has(code) || territoryError || destacaError ? code : 'SERVICE_UNAVAILABLE'});
    }
  };
}
module.exports = {createAttentionHttp};
