'use strict';
(() => {
  const host = document.getElementById('synapse-shell');
  if (!host) return;
  const items = [
    ['radar', 'Radar', '/', 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8'],
    ['attention', 'Atención', '/atencion-operador', 'M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z'],
    ['contacts', 'Directorio', '/directorio', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M15 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
    ['agenda', 'Agenda', '/agenda', 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
    ['properties', 'Inmuebles', '/inmuebles', 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8']
  ];
  const rail = document.createElement('aside'); rail.className = 'synapse-rail';
  const brand = document.createElement('a'); brand.href = '/'; brand.className = 'synapse-logo';
  const name = document.createElement('strong'); name.textContent = 'SYNAPSE';
  const subtitle = document.createElement('small'); subtitle.textContent = 'Core · Experience';
  brand.append(name, subtitle); rail.append(brand);
  const nav = document.createElement('nav'); nav.className = 'synapse-primary'; nav.setAttribute('aria-label', 'Navegación principal');
  for (const [id, label, href, path] of items) {
    const a = document.createElement('a'); a.href = href; a.id = 'nav-' + id; a.dataset.module = id;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(svg.namespaceURI, 'path'); line.setAttribute('d', path); svg.append(line);
    const text = document.createElement('span'); text.textContent = label;
    a.append(svg, text); nav.append(a);
  }
  rail.append(nav);
  const footer = document.createElement('div'); footer.className = 'synapse-rail-footer';
  const settings = document.createElement('a'); settings.href = '/configuracion'; settings.id = 'nav-settings'; settings.textContent = 'Configuración';
  const publicLink = document.createElement('a'); publicLink.href = '/reservar'; publicLink.textContent = 'Vista del cliente ↗'; publicLink.target = '_blank'; publicLink.rel = 'noopener noreferrer';
  footer.append(settings, publicLink); rail.append(footer); host.replaceChildren(rail);
  function sectionFor(path) {
    if (path.startsWith('/atencion-operador')) return 'attention';
    if (['/directorio', '/contactos', '/operaciones'].includes(path)) return 'contacts';
    if (path.startsWith('/agenda') && path !== '/agenda.html') return 'agenda';
    if (path === '/inmuebles') return 'properties';
    if (['/configuracion', '/administracion', '/administracion.html'].includes(path)) return 'settings';
    return 'radar';
  }
  function setSection(section) {
    for (const a of rail.querySelectorAll('[id^="nav-"]')) {
      if (a.id === 'nav-' + section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }
  setSection(sectionFor(location.pathname));
  window.SynapseShell = {setSection};
  // Never write drafts to localStorage. Keep the native leave-page protection
  // for the advisor's unsent response or unfinished journal summary.
  const hasDraft = () => document.body.dataset.role === 'agent'
    && ['message', 'summary'].some(id => document.getElementById(id)?.value.trim());
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
  });
})();
