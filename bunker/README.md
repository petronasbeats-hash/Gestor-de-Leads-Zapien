# BUNKER · Resguardo documental V0.1 (laboratorio)

**Estado:** arquitectura inicial y contratos de datos. No desplegado; no almacenar documentos reales todavía.

BUNKER es el sistema privado de expedientes y evidencia documental para Synapse Core, Property Core y Cobranza Core. El lead conserva solo referencias mínimas a expedientes y estados; las identificaciones, comprobantes y contratos se resguardan fuera de la base de leads.

## Primer flujo: aval para arrendamiento

1. Synapse crea o recupera un `expedienteId` vinculado al `leadId`, `organizationId` y `propertyId` (opcional).
2. El operador autorizado registra metadatos de aval y solicita documentos INE y comprobante de domicilio.
3. El servidor valida sesión, pertenencia a organización, rol y expediente; entrega una operación de subida autorizada.
4. Se carga el archivo en Cloud Storage privado bajo `bunker/{organizationId}/{expedienteId}/{documentId}/{versionId}`. El cliente no decide una ruta arbitraria.
5. Se verifica MIME real, tamaño, integridad y estado de escaneo antes de marcar el archivo disponible.
6. Un revisor humano registra dictamen documental y observaciones; la UI puede advertir por comprobante con antigüedad mayor a tres meses o por discrepancia de domicilio.
7. Al generar contrato, se vinculan los IDs de documento y versiones; jamás se copia el binario a un lead.

## Modelo propuesto

- `bunkerExpedientes/{expedienteId}`: `organizationId`, `leadId`, `propertyId`, `unitId`, `contractId`, `status`, `createdAt`, `createdBy`.
- `bunkerDocumentos/{documentId}`: `organizationId`, `expedienteId`, `tipo` (ine_aval, comprobante_aval, contrato, otros), `versionId`, `storagePath`, `mimeType`, `sizeBytes`, `sha256`, `status` (pendiente, cuarentena, revision, validado, observado, rechazado), `uploadedAt`, `uploadedBy`.
- `bunkerAuditoria/{eventId}`: `organizationId`, `expedienteId`, `documentId`, `actorId`, `action`, `timestamp`, `result`, `reason` (append-only).
- `leads/{leadId}/bunkerExpedienteId`: referencia, nunca URL pública de archivo.

## Reglas de seguridad obligatorias antes de producción

- Autenticación + autorización de organización y rol **verificadas del lado servidor**, no solo en interfaz.
- Storage privado: denegación predeterminada; no reglas de acceso público o escrituras globales.
- URLs de descarga temporales, de corta vigencia y emitidas por backend autorizado; evitar tokens permanentes en registros.
- Cifrado en tránsito y en reposo; secretos fuera del repositorio.
- No almacenar números de INE, imágenes de identificación ni datos personales en logs, trazas, GitHub o fixtures.
- Política de conservación, supresión, rectificación y aviso de privacidad aplicable en México, antes de recibir documentos reales.
- Evitar borrar evidencia de auditoría al corregir o reemplazar documentos; usar versionado y eventos.
- Protección contra malware, validación real de formato y límites de tamaño.
- Copias de seguridad, recuperación y revocación de accesos.

## Integración inicial con Synapse

La sección `aval` incorporada al lead es captura administrativa provisional. **No constituye BUNKER seguro**, ni sustituye verificación humana. No agregar archivos a `leads` ni usar URLs públicas de Firebase Storage. La vinculación a expedientes se implementará tras disponer de reglas, autenticación y backend verificables.

## Gate de salida del laboratorio

- [ ] Identificar proyecto Firebase, Realtime Database/Firestore, Storage y reglas reales.
- [ ] Crear reglas de denegación por defecto y pruebas de acceso cruzado.
- [ ] Implementar API de carga/descarga autorizada y aislamiento multi-organización.
- [ ] Pruebas Emulator: usuario anónimo, rol no autorizado, otra organización, carga válida, MIME inválido, sobrepeso, reintento y revocación.
- [ ] Implementar bitácora append-only y pruebas de versiones.
- [ ] Integrar expediente en UI sin exposición pública.
- [ ] Revisar aviso de privacidad, retención y procedimientos de atención de derechos.
- [ ] Autorizar despliegue después de evidencia de pruebas.

**No subir INE ni comprobantes reales al laboratorio.**
