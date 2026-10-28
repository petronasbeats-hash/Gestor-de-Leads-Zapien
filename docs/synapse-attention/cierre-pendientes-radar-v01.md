# Cierre de pendientes en Radar

Radar muestra acciones abiertas, no un inventario de todo lo ocurrido. La fecha vencida no demuestra que la actividad se haya cumplido.

- **Tarea:** Completar tarea abre el evento con estado Realizado y pide un resultado. Al guardar, sale del Radar. El mismo ID, notas, participantes y resultado permanecen en Agenda e historial.
- **Cita o compromiso iniciado:** Registrar resultado prepara el estado Realizado para revisión. También puede elegirse Cancelado o No asistió, con resultado y motivo cuando corresponda. No se permite afirmar realización/no asistencia antes de su inicio. Un evento futuro conserva la acción de confirmar/preparar.
- **Seguimiento antiguo de una persona:** Completar seguimiento abre un cierre explícito, permite Completada o Cancelada y exige describir el resultado. La transacción verifica versión, texto y fecha originales: un cambio concurrente no se cierra con datos antiguos. El cierre guarda acción, fecha prevista, responsable, fecha real y resultado en historial/bitácora antes de retirar la próxima acción de los pendientes. Conserva la persona y sus otras relaciones.
- **Operación:** completar su evento no cierra toda la venta/renta. Radar muestra la acción siguiente que corresponda; avanzar exige evidencia. Una operación Completada o una relación de propiedad Vigente conserva su ficha sin convertirse en pendiente.
- **Sincronización pendiente:** permanece visible para reparación aunque el evento figure cancelado o realizado. Solo se retira cuando la ocupación queda consistente.

Los cierres no eliminan registros ni se ejecutan por transcurrir la fecha. No hay cierre masivo automático, envío a clientes ni avance silencioso de etapas.

La entrega se valida junto con la visita desde Atención: 173 pruebas de aplicación y 16 comprobaciones del RTDB Emulator. Se añadieron pruebas del cierre idempotente, conservación de historial/relaciones, rechazo de formularios desactualizados, tareas/compromisos debidos y el flujo DOM real que retira tarjetas sin borrar el evento/contacto. Publicación preparada; pendiente de desplegar la versión y verificarla en el portal.
