# Synapse Atención · protocolo operativo y bitácora V0.1

Mandato del usuario: pasar del prototipo a operación, aplicar el folio al código,
consultar disponibilidad viva antes de cada atención y usar resúmenes de las
interacciones para seguimiento diario, síntesis y decisiones de mejora continua.

## Disponibilidad y reserva

- Cada nueva atención invoca `createLiveAvailabilityReader`. Se consultan las
  cuatro rutas públicas actuales. Si no responde el proveedor, no ofrecer datos
  anteriores como disponibilidad vigente.
- Se registra el instante observado. Se vuelve a leer y se valida en servidor al
  reservar, porque otro cliente puede ocupar un horario durante la conversación.
- Horario final verificado en esta sesión: todos los días de 09:00 a 20:00,
  intervalos de 30 minutos. La configuración viva es la autoridad; no fijarlo
  como política inmutable.
- El código compartido `shared/reservation-reference.js` conserva los folios ya
  almacenados y el formato `RSV-…` del proyecto. Lo usan Reservar y la conversión
  de HOLD del panel. Una selección o solicitud en proceso no genera un folio de
  éxito. La unicidad global se debe verificar en el gateway de producción.
- Portal público y Monitor deben terminar en el mismo gateway de reserva, con
  autorización, exclusión de horario, idempotencia y escritura trazada. La rama
  recibida aún contiene escrituras directas legacy; este documento no las
  considera una integración segura del Monitor.

## Resumen de cada interacción

La bitácora es privada, por organización y append-only. El cliente no escribe
directamente en ella. La autoridad de servidor valida agente y organización.
La función `prepareEntry` recibe los hechos de la interacción y prepara:

- Referencias a conversación/interacción, fuente, canal e inmueble.
- Resumen de lo que ocurrió, datos confirmados y preguntas abiertas.
- Folio si existe una reserva registrada; ninguna confirmación inventada.
- Siguiente acción, fecha si se conoce y estado pendiente/hecho.
- Fecha real de la interacción y fecha de registro por separado.

Importar una conversación sin fecha no convierte su fecha de atención en hoy.
Los datos personales y las bitácoras reales no se guardan en GitHub. La bitácora
operativa de cliente permanece en almacenamiento privado; los fixtures solo
contienen publicaciones públicas y ejemplos de prueba.

`createRtdbJournal` escribe un evento con transacción y detecta reintentos o
conflictos sin sobrescribirlo. Correcciones se añaden como otra entrada. Falta
validar el adaptador con el proyecto/emulador y conectar los eventos del Monitor;
las pruebas actuales del contrato utilizan un adaptador de memoria.

El registro de reserva debe incluir un evento/outbox duradero en su operación
autoritativa. Si falla el resumen posterior, se reintenta la bitácora, no se crea
otra reserva ni se informa al cliente que su reserva falló si ya fue registrada.

## Seguimiento y mejora continua

`dailyReport` usa America/Mexico_City, conserva pendientes de días anteriores,
lista reservas por folio y agrupa preguntas recurrentes con referencias a las
interacciones. Las propuestas quedan en revisión humana. Un caso individual
también puede documentar una fricción relevante; no es una autorización para
cambiar precios, términos o comportamiento del sistema.

Cadena de trabajo: interacción → resumen → pendiente → seguimiento diario →
síntesis → propuesta → decisión del usuario → cambio → validación del resultado.
Los aprendizajes son registros y reglas revisables; no se promete entrenamiento
automático del modelo ni lectura autónoma de mensajes de Facebook/WhatsApp.

No se configura un reporte programado sin una frecuencia/hora solicitada.

## Estado de implementación y activación

Preparado: contrato de continuidad, prototipo del panel/Monitor, referencia
compartida aplicada a los HTML, lector de disponibilidad viva y adaptador de
bitácora con síntesis diaria. Pruebas de contrato y simulación separadas de la
validación real de RTDB.

Para activar: completar la inspección de Auth y Storage, revisar los módulos
locales actualizados, integrar el gateway, las invitaciones y los eventos en el
Monitor, pasar las pruebas de concurrencia y regresión y desplegar el candidato
revisado. No se modifican las reglas ni se abre escritura pública para salvar
este bloqueo. El acceso CLI del Mac permite continuar; no constituye una conexión
autenticada de Firebase a este chat.

## Evidencia real recibida · 26 de octubre de 2026, México

La salida CLI compartida por el usuario confirma el proyecto
`gestor-leads-zapien`, una instancia `gestor-leads-zapien-default-rtdb` y cuatro
sitios de Hosting. No se reportan Cloud Functions desplegadas. Esto no descarta
servicios externos; su existencia no está acreditada en esta revisión.

La carpeta actual del Mac es `~/Downloads/Gestor-de-Leads-Zapien`, rama
`lab/property-experience-v2`. Tiene cambios en Admin/Reservar y módulos locales
de reservas, disponibilidad y emulador que aún no están incorporados al repositorio
remoto revisado. Deben inspeccionarse antes de sustituir archivos o integrar el
candidato. No usar `reset`, `clean` ni un cambio de rama que pierda ese trabajo.

La configuración local dirige el target `synapse` al sitio `synapse-core`.
Las consultas públicas de esta sesión confirman que tanto `synapse-core.web.app`
como `gestor-leads-zapien.web.app` responden, pero sus HTML de Admin y Reservar
son distintos. Ninguno incorpora el nuevo contrato `SynapseContinuity`.
El destino del despliegue debe quedar explícito antes de publicar. La raíz
de Hosting es `.` y su lista de exclusiones no aparta respaldos/laboratorios;
se necesita preparar una salida de publicación acotada al candidato validado.

### Reglas RTDB recibidas desde el proyecto

Fuente: exportación autenticada `database:get '/.settings/rules'`, con variables
de emulador retiradas para ese comando, compartida por el usuario en este chat.
El original permanece en el adjunto privado; no se copia a GitHub su UID real.

- No existe permiso para `atencion_v1` ni concesión en la raíz: el acceso desde
  clientes al nuevo journal/Monitor permanece denegado, incluso para el UID
  operador. Un servicio Admin puede tener otros privilegios y debe implementar
  su propia autorización efectiva; no se supone protegido por estas reglas.
- Leads/citas privados tienen lecturas restringidas a un único UID operador.
  No es todavía un modelo de autorización por organización ni identifica por
  sí solo la conexión con Zap Auth.
- Hay permisos de creación sin autenticación para citas y slots inexistentes.
  La creación pública de leads depende únicamente de la condición de fuente.
  No se observan validaciones de esquema, folio, identidad ni vínculo entre esas
  escrituras. Una concesión de creación no acredita reserva atómica o sin choque.
- En leads existentes, `proximaAccion` y `fechaProximaAccion` se pueden escribir
  sin autenticación; se permite añadir una nota de bitácora si el lead existe.
  El nuevo Monitor no debe reutilizar estos permisos como autorización.
- El índice de teléfonos impide leer el padre, pero permite leer cada teléfono
  individual y crear una entrada ausente sin autenticación. Conocer un teléfono
  no verifica la titularidad de la conversación.
- Propiedades, disponibilidad y citas públicas tienen lectura pública. Revisar
  el contenido permitido antes de proyectar datos a una vista de cliente; no
  asumir que toda la ficha o una cita privada puede publicarse.
- La salida recibida muestra `Agenda pÃºblica` en la condición de fuente. Se
  debe verificar el valor literal y el código local antes de corregir una
  posible diferencia de codificación; no se normalizó ni cambió producción.

Se trata de un análisis de reglas y de salidas CLI, no de pruebas ejecutadas
contra clientes reales. No se intentaron escrituras anónimas en producción,
no se cambiaron reglas y no se desplegó el Monitor.
