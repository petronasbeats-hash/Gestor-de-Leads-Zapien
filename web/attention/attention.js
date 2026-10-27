'use strict';
(() => {
  const $ = name => document.getElementById(name);
  const role = document.body.dataset.role;
  const config = window.SYNAPSE_ATTENTION_CONFIG;
  const pending = new Map();
  const conversationDrafts = new Map();
  const inboxButtons = new Map();
  let quickReplies = [], activeOrganization = '';
  let auth, active, catalog = [], busy = false, confirmation, verifier, guestSecret, guestJoined = false;
  const token = role === 'customer' ? location.hash.slice(1) : '';
  const sourceNames = {marketplace_facebook: 'Marketplace Facebook', facebook: 'Facebook', whatsapp: 'WhatsApp', casa_login: 'Casa Login', hype_synapse_experience: 'HYPE by Synapse Experience', directa: 'Directa'};
  const errors = {
    AUTHENTICATION_REQUIRED: 'Inicia sesión de nuevo para continuar.', ORGANIZATION_FORBIDDEN: 'Tu cuenta no tiene acceso a esta organización.',
    PROPERTY_FORBIDDEN: 'El inmueble está fuera de tu acceso autorizado.', PROPERTY_NOT_PUBLISHED: 'Esta publicación ya no está activa. Actualiza el catálogo.',
    VERSION_CONFLICT: 'La atención cambió. Actualiza antes de continuar.', COMMAND_ID_CONFLICT: 'Esta operación ya tiene otros datos. Actualiza la atención.',
    INVITATION_INVALID: 'El enlace venció o fue revocado. Solicita uno nuevo a tu asesor.',
    INVITATION_REISSUE_REQUIRED: 'El enlace anterior se creó, pero no se recuperó. Actualiza y crea otro enlace.',
    CUSTOMER_VERIFICATION_REQUIRED: 'No se pudo verificar el acceso. Usa el teléfono que compartiste con tu asesor.',
    GUEST_ACCESS_REQUIRED: 'No se pudo recuperar el acceso de este navegador. Solicita otro enlace a tu asesor.',
    GUEST_LINK_IN_USE: 'Este enlace ya se abrió en otro navegador. Continúa allí o pide otro enlace a tu asesor.',
    CONDITIONS_NOT_CONFIGURED: 'Los requisitos de este inmueble todavía están por confirmar.',
    SERVICE_UNAVAILABLE: 'El servicio no está disponible. Tus datos permanecen en el formulario; vuelve a intentarlo.',
    PHONE_INVALID: 'Escribe un teléfono mexicano de diez dígitos.', PHONE_REQUIRED: 'Revisa el teléfono.',
    'auth/operation-not-allowed': 'Este método de acceso aún no está habilitado. Contacta a tu asesor.',
    'auth/invalid-verification-code': 'El código no es correcto. Revísalo e intenta de nuevo.',
    'auth/invalid-phone-number': 'Revisa el teléfono, incluido el código +52.',
    'auth/invalid-credential': 'No se pudo iniciar sesión. Revisa tu correo y contraseña.',
    'auth/unauthorized-domain': 'Este dominio todavía no está autorizado para iniciar sesión.'
  };
  function status(message, error = false) {
    $('status').textContent = message; $('status').classList.toggle('error', error);
    if (role === 'agent') for (const name of ['capture', 'report']) {
      if ($(name + '-dialog').open) $(name + '-status').textContent = error ? message : '';
    }
  }
  const operatorPanels = ['conversation', 'property', 'contact', 'journal'];
  function selectPanel(name) {
    operatorPanels.forEach(panel => {
      $('panel-' + panel).hidden = panel !== name;
      $('tab-' + panel).setAttribute('aria-selected', String(panel === name));
      $('tab-' + panel).tabIndex = panel === name ? 0 : -1;
    });
  }
  function closeDialog(name) { $(name + '-dialog').close(); }
  const draftFields = ['message', 'summary', 'next-action', 'due-date', 'reply-preset'];
  function saveDraft() {
    if (!active?.conversation || !activeOrganization) return;
    conversationDrafts.set(activeOrganization + '/' + active.conversation.id, {
      values: Object.fromEntries(draftFields.map(name => [name, $(name).value])),
      occurredNow: $('occurred-now').checked, propertyId: active.sheet.propertyId,
      preparedText: quickReplies.find(item => item.id === $('reply-preset').value)?.text
    });
  }
  function restoreDraft() {
    const draft = conversationDrafts.get(activeOrganization + '/' + active.conversation.id);
    draftFields.forEach(name => {$(name).value = draft?.values[name] || '';});
    $('occurred-now').checked = draft ? draft.occurredNow : true;
    if (draft && draft.propertyId !== active.sheet.propertyId && draft.values.message === draft.preparedText) {
      $('message').value = quickReplies.find(item => item.id === draft.values['reply-preset'])?.text || '';
    }
  }
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
    const user = auth?.currentUser;
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
  async function command(path, data, customer = false, authenticated = true) {
    const body = customer ? data : {organizationId: $('organization').value, ...data};
    const signature = path + JSON.stringify({...body, ...(body.occurredAt ? {occurredAt: 'current-interaction'} : {})});
    if (!pending.has(signature)) pending.set(signature, {...body, requestId: crypto.randomUUID()});
    const result = await api(path, pending.get(signature), authenticated);
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
      item.append(node('small', (message.actorRole === 'agent' ? 'Asesor' : message.actorRole === 'guest' ? 'Cliente invitado' : 'Cliente') + ' · ' + new Date(message.recordedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'})), node('div', message.text)); root.append(item);
    });
  }
  async function list() {
    const items = await agentApi('list'); $('conversations').replaceChildren(); inboxButtons.clear();
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(item => {
      const button = node('button', (item.context.displayName || 'Nombre pendiente') + ' · ' + (sourceNames[item.context.source] || item.context.source), 'conversation' + (active?.conversation.id === item.id ? ' selected' : ''));
      button.setAttribute('aria-pressed', String(active?.conversation.id === item.id)); inboxButtons.set(item.id, button);
      button.addEventListener('click', () => run(() => inspect(item.id))); $('conversations').append(button);
    });
    if (!items.length) $('conversations').append(node('p', 'Todavía no hay atenciones registradas.', 'muted'));
  }
  async function inspect(conversationId) {
    const next = await agentApi('inspect', {conversationId});
    const changing = activeOrganization !== $('organization').value || active?.conversation.id !== next.conversation.id;
    const previousProperty = active?.sheet.propertyId;
    const preparedText = quickReplies.find(item => item.id === $('reply-preset').value)?.text;
    const wasPrepared = Boolean(preparedText && $('message').value === preparedText);
    saveDraft();
    const invitationChanged = active?.conversation.invitation?.tokenHash !== next.conversation.invitation?.tokenHash || next.conversation.invitation?.revoked;
    if (changing || previousProperty !== next.sheet.propertyId || invitationChanged) $('share-text').value = '';
    active = next; activeOrganization = $('organization').value;
    inboxButtons.forEach((button, id) => {button.classList.toggle('selected', id === conversationId); button.setAttribute('aria-pressed', String(id === conversationId));});
    const current = active.conversation;
    $('detail').hidden = false; $('customer-title').textContent = [current.context.displayName, current.context.surname].filter(Boolean).join(' ') || 'Nombre pendiente';
    $('empty-detail').hidden = true; document.body.classList.remove('show-inbox');
    $('property-context').textContent = active.sheet.name + ' · ' + new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN', maximumFractionDigits: 0}).format(active.sheet.rent) + ' / mes';
    $('property-context').title = $('property-context').textContent;
    $('attribution').textContent = (sourceNames[current.context.source] || current.context.source) + ' · Entrada: ' + current.context.entryChannel;
    $('access-state').textContent = current.invitation?.accessMode === 'hype_business_guest'
      ? (current.guestAccess ? 'Invitado conectado · identidad sin verificar' : 'Enlace preparado · identidad sin verificar')
      : (current.context.identityStatus === 'contact_verified' ? 'Teléfono verificado' : 'Identidad sin verificar');
    $('interest').value = current.context.currentPropertyId;
    $('contact-name').value = current.context.displayName; $('contact-surname').value = current.context.surname; $('contact-phone').value = current.context.phone;
    renderSheet(active.sheet); renderMessages(active.messages);
    $('observed').textContent = 'Catálogo consultado: ' + new Date(active.observedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'});
    $('journal').replaceChildren(); active.journal.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).forEach(entry => $('journal').append(node('div', entry.summary + (entry.nextAction ? '\nSiguiente acción: ' + entry.nextAction.description : ''), 'journal')));
    quickReplies = window.SynapseQuickReplies.forProperty(active.sheet, $('reserve-link').href);
    options($('reply-preset'), [{id: '', name: 'Elige una consulta frecuente'}, ...quickReplies.map(item => ({id: item.id, name: item.label}))]);
    $('reply-context').textContent = 'Respuesta para ' + active.sheet.name + '. Revísala y edítala antes de enviar.';
    if (changing) {restoreDraft(); selectPanel('conversation');}
    else if (previousProperty !== active.sheet.propertyId && wasPrepared) $('message').value = quickReplies.find(item => item.id === $('reply-preset').value)?.text || '';
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
    operatorPanels.forEach((name, index) => {
      $('tab-' + name).addEventListener('click', () => selectPanel(name));
      $('tab-' + name).addEventListener('keydown', event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? operatorPanels.length - 1 : offset ? (index + offset + operatorPanels.length) % operatorPanels.length : null;
        if (next === null) return; event.preventDefault(); selectPanel(operatorPanels[next]); $('tab-' + operatorPanels[next]).focus();
      });
    });
    for (const name of ['capture', 'report']) $('close-' + name).addEventListener('click', () => closeDialog(name));
    $('new-attention').addEventListener('click', () => {$('capture-status').textContent = ''; $('capture-dialog').showModal();});
    $('open-report').addEventListener('click', () => {$('report-status').textContent = ''; $('report-dialog').showModal();});
    $('toggle-list').addEventListener('click', () => document.body.classList.toggle('show-inbox'));
    $('prepare-reply').addEventListener('click', () => {
      const reply = quickReplies.find(item => item.id === $('reply-preset').value);
      if (!reply) {status('Elige la consulta del cliente para preparar una respuesta.'); return;}
      $('message').value = reply.text; $('message').focus(); status('Respuesta preparada. Puedes editarla antes de enviarla o copiarla.');
    });
    $('email-login').addEventListener('submit', event => {event.preventDefault(); run(() => auth.signInWithEmailAndPassword($('email').value.trim(), $('password').value));});
    $('google').addEventListener('click', () => run(() => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())));
    $('logout').addEventListener('click', () => run(() => auth.signOut()));
    $('organization').addEventListener('change', () => run(async () => {saveDraft(); active = null; activeOrganization = ''; quickReplies = []; $('detail').hidden = true; $('empty-detail').hidden = false; $('share-text').value = ''; document.body.classList.add('show-inbox'); await refresh();}));
    $('refresh').addEventListener('click', () => run(refresh));
    $('capture').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      const result = await command('/agent/capture', {displayName: $('display-name').value, surname: $('surname').value, phone: $('phone').value, source: $('source').value, entryChannel: $('entry-channel').value, propertyId: $('property').value, question: $('question').value});
      $('capture').reset(); $('share-text').value = ''; await list(); await inspect(result.conversationId); closeDialog('capture'); status('Atención guardada con su primera entrada de bitácora.');
    });});
    $('change-interest').addEventListener('click', () => run(async () => {await mutate('interest', {propertyId: $('interest').value, expectedVersion: active.conversation.version}); status('Inmueble actualizado. Se conserva el origen de la atención.');}));
    $('save-contact').addEventListener('click', () => run(async () => {await mutate('contact', {displayName: $('contact-name').value, surname: $('contact-surname').value, phone: $('contact-phone').value, expectedVersion: active.conversation.version}); $('share-text').value = ''; status('Contacto actualizado. Si cambió el teléfono, crea otro enlace.');}));
    $('conditions').addEventListener('click', () => run(async () => {await mutate('conditions', {expectedVersion: active.conversation.version}); status('Requisitos y condiciones habilitados para esta atención.');}));
    $('invite').addEventListener('click', () => run(async () => {
      const result = await mutate('invite', {expectedVersion: active.conversation.version});
      $('share-text').value = 'Hola. Continúa aquí tu atención sobre ' + active.sheet.name + ' con Synapse Attention by HYPE Business:\n' + result.url + '\nConsulta la ficha y conversa con tu asesor. No necesitas registrarte ni recibir un SMS. Abre el enlace en tu navegador y consérvalo para continuar.';
      status('Enlace preparado. Cópialo y compártelo con el cliente por su canal de origen.');
    }));
    $('revoke').addEventListener('click', () => run(async () => {await mutate('revoke', {expectedVersion: active.conversation.version}); $('share-text').value = ''; status('Enlace revocado.');}));
    for (const [button, field] of [['copy-share', 'share-text'], ['copy-message', 'message']]) $(button).addEventListener('click', () => run(async () => {await navigator.clipboard.writeText($(field).value); status('Texto copiado.');}));
    $('message-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      const threadId = active?.conversation.invitation?.accessMode === 'hype_business_guest' ? active.conversation.invitation.threadId : null;
      const submitted = $('message').value;
      await mutate('message', {text: submitted, ...(threadId ? {threadId} : {})});
      if ($('message').value === submitted) $('message').value = ''; status('Mensaje registrado en Synapse.');
    });});
    $('summary-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      const submitted = $('summary').value;
      await mutate('summary', {summary: submitted, nextAction: $('next-action').value ? {description: $('next-action').value, dueDate: $('due-date').value || null, status: 'pending'} : null, occurredAt: $('occurred-now').checked ? new Date().toISOString() : null});
      if ($('summary').value === submitted) $('summary').value = ''; status('Resumen y siguiente acción guardados en bitácora.');
    });});
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
    $('report-date').value = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
    $('report').addEventListener('click', () => run(async () => {
      const result = await agentApi('report', {date: $('report-date').value}); const root = $('report-result'); root.replaceChildren(node('p', result.summaries + ' registros · ' + result.pending.length + ' pendientes · ' + result.reservations.length + ' reservas registradas'));
      result.pending.forEach(item => {const button = node('button', item.action, 'conversation'); button.addEventListener('click', () => run(async () => {closeDialog('report'); await inspect(item.conversationId);})); root.append(button);});
      result.improvementProposals.forEach(item => root.append(node('p', 'Propuesta para revisión: ' + item.proposal)));
    }));
    auth.onAuthStateChanged(user => {
      $('login').hidden = Boolean(user); $('logout').hidden = !user; $('workspace').hidden = !user;
      if (!user) {
        active = null; activeOrganization = ''; catalog = []; quickReplies = []; pending.clear(); conversationDrafts.clear(); inboxButtons.clear();
        document.body.classList.remove('operator-ready', 'show-inbox');
        for (const name of ['capture', 'report']) if ($(name + '-dialog').open) closeDialog(name);
        $('conversations').replaceChildren(); $('journal').replaceChildren(); $('messages').replaceChildren(); $('share-text').value = ''; $('password').value = '';
        $('capture').reset(); for (const name of ['contact-name', 'contact-surname', 'contact-phone']) $(name).value = '';
        draftFields.forEach(name => {$(name).value = '';}); $('detail').hidden = true; $('empty-detail').hidden = false; return;
      }
      // Auth callbacks can arrive before sign-in's promise settles; run separately.
      (async () => {
        try {
          const session = await api('/agent/session'); options($('organization'), session.organizations);
          if (!session.organizations.length) {$('workspace').hidden = true; status('Tu cuenta aún no tiene una organización autorizada para Atención.', true); return;}
          document.body.classList.add('operator-ready'); if (!active) document.body.classList.add('show-inbox');
          await refresh(); status('Sesión activa. Puedes capturar una atención.');
        } catch (error) {status(errors[error.message] || 'No se pudo cargar la sesión de Atención.', true);}
      })();
    });
  }
  async function refreshCustomer() {
    let data;
    if (guestSecret) {
      try {data = await api('/guest/view', {token, secret: guestSecret}, false); guestJoined = true;}
      catch (error) {
        if (error.message !== 'GUEST_ACCESS_REQUIRED' || guestJoined) throw error;
        // Opening or previewing the link must not consume the recipient's session.
        // Bind this browser only when the visitor deliberately sends a message.
        $('verification').hidden = true; $('customer-chat').hidden = false;
        $('access-state').textContent = 'Invitado · sin registro. Escribe tu consulta para comenzar; tu teléfono es opcional.';
        renderMessages([]); return false;
      }
    } else data = await api('/customer/view', {token});
    active = data;
    renderSheet(data.sheet); renderMessages(data.messages); $('verification').hidden = true; $('customer-chat').hidden = false;
    $('access-state').textContent = guestSecret ? 'Invitado · sin registro. Tu identidad no está verificada. Continúa desde este navegador.' : 'Acceso con teléfono verificado.';
    const root = $('shared-conditions'); root.replaceChildren();
    if (data.conditions) {
      const conditions = data.conditions; root.append(node('h3', 'Requisitos y condiciones compartidos'));
      root.append(node('p', 'Plazo: ' + conditions.termMonths + ' meses · Depósito: $' + conditions.deposit + ' MXN'));
      const list = node('ul', '', 'list'); conditions.requirements.forEach(item => list.append(node('li', item.label))); root.append(list);
    }
    return true;
  }
  async function setupCustomer() {
    const data = await api('/invitation/preview', {token}, false); renderSheet(data.sheet);
    $('refresh-customer').addEventListener('click', () => run(refreshCustomer));
    $('message-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      if (guestSecret) {
        if (!guestJoined) {await command('/guest/open', {token, secret: guestSecret}, true, false); guestJoined = true;}
        await command('/guest/message', {token, secret: guestSecret, text: $('message').value}, true, false);
      }
      else await command('/customer/message', {token, conversationId: active.conversationId, text: $('message').value}, true);
      $('message').value = ''; await refreshCustomer(); status('Mensaje registrado.');
    });});
    if (data.accessMode === 'hype_business_guest') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const storageKey = 'synapse-hype-guest-' + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      let persistent = true;
      try {guestSecret = localStorage.getItem(storageKey);} catch {persistent = false;}
      if (!/^[A-Za-z0-9_-]{43}$/.test(guestSecret || '')) {
        guestSecret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        try {localStorage.setItem(storageKey, guestSecret);} catch {persistent = false;}
      }
      await refreshCustomer(); status(persistent ? 'Tu atención continúa aquí. Puedes escribir sin teléfono ni SMS.' : 'Puedes conversar. Este navegador no conserva el acceso: mantén abierta esta pestaña.');
      return;
    }
    // Older invitations retain their verified-phone gate. They are never
    // silently converted into guest access or used to expose old messages.
    await loadLegacyAuth(); initializeAuth(); $('verification').hidden = false;
    verifier = new firebase.auth.RecaptchaVerifier('recaptcha', {size: 'normal'}, auth.app);
    $('phone-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      let phone = $('customer-phone').value.replace(/[\s()+.-]/g, ''); if (/^\d{10}$/.test(phone)) phone = '52' + phone;
      confirmation = await auth.signInWithPhoneNumber('+' + phone, verifier); $('code-form').hidden = false; status('Revisa el SMS e introduce el código.');
    });});
    $('code-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
      await confirmation.confirm($('sms-code').value.trim());
      await command('/customer/claim', {token}, true); await refreshCustomer(); status('Acceso verificado. Tu atención continúa aquí.');
    });});
    await new Promise(resolve => {let stop = () => {}; stop = auth.onAuthStateChanged(() => {stop(); resolve();});});
    if (auth.currentUser) {try {await refreshCustomer();} catch { /* Show verification rather than another person's session. */ }}
  }
  async function loadLegacyAuth() {
    for (const source of ['firebase-app-compat.js', 'firebase-auth-compat.js']) {
      await new Promise((resolve, reject) => {const script = document.createElement('script'); script.src = 'https://www.gstatic.com/firebasejs/10.7.1/' + source; script.onload = resolve; script.onerror = () => reject(Error('SERVICE_UNAVAILABLE')); document.head.append(script);});
    }
  }
  if (!config?.firebase || !config?.reservationOrigin) {status('La atención todavía no tiene configuración de conexión.', true); return;}
  // Reuse the advisor's Admin session; isolate customer phone verification so
  // testing an invitation does not replace the advisor's Firebase login.
  function initializeAuth() {
    const appName = role === 'agent' ? '[DEFAULT]' : 'synapse-attention-customer';
    const app = firebase.apps.find(item => item.name === appName) || (role === 'agent' ? firebase.initializeApp(config.firebase) : firebase.initializeApp(config.firebase, appName));
    auth = app.auth();
  }
  if (role === 'agent') {initializeAuth(); setupAgent();} else run(setupCustomer);
})();
