(function () {
  'use strict';

  function abrirReprogramacion(cita) {
    if (!cita || !cita.id) {
      alert('No se encontró la identidad de la cita.');
      return;
    }

    const fechaActual = cita.fecha || '';
    const horaActual = cita.hora || '';

    const fechaNueva = prompt(
      '↻ Reprogramar cita\n\nFecha nueva (AAAA-MM-DD):',
      fechaActual
    );

    if (fechaNueva === null) return;

    const horaNueva = prompt(
      'Hora nueva (HH:MM):',
      horaActual
    );

    if (horaNueva === null) return;

    const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaNueva) &&
      (() => {
        const [y, m, d] = fechaNueva.split('-').map(Number);
        const fecha = new Date(Date.UTC(y, m - 1, d));
        return fecha.getUTCFullYear() === y &&
          fecha.getUTCMonth() === m - 1 &&
          fecha.getUTCDate() === d;
      })();

    const horaValida = /^([01]\d|2[0-3]):[0-5]\d$/.test(horaNueva) &&
      (() => {
        const [h, m] = horaNueva.split(':').map(Number);
        const minutos = h * 60 + m;
        return minutos >= 540 && minutos <= 1200 && m % 30 === 0;
      })();

    if (!fechaValida || !horaValida) {
      alert('Fecha inválida o fuera del horario 09:00–20:00, cada 30 minutos.');
      return;
    }

    if (fechaNueva === fechaActual && horaNueva === horaActual) {
      alert('Seleccionaste el mismo horario.');
      return;
    }

    alert(
      '↻ Reprogramación preparada\n\n' +
      'Cita: ' + cita.id + '\n' +
      'Anterior: ' + fechaActual + ' ' + horaActual + '\n' +
      'Nuevo: ' + fechaNueva + ' ' + horaNueva + '\n\n' +
      'Pendiente de validación por Gateway.\n' +
      'No se modificó ninguna reserva.'
    );
  }

  window.SynapseReprogramarV1 = Object.freeze({
    abrir: abrirReprogramacion
  });
})();
