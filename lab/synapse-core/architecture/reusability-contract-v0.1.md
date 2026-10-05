# Synapse Core · Contrato de reutilización V0.1
**Estado:** propuesta arquitectónica en laboratorio; no implica implementación ni autorización de despliegue.

## Objetivo
Un solo motor universal para personas, oportunidades, procesos, agenda, eventos y seguimiento, con adaptadores especializados por sector. ADN Suites & Studios es el primer piloto, no una restricción del modelo.

## Núcleo universal
- `tenantId`: organización propietaria de datos, permisos y configuración.
- `personId`: identidad de contacto aislada por tenant; normalización de teléfono y deduplicación sujetas a permisos.
- `caseId`: oportunidad o solicitud; `caseType` definido por adaptador.
- `workflowId`, `state`, `transitionId`: flujo versionado y transiciones explícitas.
- `appointmentId`: agenda genérica; el recurso reservado pertenece a un adaptador.
- `eventId`, `actorId`, `occurredAt`: evento append-only, con causalidad e idempotencia.
- `evidenceRef`: referencia a evidencia verificada por un servicio confiable, nunca una afirmación del navegador.

## Contratos entre motores
1. Cada petición transporta `tenantId`, identidad autenticada, permisos y `requestId` idempotente; el servidor deriva y valida la pertenencia.
2. Synapse emite intenciones de negocio, por ejemplo `appointment.requested.v1`; no escribe directamente estados internos de Property Core.
3. El adaptador de Property Core responde con una decisión autorizada y versionada; no se confía en disponibilidad enviada por cliente.
4. El adaptador de telecomunicaciones podrá resolver `coverage.check.v1` e `installation.requested.v1` sin importar clases inmobiliarias.
5. Ningún motor publica evidencia, confirma reservas ni altera ocupación sin validación de autoridad y reglas propias.
6. Las fallas deben devolver código estable, correlación de solicitud y estado recuperable; nunca una ruptura silenciosa.
7. Eventos versionados, compatibilidad retroactiva, pruebas de contratos y migraciones explícitas antes de cambiar producción.

## Límites obligatorios
- Los datos de un tenant nunca se consultan por otro; probar lectura, escritura, búsqueda, índices y logs.
- Las credenciales de administrador y los tokens de emulador no llegan al navegador.
- No reutilizar una entidad `property` como sustituto universal de producto/servicio.
- No crear un motor de flujos completamente configurable antes de validar dos adaptadores reales.
- Preservar `propiedades/{id}` y la proyección multiunidad actual durante la migración; no reescribir la aplicación en producción.

## Pruebas de aceptación de reutilización
- Mismo flujo universal: captura → validación sectorial → agenda → seguimiento → cierre.
- Adaptador A: ADN, solicitud de visita a unidad elegible; rechazar unidad ocupada, evidencia inválida y carrera de reservas.
- Adaptador B: telecomunicaciones sintético, validación de cobertura e instalación; no importar Property Core.
- Dos tenants sintéticos: impedir lectura, escritura, búsqueda y deduplicación cruzadas.
- Reintentos de la misma solicitud no duplican citas, oportunidades ni eventos.
- Errores sectoriales se propagan con estado visible y evidencia de recuperación.

## Orden de implementación
1. Terminar backend confiable de reservas/publicación y sincronización con Property Core.
2. Extraer contratos universales de lo que ya funciona, sin romper el modelo existente.
3. Construir un adaptador sintético no inmobiliario y pruebas de aislamiento multiempresa.
4. Validar el recorrido ADN extremo a extremo y un segundo rubro en preproducción.
5. Considerar lanzamiento solo después de revisión de seguridad, migración y autorización explícita.

**Criterio de éxito:** un segundo rubro utiliza el mismo núcleo sin copiar sus archivos ni introducir campos sectoriales en entidades universales.
