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
    const entry={path:relative,sha256:createHash('sha256').update(content).digest('hex')},existing=files.findIndex(file=>file.path===relative);if(existing<0)files.push(entry);else files[existing]=entry;
  }
  function copy(source, relative) {if (fs.lstatSync(source).isSymbolicLink()) throw Error('SYMLINK_NOT_ALLOWED'); write(relative, fs.readFileSync(source));}
  for (const item of ['destaca.html', 'shared/destaca-model.js', 'web/destaca/destaca.js', 'web/workspace/action-sources.js', 'territorio.html', 'shared/territory-model.js', 'web/territory/local-drafts.js', 'web/territory/territory.js', 'web/territory/territory.css', 'agenda.html', 'reservar.html', 'atencion.html', 'atencion-operador.html', 'workspace.html', 'shared/property-inventory.js', 'shared/workspace-model.js', 'shared/workspace-store.js', 'shared/visit-availability.js', 'shared/weekly-hours.js', 'web/agenda/weekly-hours.js', 'web/agenda/weekly-hours.css', 'shared/attention-booking.js', 'web/attention/booking.js', 'web/workspace/workspace.js', 'web/workspace/workspace.css', 'web/shell/navigation.js', 'web/shell/navigation.css', 'web/shell/admin-navigation.js', 'web/reservar/experience.css', 'web/reservar/experience.js', 'web/theme/theme-engine.js', 'web/theme/theme.css', 'shared/lease-continuity.js', 'shared/reservation-reference.js', 'shared/attention-quick-replies.js', 'shared/attention-alerts.js', 'web/attention/attention.js', 'web/attention/attention.css']) copy(path.join(root, item), 'public/' + item);
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
  const publicTerms=JSON.parse(fs.readFileSync(path.join(root,'lab/attention/fixtures/lease-config.json'),'utf8'));
  for(const term of [...(publicTerms.profiles||[]),...Object.values(publicTerms.properties||{})])delete term.source;
  write('public/web/reservar/terms.js','window.SYNAPSE_PUBLIC_TERMS = '+JSON.stringify(publicTerms)+';\n');
  write('public/web/attention/config.js', 'window.SYNAPSE_ATTENTION_CONFIG = ' + JSON.stringify({firebase, reservationOrigin}) + ';\n');
  for (const item of ['index.cjs', 'package.json', 'package-lock.json']) copy(path.join(root, 'attention-functions', item), 'functions/' + item);
  for (const item of ['destaca-service.cjs', 'territory-service.cjs', 'attention-store.cjs', 'attention-service.cjs', 'attention-firebase-authority.cjs', 'attention-http.cjs', 'attention-journal.cjs', 'live-availability-reader.cjs']) copy(path.join(root, 'server', item), 'functions/server/' + item);
  copy(path.join(root, 'shared/lease-continuity.js'), 'functions/shared/lease-continuity.js');
  copy(path.join(root, 'shared/attention-alerts.js'), 'functions/shared/attention-alerts.js');
  copy(path.join(root, 'shared/territory-model.js'), 'functions/shared/territory-model.js');
  copy(path.join(root, 'shared/destaca-model.js'), 'functions/shared/destaca-model.js');
  copy(path.join(root, 'lab/attention/continuity-contract.js'), 'functions/lab/attention/continuity-contract.js');
  copy(path.join(root, 'lab/attention/fixtures/lease-config.json'), 'functions/config/lease.json');
  write('functions/.env.' + firebase.projectId, 'ATTENTION_PUBLIC_ORIGIN=' + attentionOrigin + '\nATTENTION_DATABASE_URL=' + firebase.databaseURL + '\n');
  // Asset versions travel with each HTML page, preventing a fresh screen from
  // running an older cached bundle after a Hosting release.
  for(const file of files.filter(file=>file.path.startsWith('public/')&&file.path.endsWith('.html'))){
    const original=fs.readFileSync(path.join(output,file.path),'utf8');
    const versioned=original.replace(/(src|href)=(["'])([^"']+)\2/g,(attribute,key,quote,value)=>{
      if(/^(?:[a-z]+:|\/\/)/i.test(value))return attribute;
      const url=new URL(value,'https://synapse-release.invalid/'+file.path.slice(7));
      if(!/\.(?:js|css)$/.test(url.pathname))return attribute;
      const base=path.join(output,'public'),local=path.resolve(base,'.'+url.pathname);
      if(!local.startsWith(base+path.sep)||!fs.existsSync(local)||!fs.statSync(local).isFile())return attribute;
      url.searchParams.set('v',createHash('sha256').update(fs.readFileSync(local)).digest('hex').slice(0,16));
      const pathname=value.startsWith('/')?url.pathname:url.pathname.slice(1);
      return key+'='+quote+pathname+url.search+url.hash+quote;
    });
    if(versioned!==original)write(file.path,versioned);
  }
  write('firebase.json', JSON.stringify({functions: [{source: 'functions', codebase: 'synapse-attention', ignore: ['node_modules', '.git', '*debug.log']}], hosting: {site, public: 'public', ignore: ['**/.*'], headers: [{source:'**',headers:[{key:'Cache-Control',value:'no-cache, max-age=0, must-revalidate'}]}], rewrites: [
    {source: '/attention-api/**', function: {functionId: 'attentionApi', region: 'us-central1'}},
    {source: '/atencion-operador', destination: '/atencion-operador.html'},
    {source: '/atencion', destination: '/atencion.html'},
    {source: '/territorio', destination: '/territorio.html'},
    {source: '/destaca', destination: '/destaca.html'},
    {source: '/contactos', destination: '/workspace.html'},
    {source: '/directorio', destination: '/workspace.html'},
    {source: '/radar', destination: '/workspace.html'},
    {source: '/operaciones', destination: '/workspace.html'},
    {source: '/administracion', destination: '/administracion.html'},
    {source: '/configuracion', destination: '/administracion.html'},
    {source: '/inmuebles', destination: '/administracion.html'},
    {source: '/agenda/horarios', destination: '/administracion.html'},
    {source: '/agenda', destination: '/workspace.html'},
    {source: '/reservar', destination: '/reservar.html'},
    {source: '/leia', destination: '/leia.html'}]}}, null, 2) + '\n');
  write('release-manifest.json', JSON.stringify({site, projectId: firebase.projectId, attentionOrigin, reservationOrigin, capabilities: {destaca: true, destacaBenefits: false, destacaRadar: true, territoryRadar: true, territoryActionClosure: true, territory: true, territoryOfflineDrafts: true, territoryPrivatePhotos: false, intake: true, conversation: true, guestConversation: true, messageAlerts: true, contacts: true, directory: true, actionRadar: true, themeEngine: true, operatorVisitRegistration: true, operations: true, actionPipelines: true, internalAgenda: true, hypeProfiles: false, booking: false, automaticReminders: false, leasePreparation: false}, files}, null, 2) + '\n');
  return {output, site, projectId: firebase.projectId, attentionOrigin, reservationOrigin, files: files.length};
}
if (require.main === module) {try {console.log(JSON.stringify(build(args(process.argv.slice(2))), null, 2));} catch (error) {console.error(error.message); process.exitCode = 1;}}
module.exports = {build};
