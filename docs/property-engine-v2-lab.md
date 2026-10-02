# Property Engine V2 — contrato de evolución (laboratorio)

Estado: propuesta técnica para pruebas. No desplegar. Rama creada desde main remoto; **el index.html remoto aún contiene el fragmento duplicado** que fue corregido únicamente en el Mac. Antes de implementar código, incorporar a esta rama la corrección local validada y comparar su diff. No copiar la versión remota defectuosa sobre la local.

## Diagnóstico del código remoto
- index.html administra `propiedades/{id}` con alta `set` y edición `update`; ya dispone de `propertyName`, `propertyGroupId`, `unitId`, `unitNumber`, `unitType`, `category` y `engineVersion`.
- agenda.html y reservar.html consumen `propiedades`, `disponibilidad/horarios`, `disponibilidad/bloqueos` y `citas_publicas`. Deben mantener compatibilidad con los IDs actuales.
- No cambiar ni migrar datos reales sin inventario, respaldo, validación y rollback.

## Contrato V2 incremental
1. Mantener `propiedades/{id}` y su ID como interfaz compatible de publicación para Agenda y Reservar. Las propiedades individuales existentes siguen siendo válidas sin campos nuevos.
2. Añadir entidades canónicas nuevas en rutas separadas, inicialmente solo en el emulador: `property_groups/{groupId}`, `buildings/{buildingId}`, `units/{unitId}`. IDs técnicos inmutables y números comerciales independientes.
3. `units/{unitId}`: `propertyGroupId`, `buildingId`, `unitNumber`, `unitType`, `commercialStatus`, `occupancyStatus`, `operationalStatus`, `schemaVersion`. No deducir ocupación únicamente de `activo`.
4. Mantener una relación explícita `propiedades/{id}.unitId` cuando una publicación represente una unidad. Las propiedades tradicionales permanecen sin `unitId`. No reutilizar `unitId` como identificador de publicación.
5. Versionar cualquier proyección de unidad hacia publicación y evitar escrituras bidireccionales silenciosas. Definir y probar reconciliación antes de sincronización automática.
6. Registrar eventos append-only por entidad y mostrar fallos de sincronización o validación. Preservar el historial existente de citas.
7. Las reservas deben comprobar disponibilidad de la unidad además del horario. La prevención de reservas simultáneas requiere transacción/reglas verificadas en emulador, no solo filtros de interfaz.

## Secuencia de implementación
- Fase 0: reconciliar corrección local de index y crear pruebas de regresión para login, catálogo y agenda/reservar.
- Fase 1: agregar adaptadores y datos ficticios multiunidad en emulador sin cambiar rutas de producción.
- Fase 2: adaptar formulario y vistas de administración, estados separados y avisos.
- Fase 3: integrar disponibilidad y citas con compatibilidad hacia atrás.
- Fase 4: simular ADN 10 con unidades ficticias y ejecutar pruebas de concurrencia, edición y rollback.

## Puerta de salida
Ningún merge a main, push de correcciones locales ni despliegue Firebase hasta pruebas funcionales completas, revisión de reglas y aprobación expresa.
