# Directorio y Radar

Fecha: 28 de octubre de 2026, México. Actualización preparada sobre la versión
Contactos/Agenda publicada en ad2c12a; esta interfaz todavía requiere Hosting.

## Entrada principal

La raíz del sitio abre Radar. Directorio reúne personas, clasificaciones, roles,
operaciones e historial. La clasificación de una persona no representa la etapa
de todas sus relaciones: puede ser cliente, vendedor en una operación y
propietario en otra. El buscador admite nombre, teléfono, especialidad, rol y
referencia de inmueble/operación; no crea una ficha por cada papel.

Rutas de la nueva construcción:

| Ruta | Función |
| --- | --- |
| `/` y `/radar` | Acciones pendientes |
| `/directorio` | Directorio de personas |
| `/contactos` | Alias conservado del directorio |
| `/operaciones` | Relaciones y sus flujos |
| `/agenda` | Calendario interno |
| `/administracion` | Panel anterior de administración e inmuebles |
| `/reservar` | Catálogo y horarios del cliente |
| `/atencion-operador` | Conversación y avisos de mensajes |

La construcción copia el panel anterior a `administracion.html` y sirve el
espacio nuevo como `index.html`. No confía en un rewrite de `/`, porque el archivo
de índice es una ruta estática. No borra datos ni cambia permisos. El portal
anterior `agenda.html` se conserva por compatibilidad.

## Qué destaca Radar

Prioridad: sincronización pendiente, fechas vencidas, hoy, próximos compromisos
y acciones sin fecha. Las tarjetas indican el contexto y abren su registro real:

| Pendiente | Acceso |
| --- | --- |
| Ocupación pendiente de sincronizar | Evento con acción de completar sincronización |
| Cita por confirmar | Mismo evento, con confirmación preparada para revisar |
| Cita comenzada | Registro del evento y su resultado |
| Tarea | Registro de seguimiento |
| Seguimiento anterior de una persona | Su ficha, bitácora y contexto abiertos |
| Requisito de una operación | Su etapa y acción, con controles de evidencia |
| Evento realizado que permite avanzar | Operación para revisar el avance |

Abrir una tarjeta no guarda, confirma, cancela ni envía nada. Los formularios
mantienen sus controles de versión, evidencia, duración e idempotencia.
Los avisos de mensajes continúan en Atención; no se inventa un inbox de Radar.

Una operación con evento activo pendiente aparece mediante la tarjeta del evento,
evitando repetir esa acción. Al cancelarlo reaparece el requisito de la operación.
Una relación vigente de propiedad y una operación completada permanecen en el
directorio, sin contarse automáticamente como pendientes. Un seguimiento explícito
de una ficha se conserva aunque su etapa antigua sea ganado/perdido: cerrar una
operación no cierra a la persona. Los seguimientos anteriores y las operaciones
son registros distintos; no se fusionan por parecido del texto.

Las acciones sin fecha se identifican como tales. No se deducen vencimientos de
notas ni se inventa una cita. Radar utiliza America/Mexico_City y se actualiza por
los cambios de Firebase y, mientras está visible sin formularios abiertos, cada
minuto. Muestra ocho tarjetas inicialmente, con filtros y acceso a más pendientes.
Salir limpia los datos y cancela la actualización periódica.

## Validación y publicación

Pasaron las 132 pruebas de aplicación (10 nuevas para esta actualización),
la comprobación de sintaxis y los hashes de la construcción de 39 archivos,
23 públicos.

Pruebas del modelo de prioridades, fecha mexicana, operaciones terminadas,
seguimiento de clientes existentes, deduplicación por evento vinculado y fechas
inválidas. Pruebas DOM de inicio en Radar, acceso al evento existente sin duplicar,
apertura del seguimiento, búsqueda por rol/inmueble y limpieza al salir.
Las pruebas de construcción comprueban que la raíz sirve el espacio nuevo y
Administración conserva exactamente el panel anterior.

La actualización solo requiere reconstruir y desplegar Hosting en synapse-core.
No requiere volver a aplicar reglas ni desplegar Functions. Los datos reales y
las operaciones registradas desde la interfaz publicada se conservan. La revisión
visual de esta variante se realizará después de publicarla; no se ha simulado
una publicación ni se han creado registros de prueba en producción.
