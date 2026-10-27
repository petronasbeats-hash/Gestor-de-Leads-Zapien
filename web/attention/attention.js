'use strict';
(() => {
  const $ = name => document.getElementById(name);
  const role = document.body.dataset.role;
  const config = window.SYNAPSE_ATTENTION_CONFIG;
  const pending = new Map();
  let auth, active, catalog = [], busy = false, confirmation, verifier;
  const token = role === 'customer' ? location.hash.slice(1) : '';
  const sourceNames = {marketplace_facebook: 'Marketplace Facebook', facebook: 'Facebook', whatsapp: 'WhatsApp', casa_login: 'Casa Login', hype_synapse_experience: 'HYPE by Synapse Experience', directa: 'Directa'};
  const errors = {
    AUTHENTICATION_REQUIRED: 'Inicia sesión de nuevo para continuar.', ORGANIZATION_FORBIDDEN: 'Tu cuenta no tiene acceso a esta organización.',
    PROPERTY_FORBIDDEN: 'El inmueble está fuera de tu acceso autorizado.', PROPERTY_NOT_PUBLISHED: 'Esta publicación ya no está activa. Actualiza el catálogo.',
    VERSION_CONFLICT: 'La atención cambió. Actualiza antes de continuar.', COMMAND_ID_CONFLICT: 'Esta operación ya tiene otros datos. Actualiza la atención.',
    INVITATION_INVALID: 'El enlace venció o fue revocado. Solicita uno nuevo a tu asesor.',
    INVITATION_REISSUE_REQUIRED: 'El enlace anterior se creó, pero no se recuperó. Actualiza y crea otro enlace.',
    CUSTOMER_VERIFICATION_REQUIRED: 'No se pudo verificar el acceso. Usa el teléfono que compartiste con tu asesor.',
    CONDITIONS_NOT_CONFIGURED: 'Los requisitos de este inmueble todavía están por confirmar.',
    SERVICE_UNAVAILABLE: 'El servicio no está disponible. Tus datos permanecen en el formulario; vuelve a intentarlo.',
    PHONE_INVALID: 'Escribe un teléfono mexicano de diez dígitos.', PHONE_REQUIRED: 'Revisa el teléfono.',
    'auth/operation-not-allowed': 'Este método de acceso aún no está habilitado. Contacta a tu asesor.',
    'auth/invalid-verification-code': 'El código no es correcto. Revísalo e intenta de nuevo.',
    'auth/invalid-phone-number': 'Revisa el teléfono, incluido el código +52.',
    'auth/invalid-credential': 'No se pudo iniciar sesión. Revisa tu correo y contraseña.',
    'auth/unauthorized-domain': 'Este dominio todavía no está autorizado para iniciar sesión.'
  };
  function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
  async function run(action) {
    if (busy) return;
    busy = true;
    const controls = [...document.querySelectorAll('button,select')].map(element => [element, element.disabled]);
    controls.forEach(([element]) => {element.disabled = true;});
    try { await action(); } catch (error) { status(errors[error.code || error.message] || 'No se pudo completar la acción. Conserva tus datos y vuelve a intentarlo.', true); }
    finally {busy = false; controls.forEach(([element, disabled]) => {element.disabled = disabled;});}
  }
  async function api(path, data, authenticated = true) {
    const headers = {'Content-Type': 'application/json'};
    const user = auth.currentUser;
    if (authenticated) {
      if (!user) throw Error('AUTHENTICATION_REQUIRED');
      headers.Authorization = 'Bearer ' + await user.getIdToken();
    }
    const response = await fetch('/attention-api' + path, {method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer'});
    const result = await response.json();
    if (authenticated && auth.currentUser?.uid !== user.uid) throw Error('AUTHENTICATION_REQUIRED');
    if (!response.ok) throw Error(result.error || 'SERVICE_UNAVAILABLE');
    return result;
  }
  const agentApi = (path, data = {}) => api('/agent/' + path, {organizationId: $('organization').value, ...data});
  async function command(path, data, customer = false) {
    const body = customer ? data : {organizationId: $('organization').value, ...data};
    const signature = path + JSON.stringify({...body, ...(body.occurredAt ? {occurredAt: 'current-interaction'} : {})});
    if (!pending.has(signature)) pending.set(signature, {...body, requestId: crypto.randomUUID()});
    const result = await api(path, pending.get(signature));
    pending.delete(signature);
    return result;
  }
  function options(element, values) {
    const previous = element.value; element.replaceChildren();
    values.forEach(item => {const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; element.append(option);});
    if (values.some(item => item.id === previous)) element.value = previous;
  }
  function node(tag, text, className) {const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item;}
  function renderSheet(sheet) {
    const root = $('sheet'); root.replaceChildren(node('h2', sheet.name), node('div', new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN', maximumFractionDigits: 0}).format(sheet.rent) + ' / mes', 'price'), node('p', sheet.description || 'Consulta con tu asesor los detalles del inmueble.'));
    if (sheet.photos.length) {
      const gallery = node('div', '', 'photos');
      sheet.photos.forEach(url => {const image = document.createElement('img'); image.src = url; image.alt = 'Fotografía publicada de ' + sheet.name; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => image.remove()); gallery.append(image);}); root.append(gallery);
    }
    for (const [key, label] of [['included', 'Incluye'], ['excluded', 'No incluye'], ['additional', 'Cargos adicionales'], ['pending', 'Por confirmar']]) {
      if (!sheet[key]?.length) continue;
      root.append(node('h3', label)); const list = node('ul', '', 'list'); sheet[key].forEach(text => list.append(node('li', text))); root.append(list);
    }
    const url = new URL('/reservar', config.reservationOrigin);
    if (sheet.unitId) url.searchParams.set('unidad', sheet.unitId);
    $('reserve-link').href = url.toString(); $('reserve-link').hidden = false;
  }
  function renderMessages(messages) {
    const root = $('messages'); root.replaceChildren();
    messages.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).forEach(message => {
      const item = node('div', '', 'message ' + message.actorRole);
      item.append(node('small', (message.actorRole === 'agent' ? 'Asesor' : 'Cliente') + ' · ' + new Date(message.recordedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'})), node('div', message.text)); root.append(item);
    });
  }
  async function list() {
    const items = await agentApi('list'); $('conversations').replaceChildren();
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(item => {
      const button = node('button', (item.context.displayName || 'Nombre pendiente') + ' · ' + (sourceNames[item.context.source] || item.context.source), 'conversation' + (active?.conversation.id === item.id ? ' selected' : ''));
      button.addEventListener('click', () => run(() => inspect(item.id))); $('conversations').append(button);
    });
    if (!items.length) $('conversations').append(node('p', 'Todavía no hay atenciones registradas.', 'muted'));
  }
  async function inspect(conversationId) {
    active = await agentApi('inspect', {conversationId});
    const current = active.conversation;
    $('detail').hidden = false; $('customer-title').textContent = [current.context.displayName, current.context.surname].filter(Boolean).join(' ') || 'Nombre pendiente';
    $('attribution').textContent = (sourceNames[current.context.source] || current.context.source) + ' · Entrada: ' + current.context.entryChannel + ' · Canal actual: Synapse Atención';
    $('interest').value = current.context.currentPropertyId;
    $('contact-name').value = current.context.displayName; $('contact-surname').value = current.context.surname; $('contact-phone').value = current.context.phone;
    renderSheet(active.sheet); renderMessages(active.messages);
    $('observed').textContent = 'Catálogo consultado: ' + new Date(active.observedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'});
    $('journal').replaceChildren(); active.journal.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).forEach(entry => $('journal').append(node('div', entry.summary + (entry.nextAction ? '\nSiguiente acción: ' + entry.nextAction.description : ''), 'journal')));
    $('faq').replaceChildren();
    const sheet = active.sheet;
    const templates = {
      '¿Sigue disponible?': '¡Hola! Te comparto la ficha de ' + sheet.name + ', con renta mensual de $' + sheet.rent + ' MXN. Revisemos tu interés y las opciones para visitarlo.',
      'Servicios': 'Incluye: ' + (sheet.included.join(', ') || 'servicios por confirmar') + '.\n' + (sheet.additional.length ? 'Adicionales: ' + sheet.additional.join('. ') + '.' : '') + (sheet.pending.length ? '\nPor confirmar: ' + sheet.pending.join('. ') + '.' : ''),
      'Depósito y plazo': sheet.deposit && sheet.termMonths ? 'Se solicita un depósito en garantía de $' + sheet.deposit + ' MXN y contrato por ' + sheet.termMonths + ' meses.' : 'Voy a confirmar contigo el depósito y el plazo correspondientes a este inmueble.',
      'Agendar visita': 'Puedes consultar los horarios de visita en este enlace: ' + $('reserve-link').href,
      'Requisitos': sheet.requirementsConfigured ? 'Para este inmueble se solicita:\n' + sheet.requirements.map(item => '• ' + item.label).join('\n') : 'Voy a confirmar los requisitos específicos de este inmueble.'
    };
    Object.entries(templates).forEach(([label, value]) => {const button = node('button', label, 'secondary'); button.addEventListener('click', () => {$('message').value = value; $('message').focus();}); $('faq').append(button);});
  }
  async function refresh() {
    const result = await agentApi('catalog'); catalog = result.properties;
    options($('property'), catalog.map(sheet => ({id: sheet.propertyId, name: sheet.name + ' · $' + sheet.rent})));
    options($('interest'), catalog.map(sheet => ({id: sheet.propertyId, name: sheet.name})));
    $('observed').textContent = 'Catálogo consultado: ' + new Date(result.observedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'});
    await list(); if (active) await inspect(active.conversation.id);
  }
  async function mutate(operation, payload) {
    if (!active) return;
    const conversationId = active.conversation.id;
    const result = await command('/agent/' + operation, {conversationId, ...payload});
    await inspect(conversationId); await list(); return result;
  }
  function setupAgent() {
    $('email-login').addEventListener('submit', event => {event.preventDefault(); run(() => auth.signInWithEmailAndPassword($('email').value.trim(), $('password').value));});
    $('google').addEventListener('click', () => run(() => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())));
    $('logout').addEventListener('click', () => run(() => auth.signOut()));
    $('organization').addEventListener('change', () => run(async () => {active = null; $('detail').hidden = true; $('share-text').value = ''; await refresh();}));
    $('refresh').addEventListener('click', () => run(refresh));
    $('capture').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      const result = await command('/agent/capture', {displayName: $('display-name').value, surname: $('surname').value, phone: $('phone').value, source: $('source').value, entryChannel: $('entry-channel').value, propertyId: $('property').value, question: $('question').value});
      $('capture').reset(); $('share-text').value = ''; await list(); await inspect(result.conversationId); status('Atención guardada con su primera entrada de bitácora.');
    });});
    $('change-interest').addEventListener('click', () => run(async () => {await mutate('interest', {propertyId: $('interest').value, expectedVersion: active.conversation.version}); status('Inmueble actualizado. Se conserva el origen de la atención.');}));
    $('save-contact').addEventListener('click', () => run(async () => {await mutate('contact', {displayName: $('contact-name').value, surname: $('contact-surname').value, phone: $('contact-phone').value, expectedVersion: active.conversation.version}); $('share-text').value = ''; status('Contacto actualizado. Si cambió el teléfono, crea otro enlace.');}));
    $('conditions').addEventListener('click', () => run(async () => {await mutate('conditions', {expectedVersion: active.conversation.version}); status('Requisitos y condiciones habilitados para esta atención.');}));
    $('invite').addEventListener('click', () => run(async () => {
      const result = await mutate('invite', {expectedVersion: active.conversation.version});
      $('share-text').value = 'Hola. Para continuar la atención sobre ' + active.sheet.name + ', consultar su ficha y conversar con nosotros, abre este enlace de Synapse:\n' + result.url + '\nPara acceder a los mensajes, verifica el teléfono que compartiste con tu asesor.';
      status('Enlace preparado. Cópialo y compártelo con el cliente por su canal de origen.');
    }));
    $('revoke').addEventListener('click', () => run(async () => {await mutate('revoke', {expectedVersion: active.conversation.version}); $('share-text').value = ''; status('Enlace revocado.');}));
    for (const [button, field] of [['copy-share', 'share-text'], ['copy-message', 'message']]) $(button).addEventListener('click', () => run(async () => {await navigator.clipboard.writeText($(field).value); status('Texto copiado.');}));
    $('message-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {await mutate('message', {text: $('message').value}); $('message').value = ''; status('Mensaje registrado en Synapse.');});});
    $('summary-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      await mutate('summary', {summary: $('summary').value, nextAction: $('next-action').value ? {description: $('next-action').value, dueDate: $('due-date').value || null, status: 'pending'} : null, occurredAt: $('occurred-now').checked ? new Date().toISOString() : null});
      $('summary').value = ''; status('Resumen y siguiente acción guardados en bitácora.');
    });});
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
    $('report-date').value = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
    $('report').addEventListener('click', () => run(async () => {
      const result = await agentApi('report', {date: $('report-date').value}); const root = $('report-result'); root.replaceChildren(node('p', result.summaries + ' registros · ' + result.pending.length + ' pendientes · ' + result.reservations.length + ' reservas registradas'));
      result.pending.forEach(item => {const button = node('button', item.action, 'conversation'); button.addEventListener('click', () => run(() => inspect(item.conversationId))); root.append(button);});
      result.improvementProposals.forEach(item => root.append(node('p', 'Propuesta para revisión: ' + item.proposal)));
    }));
    auth.onAuthStateChanged(user => {
      $('login').hidden = Boolean(user); $('logout').hidden = !user; $('workspace').hidden = !user;
      if (!user) {active = null; catalog = []; pending.clear(); $('conversations').replaceChildren(); $('journal').replaceChildren(); $('messages').replaceChildren(); $('share-text').value = ''; $('password').value = ''; return;}
      // Auth callbacks can arrive before sign-in's promise settles; run separately.
      (async () => {
        try {
          const session = await api('/agent/session'); options($('organization'), session.organizations);
          if (!session.organizations.length) {$('workspace').hidden = true; status('Tu cuenta aún no tiene una organización autorizada para Atención.', true); return;}
          await refresh(); status('Sesión activa. Puedes capturar una atención.');
        } catch (error) {status(errors[error.message] || 'No se pudo cargar la sesión de Atención.', true);}
      })();
    });
  }
  async function refreshCustomer() {
    const data = await api('/customer/view', {token}); active = data;
    renderSheet(data.sheet); renderMessages(data.messages); $('verification').hidden = true; $('customer-chat').hidden = false;
    const root = $('shared-conditions'); root.replaceChildren();
    if (data.conditions) {
      const conditions = data.conditions; root.append(node('h3', 'Requisitos y condiciones compartidos'));
      root.append(node('p', 'Plazo: ' + conditions.termMonths + ' meses · Depósito: $' + conditions.deposit + ' MXN'));
      const list = node('ul', '', 'list'); conditions.requirements.forEach(item => list.append(node('li', item.label))); root.append(list);
    }
  }
  async function setupCustomer() {
    const data = await api('/invitation/preview', {token}, false); renderSheet(data.sheet); $('verification').hidden = false;
    verifier = new firebase.auth.RecaptchaVerifier('recaptcha', {size: 'normal'}, auth.app);
    $('phone-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      let phone = $('customer-phone').value.replace(/[\s()+.-]/g, ''); if (/^\d{10}$/.test(phone)) phone = '52' + phone;
      confirmation = await auth.signInWithPhoneNumber('+' + phone, verifier); $('code-form').hidden = false; status('Revisa el SMS e introduce el código.');
    });});
    $('code-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      await confirmation.confirm($('sms-code').value.trim());
      await command('/customer/claim', {token}, true); await refreshCustomer(); status('Acceso verificado. Tu atención continúa aquí.');
    });});
    $('refresh-customer').addEventListener('click', () => run(refreshCustomer));
    $('message-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      await command('/customer/message', {token, conversationId: active.conversationId, text: $('message').value}, true);
      $('message').value = ''; await refreshCustomer(); status('Mensaje registrado.');
    });});
    await new Promise(resolve => {let stop = () => {}; stop = auth.onAuthStateChanged(() => {stop(); resolve();});});
    if (auth.currentUser) {try {await refreshCustomer();} catch { /* Show verification rather than another person's session. */ }}
  }
  if (!config?.firebase || !config?.reservationOrigin) {status('La atención todavía no tiene configuración de conexión.', true); return;}
  // Reuse the advisor's Admin session; isolate customer phone verification so
  // testing an invitation does not replace the advisor's Firebase login.
  const appName = role === 'agent' ? '[DEFAULT]' : 'synapse-attention-customer';
  const app = firebase.apps.find(item => item.name === appName) || (role === 'agent' ? firebase.initializeApp(config.firebase) : firebase.initializeApp(config.firebase, appName));
  auth = app.auth();
  if (role === 'agent') setupAgent(); else run(setupCustomer);
})();
