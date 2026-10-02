# Habitat — Capa de uso V1

Estado: contrato de integración en laboratorio. No desplegar. Rama: lab/property-engine-v2.

## Responsabilidad
Habitat es la experiencia pública de intención y conexión; no es el sistema maestro de inmuebles, contratos, cobranza ni ocupación. Su puerta pública actual es `reservar.html`; `agenda.html` sigue siendo una experiencia diferenciada y compatible.

Flujo: PERSONA → INMUEBLE → UNIDAD → INTENCIÓN → DISPONIBILIDAD VERIFICADA → SOLICITUD → CITA → EVIDENCIA → SIGUIENTE ACCIÓN.

## Contrato de lectura
- Leer las publicaciones compatibles en `propiedades/{propiedadId}` y su `unitId` opcional; las propiedades individuales sin `unitId` continúan funcionando.
- Si existe `unitId`, consultar estado derivado de unidad desde el adaptador de Property Core: `occupancyStatus`, `operationalStatus`, `commercialAvailability` y `availabilityVersion`.
- Heredar datos comunes del inmueble, pero precio, fotos, estado y disponibilidad específicos corresponden a la unidad/publicación.
- Mostrar explícitamente si la unidad está disponible, apartada, ocupada, en preparación, mantenimiento, próxima o no publicable. No inferir disponibilidad por `activo` únicamente.

## Intenciones diferenciadas
- `request_visit`: solicita visita; una cita confirmada ocupa un horario de agenda, no aparta la unidad.
- `request_hold`: solicita apartado; solo Property Core puede validarlo y confirmar transición de estado con evento y evidencia.
- `request_information`: contacto comercial sin bloqueo de horario ni de unidad.
- `request_application`: solicitud documental; no crea contrato automáticamente.

## Ciclo de una solicitud
`draft → submitted → validating → accepted | rejected | needs_review → completed | cancelled`.
Guardar `requestId`, `intentType`, `propiedadId`, `unitId?`, `leadId?`, `availabilityVersion?`, `createdAt`, `status`, `correlationId` y referencia de evidencia sin copiar documentos sensibles al registro público.

## Compatibilidad con el código actual
- El código remoto de `reservar.html` lee `propiedades`, `disponibilidad/horarios`, `disponibilidad/bloqueos`, `citas_publicas`; conserva estas rutas en la primera fase.
- El flujo actual actualiza o crea lead antes de guardar `citas_publicas/{fecha_hora}` y `citas/{id}` mediante actualización multipath. Esto es atomicidad de escritura, **no** exclusión concurrente. Dos solicitudes simultáneas podrían competir por el mismo horario.
- Antes de habilitar confirmaciones multiunidad, introducir una reserva condicional transaccional y reglas que validen permisos y estado. Las lecturas de interfaz no son autoridad para aceptar apartados.
- Registrar `intentType` y `unitId` como campos opcionales y retrocompatibles en solicitudes/citas nuevas, tras pasar pruebas del adaptador.
- Preservar el historial append-only de citas, notificar fallos y evitar escrituras silenciosas de índice telefónico.

## Primer caso de laboratorio
ADN Suites & Studios: inmueble ADN 10 con unidades ficticias YANG (suites) y YIN (studios). Simular unidades con estado disponible, apartada, ocupada, mantenimiento y preparación. No utilizar datos de arrendatarios reales.

## Pruebas de aceptación
1. Propiedad tradicional sin `unitId` sigue agendable.
2. Unidad disponible admite solicitud de visita sin cambiar su ocupación.
3. Unidad ocupada/mantenimiento no admite apartado; la UI explica el motivo.
4. Dos solicitudes concurrentes para mismo horario no generan dos confirmaciones.
5. Fallo al crear lead/cita deja aviso y no confirma falsamente una reserva.
6. Cambio de disponibilidad entre visualización y envío fuerza nueva validación.
7. Cancelación de cita libera únicamente su bloqueo de agenda; apartado se gestiona por otro evento.
8. No se ejecutan acciones sobre producción desde el laboratorio.

## Orden de ejecución
(1) Reconciliar la corrección local de index.html con la rama; (2) añadir adaptador puro y pruebas; (3) integrar la vista de Habitat; (4) transacciones/reglas; (5) probar end-to-end en emuladores. Sin merge ni deploy sin aprobación.
