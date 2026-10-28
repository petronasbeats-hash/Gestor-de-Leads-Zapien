'use strict';
const {onRequest} = require('firebase-functions/v2/https');
const {defineString} = require('firebase-functions/params');
const {initializeApp, getApps} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getDatabase} = require('firebase-admin/database');
const {createAttentionStore} = require('./server/attention-store.cjs');
const {createAttentionService} = require('./server/attention-service.cjs');
const {createFirebaseAuthority} = require('./server/attention-firebase-authority.cjs');
const {createAttentionHttp} = require('./server/attention-http.cjs');
const {createLiveAvailabilityReader} = require('./server/live-availability-reader.cjs');
const leaseConfig = require('./config/lease.json');
const origin = defineString('ATTENTION_PUBLIC_ORIGIN');
const databaseUrl = defineString('ATTENTION_DATABASE_URL');
let handler;
exports.attentionApi = onRequest({region: 'us-central1', minInstances: 0, maxInstances: 3, timeoutSeconds: 30}, async (req, res) => {
  if (!handler) {
    const app = getApps()[0] || initializeApp({databaseURL: databaseUrl.value()});
    const db = getDatabase(app);
    handler = createAttentionHttp({
      authority: createFirebaseAuthority({auth: getAuth(app), db}),
      service: createAttentionService({store: createAttentionStore(db), leaseConfig, invitationBaseUrl: origin.value(),
        readAgendaEvent: async eventId => (await db.ref('citas/' + eventId).get()).val(),
        readAvailability: createLiveAvailabilityReader({readValue: async path => (await db.ref(path).get()).val()})})
    });
  }
  return handler(req, res);
});
