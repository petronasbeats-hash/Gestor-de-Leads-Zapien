# Continuidad de atención por canal — propuesta operativa V0.1

Objetivo: responder sin obligar al cliente a cambiar de aplicación y mantener una próxima acción verificable. El enlace Synapse es una opción, no una condición para recibir información o agendar una visita.

## Canal elegido por el cliente

| Opción | Experiencia | Estado real hoy |
|---|---|---|
| Messenger/Facebook | Recibe informes y acuerda la visita en su conversación original. La fuente Marketplace permanece aunque después cambie de canal. | El agente responde/copia en Messenger y registra el resumen. No hay conector de recepción/envío automático. |
| Enlace Synapse sin número | Abre la ficha y conversa como invitado sin registro/SMS. | Implementado en un navegador vinculado; enlace de 24 h, con límites de caducidad/rotación. Corrección preparada para conservarlo al agregar teléfono. |
| WhatsApp | El cliente elige continuar por un número de atención configurado; se conserva la referencia de su atención. | Hay acceso wa.me para el agente, pero no sincronización automática de mensajes. Falta configurar el destino del negocio y registrar la preferencia; no usar el teléfono de una ficha externa como si fuera el del asesor. |

Propuesta de entrada: «Con gusto te ayudo. ¿Prefieres continuar por aquí, por WhatsApp o mediante un enlace donde puedes ver la ficha y conversar sin registrarte?» No pedir teléfono para consultar la ficha. Para una cita, confirmar nombre/contacto o documentar una excepción operativa explícita; no inventar datos para superar validaciones.

## Registro común propuesto

Conservar contactId si existe, conversationId, source y entryChannel originales, currentChannel, preferredChannel, externalThreadRef por conector si está disponible, inmueble actual/original, responsable, última interacción real, siguiente acción con vencimiento, consentimiento/canal autorizado y estado de continuidad. Estos campos son diseño a integrar; no se afirma que ya exista el formulario de preferencia.

No guardar alias de Facebook como identidad documental verificada. No fusionar personas automáticamente por nombres, ni por compartir un teléfono. El enlace invitado tampoco verifica identidad.

## Estados y evidencias

- Preparado: texto o enlace generado.
- Copiado: acción de copiar, no prueba de envío.
- Registrado en Synapse: el servidor guardó el mensaje; no acredita entrega externa o lectura.
- Enviado externamente por el agente: declaración manual identificada, con fecha real/canal; no equivale a confirmación del proveedor.
- Aceptado/entregado/leído por proveedor: únicamente con webhook o respuesta oficial que confirme ese estado.
- Respuesta recibida: mensaje del cliente observado en Synapse o registro/importación autorizado desde su canal, con fecha de ocurrencia y registro separadas.
- Esperando al cliente / esperando al equipo / cita acordada / requiere revisión / cerrado: próximos pasos de atención, independientes del estado jurídico o financiero.

No emitir etiquetas «no le interesa», «no abrió» o «leído» por ausencia de actividad. Si no existe evento de apertura, solo puede decirse «sin apertura registrada» y verificar el canal original.

## Bandeja única y política propuesta

Radar debe consumir pendientes de Atención, Directorio, Agenda e integraciones, con responsable, fecha y origen. Un mensaje nuevo del cliente tiene prioridad; responder dentro de Synapse o registrar respuesta externa resuelve esa acción sin borrar historial. Si luego se espera al cliente, se crea otro siguiente paso con fecha.

Propuesta inicial, por aprobar/configurar: aviso inmediato con el panel abierto, atención prioritaria dentro del horario laboral; revisión al cerrar cada bloque de trabajo y lista de sin respuesta al final del día. Para un cliente sin respuesta, un contacto útil por su canal elegido al siguiente día hábil; otro intento posterior solo conforme a consentimiento y contexto. La cadencia no se activa por esta documentación ni constituye autorización para enviar mensajes desde este chat.

El sonido Nexo actual depende del navegador/panel activo. Push, correo o escalamiento programado al agente requieren conectores y permisos; no están activos por tener un sonido. La plataforma no debe depender de que el agente esté en la pestaña de la atención concreta.

## Rescate de la atención actual

1. Revisar en el monitor sincronización/errores, fecha de última actualización, enlace vigente, inmueble publicado y si el cliente abrió desde otro navegador. No regenerar enlaces en masa.
2. Contrastar el hilo original de Messenger/WhatsApp. Responder allí si esa fue la elección; registrar la interacción una sola vez y la próxima acción.
3. No solicitar al cliente un paso técnico extra para darle ubicación/precio/informes o acordar día preferido. Si el enlace falla, ofrecer continuar por el canal actual.
4. Al acordar la visita, leer disponibilidad vigente, registrar una vez, obtener folio y preparar confirmación para revisión/envío. Un texto de confirmación preparado no acredita envío.
5. Enlaces ya vencidos/revocados no son reabiertos por la corrección de teléfono; su recuperación requiere un nuevo vínculo autorizado.

## Aprendizaje y mejora continua

La bitácora registra hechos confirmados, preguntas abiertas, objeciones, canal, resultado y siguiente acción; distingue declaración del cliente, dato del inmueble y revisión del responsable. Sus resúmenes son editables con historial, no verdad automática.

El reporte diario existente de Atención puede detectar temas repetidos y proponer mejoras. Debe integrarse con el Radar común y medir respuesta por canal, atención pendiente, apertura observada, falla de enlace, visita acordada/realizada y avance documentado. No mezclar «copiado» con «enviado» ni personas con número de mensajes.

Respuestas frecuentes: sugerencia contextual y revisión humana antes de enviar. Cada corrección aprobada genera una versión con inmueble/fuente/fecha, sin extender condiciones particulares al catálogo completo. No se entrenó un modelo ni se activó memoria autónoma con datos de clientes.

Automatizar primero: cálculos de disponibilidad, folios, actualización de pendientes, detección de duplicados, avisos al agente y borradores. Automatizar envíos al cliente después de configurar consentimiento, canal oficial, calendario y prevención de duplicados. Cierre de contratos, cobros y validación documental siguen bajo su autoridad correspondiente.
