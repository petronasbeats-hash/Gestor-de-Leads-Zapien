'use strict';
(() => {
  const $ = name => document.getElementById(name);
  const role = document.body.dataset.role;
  const config = window.SYNAPSE_ATTENTION_CONFIG;
  const pending = new Map();
  const conversationDrafts = new Map();
  const inboxButtons = new Map();
  let quickReplies = [], activeOrganization = '';
  let visitUI;
  let auth, active, catalog = [], busy = false, confirmation, verifier, guestSecret, guestJoined = false;
  const alerts = window.SynapseAlerts, pageTitle = document.title;
  const sound = alerts?.createSound(window,()=>updateSoundButton());
  const customerSoundPreference = 'synapse.attention.customerSound.v1';
  let customerSoundWanted = role === 'customer', customerSoundBusy = false, customerSoundError = false, customerSoundStopped = false;
  let readTracker, noticeScope = '', inboxRows = [], pollTimer, pollBusy = false, pollEpoch = 0, polling = false;
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
  const operatorPanels = ['conversation', 'property', 'visit', 'contact', 'journal'];
  function selectPanel(name) {
    operatorPanels.forEach(panel => {
      $('panel-' + panel).hidden = panel !== name;
      $('tab-' + panel).setAttribute('aria-selected', String(panel === name));
      $('tab-' + panel).tabIndex = panel === name ? 0 : -1;
    });
    markVisibleMessagesRead();
    if(name==='visit'&&visitUI)run(()=>visitUI.load());
  }
  function storage() {try{return localStorage;}catch{return null;}}
  function setNoticeScope(scope) {
    if(!alerts || noticeScope===scope)return;
    pollEpoch++;noticeScope=scope;inboxRows=[];
    readTracker=alerts.createTracker(storage(),'synapse.attention.read.v1:'+scope);
  }
  function updateSoundButton() {
    if(!alerts)return;
    if(role==='customer'){
      $('sound-toggle').textContent=customerSoundWanted?'Silenciar sonido':'Activar sonido Synapse';
      $('sound-toggle').setAttribute('aria-pressed',String(customerSoundWanted));
      $('sound-toggle').title=customerSoundWanted?'Silencia los avisos de Nexo':'Activa y escucha Nexo, la firma sonora de Synapse';
      $('sound-hint').textContent=!customerSoundWanted?'Sonido silenciado. Los avisos visuales siguen activos.':sound.enabled?'Escucharás Nexo cuando tu asesor te responda.':customerSoundError?'El sonido está pendiente. Se reintentará al tocar o escribir aquí.':'Sonido habilitado. Se activará al tocar o escribir aquí.';
      return;
    }
    $('sound-toggle').textContent=sound.enabled?'Sonido Synapse activado':'Activar sonido Synapse';
    $('sound-toggle').setAttribute('aria-pressed',String(sound.enabled));
    $('sound-toggle').title=sound.enabled?'Pulsa para silenciar los avisos':'Activa y escucha Nexo, la firma sonora de Synapse';
  }
  function playMessageSound() {if(sound?.enabled)sound.play();updateSoundButton();}
  function saveCustomerSoundPreference(){try{storage()?.setItem(customerSoundPreference,customerSoundWanted?'enabled':'muted');}catch{}}
  async function activateCustomerSound(preview=false){
    if(!customerSoundWanted||customerSoundStopped||customerSoundBusy||sound.enabled)return;
    customerSoundBusy=true;customerSoundError=false;
    try{await sound.enable({preview});if(!customerSoundWanted||customerSoundStopped)sound.mute();}
    catch{if(customerSoundWanted&&!customerSoundStopped)customerSoundError=true;}
    finally{customerSoundBusy=false;updateSoundButton();}
  }
  function renderMessageIndicators() {
    if(!readTracker)return;
    let total=0;
    for(const row of inboxRows){
      const count=readTracker.unread(row.id);total+=count;
      if(role==='agent'){
        const button=inboxButtons.get(row.id);if(!button)continue;
        button.classList.toggle('unread',count>0);
        button.setAttribute('aria-label',(row.context.displayName||'Nombre pendiente')+(count?' · '+count+' mensajes sin leer':''));
        const badge=button._unreadBadge;
        if(badge){badge.hidden=!count;badge.textContent=count>99?'99+':String(count);}
      }
    }
    $('unread-summary').textContent=total?total+(total===1?' mensaje nuevo':' mensajes nuevos'):'Sin mensajes nuevos';
    $('unread-summary').classList.toggle('has-unread',total>0);
    document.title=(total?'('+total+') ':'')+pageTitle;
    if(role==='agent'){
      $('next-unread').hidden=!total;
      $('toggle-list').textContent='Atenciones'+(total?' · '+total:'');
      const activeUnread=active?.conversation?readTracker.unread(active.conversation.id):0;
      $('tab-conversation').textContent='Conversación'+(activeUnread?' · '+activeUnread:'');
    }
  }
  function markVisibleMessagesRead() {
    if(!readTracker||!active||document.visibilityState==='hidden'||(document.hasFocus&&!document.hasFocus()))return;
    if(role==='agent'&&($('detail').hidden||$('panel-conversation').hidden||document.body.classList.contains('show-inbox')||$('capture-dialog').open||$('report-dialog').open))return;
    if(role==='customer'&&$('customer-chat').hidden)return;
    const thread=$('messages');
    if(typeof thread.clientHeight==='number'&&(thread.clientHeight===0||thread.scrollHeight-thread.scrollTop-thread.clientHeight>60))return;
    if(thread.getBoundingClientRect){const rect=thread.getBoundingClientRect();if(rect.bottom<=0||rect.top>=window.innerHeight)return;}
    const roles=role==='agent'?['customer','guest']:['agent'];
    const id=role==='agent'?active.conversation.id:active.conversationId;
    if(!id)return;
    readTracker.read(id,alerts.messageStats(active.messages||[],roles).count);renderMessageIndicators();
  }
  function observeCustomerMessages(data) {
    if(!readTracker||!data.conversationId)return;
    const stats=alerts.messageStats(data.messages,['agent']);
    const result=readTracker.observe(data.conversationId,stats);
    inboxRows=[{id:data.conversationId,inbox:stats}];
    if(result.fresh)playMessageSound();
    markVisibleMessagesRead();renderMessageIndicators();
  }
  function renderInbox(items) {
    if(readTracker){let fresh=0;for(const item of items)fresh+=readTracker.observe(item.id,item.inbox).fresh;if(fresh)playMessageSound();}
    const focused=[...inboxButtons].find(([,button])=>button===document.activeElement)?.[0];
    inboxRows=items;
    $('conversations').replaceChildren();inboxButtons.clear();
    items.sort((a,b)=>(readTracker?.unread(b.id)||0)-(readTracker?.unread(a.id)||0)||String(b.inbox?.lastAt||b.createdAt).localeCompare(String(a.inbox?.lastAt||a.createdAt))).forEach(item=>{
      const button=node('button',(item.context.displayName||'Nombre pendiente')+' · '+(sourceNames[item.context.source]||item.context.source),'conversation'+(active?.conversation.id===item.id?' selected':''));
      button.setAttribute('aria-pressed',String(active?.conversation.id===item.id));
      const badge=node('span','','unread-badge');badge.hidden=true;button.append(badge);button._unreadBadge=badge;
      inboxButtons.set(item.id,button);button.addEventListener('click',()=>run(()=>inspect(item.id)));$('conversations').append(button);
    });
    if(!items.length)$('conversations').append(node('p','Todavía no hay atenciones registradas.','muted'));
    renderMessageIndicators();
    if(focused)inboxButtons.get(focused)?.focus();
  }
  function queuePoll(delay) {
    if(typeof setTimeout!=='function'||!polling)return;
    clearTimeout(pollTimer);pollTimer=setTimeout(pollMessages,delay??(document.visibilityState==='hidden'?15000:5000));
  }
  async function pollMessages() {
    if(!polling)return;
    if(pollBusy||busy){queuePoll();return;}
    if(role==='agent'&&(!auth?.currentUser||$('workspace').hidden)){queuePoll();return;}
    if(role==='customer'&&(!active?.conversationId||(guestSecret&&!guestJoined))){queuePoll();return;}
    const epoch=pollEpoch,scope=noticeScope,organization=role==='agent'?$('organization').value:null;
    pollBusy=true;
    try{
      if(role==='agent'){
        const items=await agentApi('list');
        if(epoch!==pollEpoch||scope!==noticeScope||organization!==$('organization').value||busy)return;
        const previousCount=active?.messages?alerts.messageStats(active.messages,['customer','guest']).count:0;
        renderInbox(items);
        const selected=items.find(item=>item.id===active?.conversation.id);
        if(active&&!selected){
          conversationDrafts.delete(activeOrganization+'/'+active.conversation.id);active=null;activeOrganization='';
          $('detail').hidden=true;$('empty-detail').hidden=false;$('messages').replaceChildren();$('share-text').value='';
        }
        if(selected&&selected.context.currentPropertyId!==active?.sheet.propertyId){
          status('El inmueble de esta atención cambió. Pulsa Actualizar para revisar su ficha.');
        }else if(selected?.inbox?.count>previousCount){
          const conversationId=selected.id,next=await agentApi('inspect',{conversationId});
          if(epoch!==pollEpoch||scope!==noticeScope||busy||active?.conversation.id!==conversationId)return;
          active.messages=next.messages;active.journal=next.journal;renderMessages(next.messages);
          if(JSON.stringify(next.conversation.context)===JSON.stringify(active.conversation.context)&&next.conversation.invitation?.tokenHash===active.conversation.invitation?.tokenHash)active.conversation=next.conversation;
          markVisibleMessagesRead();
        }
      }else{
        const data=guestSecret?await api('/guest/view',{token,secret:guestSecret},false):await api('/customer/view',{token});
        if(epoch!==pollEpoch||scope!==noticeScope||busy)return;
        const propertyChanged=active.sheet.propertyId!==data.sheet.propertyId;
        if(JSON.stringify(active.sheet)!==JSON.stringify(data.sheet))renderSheet(data.sheet);
        if(JSON.stringify(active.conditions)!==JSON.stringify(data.conditions))renderCustomerConditions(data.conditions);
        active=data;renderMessages(data.messages);observeCustomerMessages(data);
        if(propertyChanged)status('Tu asesor actualizó el inmueble de interés. Revisa la ficha antes de continuar.');
      }
      if(epoch===pollEpoch)$('inbox-sync').textContent='Mensajes al día · '+new Date().toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City'});
    }catch(error){
      if(epoch===pollEpoch){const terminal=/INVITATION_INVALID|GUEST_ACCESS_REQUIRED|AUTHENTICATION_REQUIRED|FORBIDDEN|PROPERTY_NOT_PUBLISHED/.test(error.message);$('inbox-sync').textContent=terminal?(errors[error.message]||'Revisa tu acceso para recibir mensajes.'):'Sin conexión con mensajes. Reintentando…';if(terminal)polling=false;}
    }finally{pollBusy=false;queuePoll();}
  }
  function startPolling(){if(!alerts)return;polling=true;queuePoll();}
  function stopPolling(){polling=false;pollEpoch++;customerSoundStopped=true;if(typeof clearTimeout==='function')clearTimeout(pollTimer);readTracker=null;noticeScope='';inboxRows=[];sound?.mute();if(alerts){document.title=pageTitle;updateSoundButton();$('unread-summary').textContent='Sin mensajes nuevos';$('unread-summary').classList.remove('has-unread');}}
  function setupMessageNotices(){
    if(!alerts)return;
    if(role==='customer'){
      try{customerSoundWanted=storage()?.getItem(customerSoundPreference)!=='muted';}catch{}
      const unlock=event=>{
        if(event.isTrusted!==true||event.target===$('sound-toggle')||$('sound-toggle').contains?.(event.target))return;
        if(event.type==='keydown'&&(event.ctrlKey||event.metaKey||event.altKey||['Escape','Control','Meta','Alt','Shift','CapsLock','NumLock','PrintScreen'].includes(event.key)))return;
        return activateCustomerSound();
      };
      document.addEventListener?.('click',unlock,{capture:true,passive:true});
      document.addEventListener?.('keydown',unlock,{capture:true,passive:true});
    }
    $('sound-toggle').addEventListener('click',async()=>{
      if(role==='customer'){
        customerSoundWanted=!customerSoundWanted;saveCustomerSoundPreference();
        if(!customerSoundWanted)sound.mute();else await activateCustomerSound(true);
        updateSoundButton();return;
      }
      if($('sound-toggle').disabled)return;$('sound-toggle').disabled=true;
      const epoch=pollEpoch;
      try{if(sound.enabled)sound.mute();else await sound.enable();if(epoch!==pollEpoch)sound.mute();}catch{status('No se pudo activar el sonido. Revisa el volumen y vuelve a pulsar Activar sonido.',true);}
      finally{$('sound-toggle').disabled=false;updateSoundButton();}
    });
    if(role==='agent')$('next-unread').addEventListener('click',()=>run(async()=>{const row=inboxRows.find(item=>readTracker?.unread(item.id));if(row)await inspect(row.id);}));
    $('messages').addEventListener('scroll',markVisibleMessagesRead);
    document.addEventListener?.('visibilitychange',()=>{markVisibleMessagesRead();queuePoll(0);});
    window.addEventListener?.('focus',()=>{markVisibleMessagesRead();queuePoll(0);});
    window.addEventListener?.('online',()=>queuePoll(0));
    window.addEventListener?.('scroll',markVisibleMessagesRead,{passive:true});
    updateSoundButton();
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
    const root = $('messages'),previousTop=root.scrollTop||0;
    const follow=!root.children.length||typeof root.scrollHeight!=='number'||root.scrollHeight-previousTop-root.clientHeight<60;
    root.replaceChildren();
    messages.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).forEach(message => {
      const item = node('div', '', 'message ' + message.actorRole);
      item.append(node('small', (message.actorRole === 'agent' ? 'Asesor' : message.actorRole === 'guest' ? 'Cliente invitado' : 'Cliente') + ' · ' + new Date(message.recordedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'})), node('div', message.text)); root.append(item);
    });
    root.scrollTop=follow?root.scrollHeight:previousTop;
  }
  async function list() {
    const items = await agentApi('list');renderInbox(items);
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
    visitUI?.select({organizationId:activeOrganization,conversationId:current.id,propertyId:current.context.currentPropertyId,originalPropertyId:current.context.originalPropertyId,source:current.context.source,entryChannel:current.context.entryChannel,name:[current.context.displayName,current.context.surname].filter(Boolean).join(' '),phone:current.context.phone});
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
    if(window.SynapseWorkspace){try{$('agent-contact-whatsapp').href=window.SynapseWorkspace.whatsappUrl(current.context.phone);$('agent-contact-whatsapp').hidden=false;}catch{$('agent-contact-whatsapp').removeAttribute('href');$('agent-contact-whatsapp').hidden=true;}}
    renderSheet(active.sheet); renderMessages(active.messages);
    $('observed').textContent = 'Catálogo consultado: ' + new Date(active.observedAt).toLocaleString('es-MX', {timeZone: 'America/Mexico_City'});
    $('journal').replaceChildren(); active.journal.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).forEach(entry => $('journal').append(node('div', entry.summary + (entry.nextAction ? '\nSiguiente acción: ' + entry.nextAction.description : ''), 'journal')));
    quickReplies = window.SynapseQuickReplies.forProperty(active.sheet, $('reserve-link').href);
    options($('reply-preset'), [{id: '', name: 'Elige una consulta frecuente'}, ...quickReplies.map(item => ({id: item.id, name: item.label}))]);
    $('reply-context').textContent = 'Respuesta para ' + active.sheet.name + '. Revísala y edítala antes de enviar.';
    if (changing) {restoreDraft(); selectPanel('conversation');}
    else if (previousProperty !== active.sheet.propertyId && wasPrepared) $('message').value = quickReplies.find(item => item.id === $('reply-preset').value)?.text || '';
    markVisibleMessagesRead();
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
    $('organization').addEventListener('change', () => run(async () => {saveDraft();setNoticeScope(auth.currentUser.uid+'/'+$('organization').value); active = null; activeOrganization = ''; quickReplies = []; $('detail').hidden = true; $('empty-detail').hidden = false; $('share-text').value = ''; document.body.classList.add('show-inbox'); await refresh();startPolling();}));
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
        stopPolling();
        visitUI?.reset();
        $('agent-contact-whatsapp').hidden=true;$('agent-contact-whatsapp').href='';
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
          setNoticeScope(user.uid+'/'+$('organization').value);await refresh();startPolling();if(typeof URLSearchParams==='function'&&new URLSearchParams(location.search).get('new')==='1')$('capture-dialog').showModal(); status('Sesión activa. Puedes capturar una atención.');
        } catch (error) {status(errors[error.message] || 'No se pudo cargar la sesión de Atención.', true);}
      })();
    });
  }
  function renderCustomerConditions(conditions) {
    const root=$('shared-conditions');root.replaceChildren();
    if(!conditions)return;
    root.append(node('h3','Requisitos y condiciones compartidos'));
    root.append(node('p','Plazo: '+conditions.termMonths+' meses · Depósito: $'+conditions.deposit+' MXN'));
    const list=node('ul','','list');conditions.requirements.forEach(item=>list.append(node('li',item.label)));root.append(list);
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
    observeCustomerMessages(data);startPolling();
    $('access-state').textContent = guestSecret ? 'Invitado · sin registro. Tu identidad no está verificada. Continúa desde este navegador.' : 'Acceso con teléfono verificado.';
    renderCustomerConditions(data.conditions);
    return true;
  }
  async function setupCustomer() {
    const data = await api('/invitation/preview', {token}, false); renderSheet(data.sheet);
    if(alerts){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));setNoticeScope('customer/'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''));}
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
    if(role==='agent'&&window.SynapseAttentionVisitUI&&typeof app.database==='function')visitUI=window.SynapseAttentionVisitUI.mount({db:app.database(),auth,run,
      validate:async context=>{const latest=await agentApi('inspect',{conversationId:context.conversationId});if(latest.conversation.context.currentPropertyId!==context.propertyId)throw Error('PROPERTY_SCOPE_CHANGED');},
      hasRecord:event=>active?.journal?.some(entry=>entry.kind==='reservation_registered'&&entry.folio===event.folio),
      record:async(context,event)=>{await agentApi('visit',{requestId:'journal_'+event.id,conversationId:context.conversationId,eventId:event.id});await inspect(context.conversationId);},
      prepare:text=>{if($('message').value.trim()){status('Ya hay un borrador en conversación. Cópialo o envíalo antes de preparar la confirmación.',true);return;}$('message').value=text;selectPanel('conversation');$('message').focus();status('Confirmación preparada. Revísala y pulsa Enviar en Synapse cuando corresponda.');}
    });
  }
  setupMessageNotices();
  if (role === 'agent') {initializeAuth(); setupAgent();} else run(setupCustomer);
})();
