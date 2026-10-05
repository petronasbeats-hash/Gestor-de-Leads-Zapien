# Habitat Lab · Server Booking Protocol V0.1

Estado: diseño de laboratorio. No desplegar.

## Objetivo

Eliminar la carrera estructural del flujo público actual:

`claim slot -> crear/actualizar lead -> crear cita`

El navegador no debe ser la autoridad que decide ni repara integridad.

## Autoridad

Un proceso confiable (Firebase Admin SDK / Cloud Function / backend) recibe una intención de reserva y coordina:

1. validación;
2. claim del slot;
3. persistencia de cita;
4. persistencia de evidencia;
5. respuesta idempotente al cliente.

El navegador sólo solicita.

## Idempotency key

Cada intento debe enviar un `requestId` único.

Propuesta:

`booking_requests/{requestId}`

Estados:

- `received`
- `processing`
- `confirmed`
- `rejected`
- `error_recoverable`

Campos mínimos:

- `requestId`
- `slotKey`
- `propiedadId`
- `unitId`
- `availabilityVersion`
- `intentType: "request_visit"`
- `citaId`
- `status`
- `createdAt`
- `updatedAt`

No duplicar PII innecesaria en este nodo.

## Invariantes

- Un `requestId` produce como máximo una cita.
- Un `slotKey` produce como máximo una cita activa.
- Si el slot ya pertenece al mismo `requestId/citaId`, repetir la operación devuelve el mismo resultado.
- Si el slot pertenece a otro intento, se rechaza.
- Nunca se libera un slot desde el cliente.
- Toda transición relevante deja evidencia.

## Flujo confiable propuesto

### 1. createBookingIntent()

Servidor valida payload y crea/lee `booking_requests/{requestId}`.

Si ya está `confirmed`, devuelve su `citaId`.

### 2. claimSlot()

Transacción en `citas_publicas/{slotKey}`.

Claim propuesto:

```json
{
  "requestId": "...",
  "citaId": "...",
  "status": "processing",
  "propiedadId": "...",
  "unitId": "...",
  "availabilityVersion": "1"
}
```

Sólo se crea si el nodo está vacío.

### 3. persistBooking()

Con autoridad del servidor:

- upsert lead;
- crear `citas/{citaId}`;
- registrar evidencia;
- cambiar slot a `status: "confirmed"`;
- marcar `booking_requests/{requestId}: confirmed`.

La operación debe diseñarse para poder reintentarse.

## Recuperación

Si el servidor cae después del claim:

- el slot queda `processing`;
- el reconciliador revisa `booking_requests/{requestId}`;
- si existe información suficiente, completa la operación;
- si no, marca incidencia y sólo una autoridad confiable decide liberación.

Esto es preferible a crear directamente un slot `confirmed` antes de tener cita.

## Event Trace

Propuesta:

`system_events/{eventId}`

Tipos iniciales:

- `HABITAT_BOOKING_REQUEST_RECEIVED`
- `HABITAT_SLOT_CLAIMED`
- `HABITAT_CITA_CREATED`
- `HABITAT_BOOKING_CONFIRMED`
- `HABITAT_BOOKING_REJECTED_SLOT_TAKEN`
- `HABITAT_BOOKING_RECOVERY_REQUIRED`
- `HABITAT_BOOKING_RECOVERED`

## Seguridad RTDB futura

Cliente público:

- puede leer disponibilidad pública necesaria;
- no puede escribir directamente `citas_publicas`;
- no puede crear `citas`;
- no puede borrar claims;
- no puede escribir `system_events`.

Servidor:

- Admin SDK con autoridad controlada.

## Migración

No cambiar producción hasta que el protocolo pase:

1. idempotencia por requestId;
2. carrera de 20 intentos;
3. fallo después de claim;
4. fallo después de cita;
5. reintento del mismo request;
6. intento de propietario distinto;
7. reconciliación de `processing`;
8. auditoría final sin huérfanos.

## Nota sobre slotKey

La clave global actual `YYYY-MM-DD_HH:mm` bloquea ese horario para todas las unidades.

Antes de producción multiunidad debe evaluarse:

`citas_publicas/{unitId}/{slotKey}`

o una clave compuesta equivalente.

No migrar sin compatibilidad con Agenda/Reservar.
