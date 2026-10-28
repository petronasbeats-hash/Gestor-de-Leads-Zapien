'use strict';
(() => {
  const root = document.getElementById('configuration-home');
  if (!root) return;
  const path = location.pathname, legacy = new URLSearchParams(location.search).get('legacy') === '1';
  const properties = path === '/inmuebles', hours = path === '/agenda/horarios';
  document.body.classList.toggle('synapse-legacy', legacy);
  const title = legacy ? 'Administración anterior' : properties ? 'Inmuebles' : hours ? 'Agenda · Horarios y bloqueos' : 'Configuración';
  document.getElementById('admin-module-title').textContent = title;
  document.title = title + ' · Synapse Core';
  document.getElementById('admin-module-description').textContent = legacy
    ? 'Consulta de registros y herramientas anteriores.'
    : properties ? 'Fichas, fotografías, precios y publicaciones.'
    : hours ? 'Disponibilidad para visitas y periodos que necesitas reservar.'
    : 'Herramientas de administración de tu espacio de trabajo.';
  if (properties || hours) {
    document.getElementById('view-tab-citas').click();
    document.querySelector('.admin-tab-btn[data-tab="' + (properties ? 'propiedades' : 'disponibilidad') + '"]').click();
  } else if (!legacy) {
    document.getElementById('leads-view').style.display = 'none';
    document.getElementById('citas-view').style.display = 'none';
    root.hidden = false;
  }
})();
