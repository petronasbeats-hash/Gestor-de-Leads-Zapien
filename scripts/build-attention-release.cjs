'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--site', '--legacy-root', '--out', '--attention-origin'].includes(argv[i]) || !argv[i + 1] || result[argv[i]]) throw Error('USAGE: --site SITE --legacy-root PATH --out NEW_PATH [--attention-origin HTTPS_ORIGIN]');
    result[argv[i]] = argv[i + 1];
  }
  if (!['--site', '--legacy-root', '--out'].every(key => result[key])) throw Error('SITE_LEGACY_ROOT_AND_NEW_OUTPUT_REQUIRED');
  return result;
}
function build(options) {
  const site = options['--site'], legacy = path.resolve(options['--legacy-root']), output = path.resolve(options['--out']);
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(site)) throw Error('INVALID_SITE');
  const reservationOrigin = 'https://' + site + '.web.app';
  const attentionOrigin = options['--attention-origin'] || reservationOrigin;
  let origin;
  try {origin = new URL(attentionOrigin);} catch {throw Error('INVALID_ATTENTION_ORIGIN');}
  const hostname = origin.hostname;
  const preview = hostname.startsWith(site + '--') && hostname.endsWith('.web.app')
    && /^[a-z0-9-]+$/.test(hostname.slice(site.length + 2, -'.web.app'.length));
  if (origin.protocol !== 'https:' || origin.origin !== attentionOrigin || origin.port || (hostname !== site + '.web.app' && !preview)) throw Error('INVALID_ATTENTION_ORIGIN');
  if (fs.existsSync(output)) throw Error('OUTPUT_ALREADY_EXISTS_USE_A_NEW_PATH');
  const html = fs.readFileSync(path.join(root, 'reservar.html'), 'utf8');
  const literal = html.match(/const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
  if (!literal) throw Error('FIREBASE_WEB_CONFIG_NOT_FOUND');
  const firebase = JSON.parse(literal[1].replace(/([{,])\s*([A-Za-z]\w*)\s*:/g, '$1"$2":').replace(/,\s*}/g, '}'));
  if (!firebase.apiKey || !firebase.appId || !/^[a-z0-9-]+$/.test(firebase.projectId) || !/^https:\/\/[a-z0-9.-]+\/(?:$)/.test(firebase.databaseURL + (firebase.databaseURL.endsWith('/') ? '' : '/'))) throw Error('INVALID_FIREBASE_WEB_CONFIG');
  // This is a full Hosting release. Required current dependencies must be present;
  // an incomplete ZIP must never silently replace the live site.
  for (const item of ['404.html', 'leia.html', 'assets/js/reprogramar-ui.v1.js']) {
    if (!fs.existsSync(path.join(legacy, item))) throw Error('LEGACY_DEPENDENCY_MISSING: ' + item);
  }
  const files = [];
  function write(relative, content) {
    const target = path.join(output, relative); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, content);
    files.push({path: relative, sha256: createHash('sha256').update(content).digest('hex')});
  }
  function copy(source, relative) {if (fs.lstatSync(source).isSymbolicLink()) throw Error('SYMLINK_NOT_ALLOWED'); write(relative, fs.readFileSync(source));}
  for (const item of ['agenda.html', 'reservar.html', 'atencion.html', 'atencion-operador.html', 'workspace.html', 'shared/workspace-model.js', 'shared/workspace-store.js', 'web/workspace/workspace.js', 'web/workspace/workspace.css', 'shared/reservation-reference.js', 'shared/attention-quick-replies.js', 'shared/attention-alerts.js', 'web/attention/attention.js', 'web/attention/attention.css']) copy(path.join(root, item), 'public/' + item);
  copy(path.join(root, 'workspace.html'), 'public/index.html');
  copy(path.join(root, 'index.html'), 'public/administracion.html');
  copy(path.join(root, 'shared/workspace-radar.js'), 'public/shared/workspace-radar.js');
  for (const item of ['404.html', 'leia.html']) copy(path.join(legacy, item), 'public/' + item);
  function assets(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.name.startsWith('.') || /secret|credential|service.?account|backup|\.bak/i.test(entry.name)) continue;
      const source = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('SYMLINK_NOT_ALLOWED');
      if (entry.isDirectory()) assets(source);
      else if (/\.(?:js|css|png|jpe?g|svg|webp|ico|woff2?|ttf|otf|webmanifest)$/i.test(entry.name)) copy(source, 'public/' + path.relative(legacy, source));
    }
  }
  assets(path.join(legacy, 'assets'));
  copy(path.join(root, 'shared/public-slot-claim.js'), 'public/shared/public-slot-claim.js');
  copy(path.join(root, 'assets/audio/synapse-nexo-v1.wav'), 'public/assets/audio/synapse-nexo-v1.wav');
  write('public/web/attention/config.js', 'window.SYNAPSE_ATTENTION_CONFIG = ' + JSON.stringify({firebase, reservationOrigin}) + ';\n');
  for (const item of ['index.cjs', 'package.json', 'package-lock.json']) copy(path.join(root, 'attention-functions', item), 'functions/' + item);
  for (const item of ['attention-store.cjs', 'attention-service.cjs', 'attention-firebase-authority.cjs', 'attention-http.cjs', 'attention-journal.cjs', 'live-availability-reader.cjs']) copy(path.join(root, 'server', item), 'functions/server/' + item);
  copy(path.join(root, 'shared/lease-continuity.js'), 'functions/shared/lease-continuity.js');
  copy(path.join(root, 'shared/attention-alerts.js'), 'functions/shared/attention-alerts.js');
  copy(path.join(root, 'lab/attention/continuity-contract.js'), 'functions/lab/attention/continuity-contract.js');
  copy(path.join(root, 'lab/attention/fixtures/lease-config.json'), 'functions/config/lease.json');
  write('functions/.env.' + firebase.projectId, 'ATTENTION_PUBLIC_ORIGIN=' + attentionOrigin + '\nATTENTION_DATABASE_URL=' + firebase.databaseURL + '\n');
  write('firebase.json', JSON.stringify({functions: [{source: 'functions', codebase: 'synapse-attention', ignore: ['node_modules', '.git', '*debug.log']}], hosting: {site, public: 'public', ignore: ['**/.*'], rewrites: [
    {source: '/attention-api/**', function: {functionId: 'attentionApi', region: 'us-central1'}},
    {source: '/atencion-operador', destination: '/atencion-operador.html'},
    {source: '/atencion', destination: '/atencion.html'},
    {source: '/contactos', destination: '/workspace.html'},
    {source: '/directorio', destination: '/workspace.html'},
    {source: '/radar', destination: '/workspace.html'},
    {source: '/operaciones', destination: '/workspace.html'},
    {source: '/administracion', destination: '/administracion.html'},
    {source: '/agenda', destination: '/workspace.html'},
    {source: '/reservar', destination: '/reservar.html'},
    {source: '/leia', destination: '/leia.html'}]}}, null, 2) + '\n');
  write('release-manifest.json', JSON.stringify({site, projectId: firebase.projectId, attentionOrigin, reservationOrigin, capabilities: {intake: true, conversation: true, guestConversation: true, messageAlerts: true, contacts: true, directory: true, actionRadar: true, operations: true, actionPipelines: true, internalAgenda: true, hypeProfiles: false, booking: false, automaticReminders: false, leasePreparation: false}, files}, null, 2) + '\n');
  return {output, site, projectId: firebase.projectId, attentionOrigin, reservationOrigin, files: files.length};
}
if (require.main === module) {try {console.log(JSON.stringify(build(args(process.argv.slice(2))), null, 2));} catch (error) {console.error(error.message); process.exitCode = 1;}}
module.exports = {build};
