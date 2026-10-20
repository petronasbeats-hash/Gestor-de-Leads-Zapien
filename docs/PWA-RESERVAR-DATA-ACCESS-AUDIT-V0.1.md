# Auditoría de contratos de acceso — Habitat/Reservar y Synapse Admin (2026-10-20)

**Estado:** hallazgos del código fuente. Reglas RTDB/Storage desplegadas **no verificadas**. No modificar reglas en producción sin emulador y aprobación.

## Evidencia de `reservar.html`
- `loadPublicAvailability()` escucha `disponibilidad/horarios`, `disponibilidad/bloqueos`, `citas_publicas` y `propiedades` mediante `on('value')`.
- Al crear una reserva, el navegador obtiene una clave en `leads` y escribe `leads/<id>` directamente.
- El navegador obtiene una clave en `citas` y prepara una actualización multipath que incluye `citas/<id>` y `citas_publicas/<slot>`.
- La configuración del frontend apunta a Realtime Database `gestor-leads-zapien-default-rtdb`. La configuración pública del SDK **no acredita** seguridad ni acceso.
- El frontend público no llama a `signInAnonymously` en el código inspeccionado.

## Riesgo de arquitectura
Una regla que permita al visitante crear `leads` o `citas` directamente debe impedirle leer o modificar registros ajenos. Las operaciones multipath también deben validarse juntas para impedir reservas duplicadas y escrituras arbitrarias. La lectura pública del árbol completo `propiedades` puede revelar campos internos si se publican allí; debe existir una proyección pública con campos explícitamente permitidos.

**No asumir que estos riesgos están explotables:** sin las reglas desplegadas, no sabemos qué operaciones REST son aceptadas.

## Contrato objetivo (a diseñar y probar, no implementado)
1. Admin autenticado y autorizado: acceso por rol/organización a datos privados, con validación del servidor.
2. Visitante sin login: consultar únicamente disponibilidad agregada y fichas publicadas, sin teléfonos ni datos privados.
3. Visitante: crear solicitud limitada mediante endpoint validado y transacción que reserve el slot; no escritura general en `leads`, `citas` o `propiedades`.
4. Denegar consultas generales y actualizaciones de terceros; probar concurrencia, abuso, suplantación y reintentos.
5. Migración compatible: mantener `/reservar` funcional hasta validar un mecanismo nuevo en entorno aislado.

## Gate previo al despliegue
- Obtener reglas **realmente desplegadas** de RTDB y Storage y contrastarlas con este inventario.
- Preparar emuladores RTDB/Auth/Storage y casos negativos REST, además de dos reservas concurrentes.
- Identificar campos privados existentes en `propiedades` antes de exponer cualquier listado público.
- Conciliar GitHub, copia local y versión hospedada; hacer pruebas de regresión de `/reservar`.
- Publicar solamente con autorización explícita y plan de reversión.

**Esta auditoría no equivale a una solución desplegada ni a un certificado de seguridad.**
