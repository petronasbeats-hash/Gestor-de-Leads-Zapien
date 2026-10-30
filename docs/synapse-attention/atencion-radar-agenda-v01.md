# Atención pendiente y Agenda práctica · V0.1

## Resultado de esta entrega

Radar incorpora Atención junto a Territorio y Destaca. Un mensaje leído sigue
pendiente hasta tener respuesta en su mismo hilo o un registro explícito de
atención por otro medio. Un seguimiento escrito en la bitácora también tiene
cierre con resultado, conservando su acción original.

Desde Radar se abre la conversación correcta y su organización autorizada.
La consulta es privada por organización, asesor asignado y alcance de inmuebles.
El asesor conserva acceso a una conversación de un inmueble retirado de publicación,
siempre que el inmueble siga en su alcance. Los enlaces públicos conservan su
validación de publicación; esto no vuelve a publicar el inmueble.
La proyección no incluye texto de mensajes, teléfonos, tokens, notas ni fotos.
Una fuente fallida se muestra como consulta incompleta; no como lista verificada
sin pendientes. La actualización ocurre al entrar, recuperar foco y cada minuto
con Radar visible. No es una notificación push ni un mecanismo de entrega externa.

## Respuestas y contexto

- Los mensajes nuevos llevan secuencia causal dentro de la transacción de la
  conversación. Los mensajes históricos continúan funcionando; una respuesta
  antigua con la misma marca de tiempo no se considera prueba suficiente de cierre.
- Abrir, leer, copiar un texto o abrir WhatsApp no cierra pendientes.
- «Ya lo atendí por otro medio» exige WhatsApp o Messenger y un resultado.
  Registra una declaración del asesor, sin afirmar envío, entrega o lectura.
- El cierre comprueba el último mensaje entrante. Si llegó otra pregunta mientras
  se llenaba el formulario, se rechaza el cierre obsoleto. Repetir el mismo comando
  no cierra una pregunta llegada después del primer guardado.
- Un seguimiento se cierra por su identificador de acción. Cambiar la siguiente
  acción antes de cerrarla invalida el formulario anterior.
- Las rutas nuevas usan autenticación del servidor y transacciones existentes.
  No se cambia ninguna regla ni se agrega acceso público a datos de Atención.

## Medio preferido

El cliente puede elegir Synapse, WhatsApp o Messenger / Facebook en su enlace.
El asesor puede registrar lo acordado. Se distingue esta preferencia del origen,
canal de entrada e identidad: ninguno se reescribe ni se da por verificado.
La elección queda en la bitácora e indica quién la declaró. Un invitado puede
elegir sin teléfono; necesita el mismo enlace vigente y secreto de navegador.
Elegir medio es una interacción explícita que puede abrir su sesión de invitado.
No reactiva enlaces vencidos/revocados ni activa conectores externos.

## Agenda

Dentro de la cita, «Registrar cliente aquí» permite capturar nombre y teléfono.
Las coincidencias se ofrecen para reutilizar la ficha; nunca se fusionan por
semejanza ni se generan duplicados silenciosos. Si una ficha carece de teléfono,
se puede completarlo desde la misma pantalla, conservando su historial. Los datos
de fecha, hora, inmueble y asunto permanecen en el formulario al guardar al cliente.
Guardar un contacto no crea una cita: la reserva mantiene su guardado separado,
validación de disponibilidad, teléfono y folio. No se rebajan sus requisitos.

Radar y Agenda muestran el compromiso más próximo de las siguientes 24 horas.
El aviso interno usa la hora de Ciudad de México, se actualiza cada minuto con
la página visible y permite abrir la cita original. Omite tareas sin hora,
apartados provisionales, eventos cerrados y sincronizaciones pendientes.

## Límites y publicación

Esta entrega no activa recordatorios externos, envío de WhatsApp/Messenger,
servicios en segundo plano ni sincronización con calendarios de terceros.
El estado de salud conserva `reminders: false` para recordatorios de servidor;
`attentionRadar` y `contactPreferences` describen las nuevas capacidades reales.
Las integraciones financieras, elegibilidad Destaca y custodia de fotos conservan
sus límites anteriores. No hay migración, limpieza de clientes ni cambios masivos.

Requiere Functions `synapse-attention` y Hosting, incorporando también los ajustes
de contraste y formularios de la entrega anterior. Los documentos y pruebas no
se empaquetan como contenido público. El código preparado no implica publicación.

## Validación

La suite cubre aislamiento, reintentos, lectura sin cierre, empate de fechas,
hilos diferentes, mensajes nuevos durante el cierre, preferencia sin teléfono,
continuidad del mismo enlace, cierre de seguimiento, proyección real en Radar y
alta rápida en Agenda con preservación de borradores e historial.
El emulador de Atención añade concurrencia entre dos instancias y comprueba que
la nueva pregunta siempre permanece pendiente. Solo se usan datos ficticios.
La prueba de interfaz usa el HTML y JavaScript reales mediante DOM simulado;
no acredita por sí sola apariencia visual ni funcionamiento publicado.
