# Habitat · Puerta de seguridad V0.1 (sólo laboratorio)

## Estado y límites

El modelo de booking pasó las pruebas previas de concurrencia, recuperación y trazabilidad en el emulador, pero esas pruebas emplean un cliente Firebase con acceso de escritura. **Eso no demuestra seguridad ni autoridad de servidor.**

Se agregó `lab/habitat/database.rules.secure-lab.json` como borrador de reglas **no desplegado**. Niega a clientes las escrituras en `citas_publicas`, `booking_requests`, `citas`, `system_events`, `leads` y `telefonos_index`. La lectura pública de `propiedades` y `units` es únicamente una hipótesis de laboratorio: antes de usar estas reglas hay que crear proyecciones públicas que no expongan información privada. **No aplicar estas reglas a producción ni al emulador que contiene las pruebas anteriores sin aislar otro proceso/namespace.**

## Autoridad de servidor

1. Endpoint HTTPS autenticado y limitado por tasa para recibir intención de reserva y `requestId`.
2. Validar formato, disponibilidad y datos mínimos. No confiar en `unitId`, precio ni estado proporcionados por el navegador.
3. Usar Admin SDK en un proceso exclusivo del emulador. El Admin SDK omite reglas de cliente; validar autorización dentro del endpoint.
4. Conservar la identidad de `requestId` de forma duradera, no sólo en memoria.
5. Registrar evidencia append-only con IDs deterministas por transición para no duplicar eventos al reintentar.

## Riesgos aún abiertos

- La implementación actual usa `booking_requests/{requestId}` y `citas_publicas/{slotKey}` en escrituras independientes: dos ejecuciones del mismo `requestId` pueden intercalarse.
- Tras crear `citas/{citaId}`, la confirmación del slot y del request no es atómica.
- Una recuperación no debe liberar un slot mientras una operación activa todavía está creando la cita.
- Las reglas de lectura pública aquí son deliberadamente provisionales y pueden exponer datos. Crear nodos `public_properties` y `public_availability` filtrados antes de producción.
- `slotKey` global impide reservas simultáneas en distintas unidades.
- Los tests existentes no validan las reglas ni el Admin SDK.

## Puerta de aceptación

En **un segundo emulador aislado** y con una base limpia:

1. Cliente público: lectura sólo de proyecciones permitidas; escritura denegada en todos los nodos protegidos.
2. Admin SDK: escritura autorizada a los nodos protegidos.
3. Repetir 20 solicitudes con 20 IDs y luego 20 solicitudes con **el mismo** `requestId`.
4. Inyectar fallo en cada escritura y reiniciar el proceso antes de recuperación.
5. Verificar event trace sin duplicados y ausencia de PII en registros públicos.
6. Probar que una cita en curso no puede ser liberada por reconciliación.
7. Sólo entonces integrar el formulario de Habitat al endpoint.

**No desplegar ni mezclar con las pruebas previas hasta superar esta puerta.**
