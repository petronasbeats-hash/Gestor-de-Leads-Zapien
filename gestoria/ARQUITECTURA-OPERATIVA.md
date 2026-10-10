# Synapse + Gestoría Core · Modelo operativo V0.1

**Laboratorio.** Este documento define contratos; no crea citas ni expedientes reales.

## Identidad y relaciones
- `parties/{partyId}`: persona u organización con identidad única; campos sensibles bajo permisos.
- `partyRoles/{roleAssignmentId}`: `partyId`, `organizationId`, `role`, `status`, `validFrom`, `validTo`, `evidenceRef`.
- Roles no excluyentes: prospecto, propietario, arrendador, arrendatario, comprador, vendedor, cliente_gestoria, colaborador, prestador_servicio, proveedor_materiales.
- Los roles se derivan de relaciones verificadas: comprador **no** equivale a propietario registrado; vendedor **no** equivale a propietario validado sin evidencia.

## Operación inmobiliaria
- `transactions/{transactionId}`: `type` (compraventa, arrendamiento, captacion), `propertyId`, `status`, `participantRoles` (partyId + papel en operación), `milestones`, `documentRefs`.
- `properties/{propertyId}`: identificación estable, dirección estructurada y campos registrales, con estados de verificación.
- Una misma persona puede participar en varias transacciones e inmuebles.

## Gestoría
- `procedureCatalog/{procedureCode}/{version}`: referencia pública de requisitos, costos, plazos, fuente, fecha de verificación, año fiscal y ámbito de aplicación.
- `procedureCases/{caseId}`: `organizationId`, `transactionId`, `propertyId`, `clientPartyId`, `procedureCode`, `catalogVersion`, `status`, `checklist`, `expenses`, `fees`, `evidenceRefs`, `assignedTo`.
- Cada check guarda `status` (pendiente, solicitado, recibido, validado, observado, exento), `timestamp`, `actorId`, `source` y evidencia opcional. **Recibido no implica validado.**
- Costeo: derechos oficiales + traslados + materiales + honorarios + impuestos aplicables + contingencias. Separar presupuestado, confirmado, pagado y comprobado.
- Mantener historial anual, nunca sobrescribir una tarifa 2026 con una 2027.

## Agenda
- `calendarEvents/{eventId}`: `type` (visita, captacion, inspeccion, gestoria, reunion, celebracion), `date`, `time` nullable, `timeStatus` (definida, por_definir), `participantIds`, `propertyIds`, `transactionId`, `procedureCaseId`, `status`, `notes`.
- Una cita sin hora no bloquea un horario inventado; genera pendiente de programación.
- Mantener sincronización con Habitat mediante disponibilidad compartida y bloqueo transaccional.

## Relación humana y celebraciones
- `relationshipMoments/{momentId}`: `partyId`, `occasion` (cumpleanos, firma, bienvenida, aniversario), `consentStatus`, `templateId`, `giftPlan`, `budget`, `deliveryStatus`, `ownerId`.
- Tarjeta digital estándar o personalizada, envío manual inicialmente; nunca automatizar felicitaciones sin consentimiento y sin revisar preferencias de contacto.
- Regalos, vino y cenas son opciones de cortesía según relación, presupuesto, política interna y edad legal; no son obligaciones automáticas.
- No publicar fechas de nacimiento ni datos de clientes en GitHub.

## Seguridad
Datos de personas, inmuebles privados, operaciones y evidencias deben residir únicamente en bases protegidas, no en este repositorio público. BUNKER es sistema de custodia autónomo. Todo acceso se aísla por organización y rol; la bitácora es append-only.

## Gate de implementación
1. Crear esquema y reglas de acceso aisladas por organización.
2. Migrar leads existentes con identificadores estables sin perder origen, historia ni citas.
3. Probar múltiples roles por persona y múltiples operaciones por inmueble.
4. Probar catálogo 2026 con versiones, checklist y cotización.
5. Probar eventos sin hora, conflicto de agenda y sincronización con Habitat.
6. Desplegar únicamente después de pruebas y respaldo.
