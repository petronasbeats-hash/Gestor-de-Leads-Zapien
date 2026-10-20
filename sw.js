/* Synapse PWA V1: network-only; no cache of customer data, sessions, Firebase or documents. */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
/* Deliberately no fetch handler and no CacheStorage usage. */
