'use strict';
(() => {
  const host = document.getElementById('synapse-shell');
  if (!host) return;
  const items = [
    ['radar', 'Radar', '/', 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8'],
    ['attention', 'Atención', '/atencion-operador', 'M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z'],
    ['contacts', 'Directorio', '/directorio', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M15 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
    ['agenda', 'Agenda', '/agenda', 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
    ['properties', 'Inmuebles', '/inmuebles', 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8'],
    ['territory', 'Territorio', '/territorio', 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6M9 3v15M15 6v15']
  ];
  const rail = document.createElement('aside'); rail.className = 'synapse-rail';
  const railHead=document.createElement('div');railHead.className='shell-heading';
  const brand = document.createElement('a'); brand.href = '/'; brand.className = 'synapse-logo';brand.setAttribute('aria-label','Synapse Core · Experience');
  const mark=document.createElement('span');mark.className='shell-mark';mark.textContent='◉';mark.setAttribute('aria-hidden','true');
  const words=document.createElement('span');words.className='shell-brand-copy';const name = document.createElement('strong'); name.textContent = 'SYNAPSE';
  const subtitle = document.createElement('small'); subtitle.textContent = 'Core · Experience';words.append(name,subtitle);brand.append(mark,words);
  const collapse=document.createElement('button');collapse.type='button';collapse.className='shell-collapse';collapse.textContent='‹';collapse.setAttribute('aria-label','Plegar menú');railHead.append(brand,collapse);rail.append(railHead);
  const quick=document.createElement('a');quick.href='/atencion-operador?new=1';quick.className='shell-new';quick.setAttribute('aria-label','Nueva atención');quick.innerHTML='<span aria-hidden="true">＋</span><span class="shell-new-label">Nueva atención</span>';rail.append(quick);
  const nav = document.createElement('nav'); nav.className = 'synapse-primary'; nav.setAttribute('aria-label', 'Navegación principal');
  for(const [groupLabel,ids]of [['Día a día',['radar','attention','agenda']],['Gestión',['contacts','properties','territory']]]){
    const group=document.createElement('details');group.open=true;group.className='shell-group';const summary=document.createElement('summary');summary.textContent=groupLabel;group.append(summary);
    for(const id of ids){const [,label,href,path]=items.find(item=>item[0]===id);const a=document.createElement('a');a.href=href;a.id='nav-'+id;a.dataset.module=id;a.setAttribute('aria-label',label);a.title=label;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.append(line);const text=document.createElement('span');text.textContent=label;a.append(svg,text);group.append(a);
    }nav.append(group);
  }
  rail.append(nav);
  const footer = document.createElement('div'); footer.className = 'synapse-rail-footer';
  const hours=document.createElement('a');hours.href='/agenda/horarios';hours.textContent='Horarios y bloqueos';hours.className='shell-secondary-link';
  const settings = document.createElement('a'); settings.href = '/configuracion'; settings.id = 'nav-settings'; settings.textContent = 'Configuración';
  const publicLink = document.createElement('a'); publicLink.href = '/reservar'; publicLink.textContent = 'Vista del cliente ↗'; publicLink.target = '_blank'; publicLink.rel = 'noopener noreferrer';
  footer.append(hours,settings, publicLink); rail.append(footer);
  const mobile=document.createElement('button');mobile.type='button';mobile.className='shell-mobile-toggle';mobile.textContent='☰  Synapse';mobile.setAttribute('aria-label','Abrir menú de Synapse');mobile.setAttribute('aria-expanded','false');
  const mask=document.createElement('button');mask.type='button';mask.className='shell-mask';mask.setAttribute('aria-label','Cerrar menú de Synapse');mask.hidden=true;host.replaceChildren(rail,mobile,mask);
  let collapsed=false;try{collapsed=localStorage.getItem('synapse.shell.v1')==='collapsed';}catch{}
  const narrow=()=>window.matchMedia?.('(max-width: 800px)').matches===true;
  function setCollapsed(value){collapsed=value;document.body.classList.toggle('shell-collapsed',value);collapse.textContent=value?'›':'‹';collapse.setAttribute('aria-label',value?'Desplegar menú':'Plegar menú');collapse.setAttribute('aria-expanded',String(!value));if(value)rail.querySelectorAll('.shell-group').forEach(g=>g.open=true);try{localStorage.setItem('synapse.shell.v1',value?'collapsed':'expanded');}catch{}}
  function mobileOpen(value){document.body.classList.toggle('shell-mobile-open',value);mobile.setAttribute('aria-expanded',String(value));mask.hidden=!value;}
  collapse.addEventListener('click',()=>narrow()?mobileOpen(false):setCollapsed(!collapsed));mobile.addEventListener('click',()=>mobileOpen(!document.body.classList.contains('shell-mobile-open')));mask.addEventListener('click',()=>mobileOpen(false));window.addEventListener('keydown',e=>{if(e.key==='Escape')mobileOpen(false);});setCollapsed(collapsed);
  function sectionFor(path) {
    if (path.startsWith('/atencion-operador')) return 'attention';
    if (['/directorio', '/contactos', '/operaciones'].includes(path)) return 'contacts';
    if (path.startsWith('/agenda') && path !== '/agenda.html') return 'agenda';
    if (path === '/inmuebles') return 'properties';
    if (path === '/territorio') return 'territory';
    if (['/configuracion', '/administracion', '/administracion.html'].includes(path)) return 'settings';
    return 'radar';
  }
  function setSection(section) {
    for (const a of rail.querySelectorAll('[id^="nav-"]')) {
      if (a.id === 'nav-' + section) {a.setAttribute('aria-current', 'page');const group=a.closest('details');if(group)group.open=true;}
      else a.removeAttribute('aria-current');
    }
  }
  setSection(sectionFor(location.pathname));
  window.SynapseShell = {setSection};
  // Never write drafts to localStorage. Keep the native leave-page protection
  // for the advisor's unsent response or unfinished journal summary.
  const hasDraft = () => document.body.dataset.role === 'agent'
    && (['message', 'summary'].some(id => document.getElementById(id)?.value.trim()) || document.getElementById('visit-form')?.dataset.dirty === 'true');
  window.addEventListener('beforeunload', event => {
    if (hasDraft()) {event.preventDefault(); event.returnValue = '';}
  });
  rail.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || link.target === '_blank') return;
    if (document.querySelector('dialog[open]')) {
      event.preventDefault();
      document.querySelector('dialog[open]').focus();
      return;
    }
    mobileOpen(false);
  });
})();
