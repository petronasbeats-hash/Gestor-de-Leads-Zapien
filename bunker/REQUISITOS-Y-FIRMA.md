# BUNKER · Control documental integral y firma (diseño V0.1)

**Estado: laboratorio. No se aceptan archivos reales ni se firman contratos todavía.**

## Participantes

Un expediente puede tener múltiples participantes con identidad y roles independientes: **arrendatario, aval y arrendador**. Una persona puede participar en distintos expedientes; el vínculo al contrato es explícito y conserva versiones históricas.

## Plantillas de requisitos

La plantilla se selecciona por organización, operación, inmueble y rol. Se versiona al iniciar el expediente para que cambios posteriores no alteren requisitos ya comunicados.

- **Arrendatario**: identificación, contacto, comprobante de domicilio y requisitos adicionales que determine el arrendador.
- **Aval**: identificación, contacto, domicilio y comprobante con antigüedad máxima de tres meses, conforme a la política del inmueble; revisión de coincidencia de domicilio con INE y residencia en Tehuacán cuando aplique.
- **Arrendador**: identificación, contacto, acreditación de propiedad o facultades para arrendar y documentación pertinente al inmueble.
- **Contrato**: borrador, revisión, anexos, versión final, constancias de firma, entrega de copia y renovaciones.

Cada requisito tiene estado `pendiente → solicitado → recibido → en_revision → validado/observado/exento`; cada transición registra actor, fecha, evidencia y observaciones. **Un check de recibido no significa documento validado.**

## Compartir requisitos

Enviar enlace con token aleatorio, limitado a un expediente y un rol, con expiración, revocación y verificación de identidad. Mostrar exclusivamente requisitos de ese destinatario; no exponer documentos de otros participantes. Registrar envío, apertura, recepción y revisión. No colocar datos sensibles en URLs. Las subidas se habilitan únicamente tras backend de autorización, reglas Storage y pruebas de seguridad.

## Contratos y firmas

El Código Civil del Estado de Puebla (artículo 1494, consultar texto vigente) contempla validez de contratos electrónicos privados si pueden atribuirse al interesado y conservarse para consulta posterior. **Esto no autoriza automáticamente cualquier mecanismo de firma para todo arrendamiento o garantía**. Revisión jurídica local previa para formalidades específicas, alcance de obligaciones del aval, representación del arrendador y prueba del consentimiento.

Primera fase: contratos en PDF digitalizados y registro de firmas autógrafas sin declarar que el escaneo equivale a original. Segunda fase, condicionada a dictamen jurídico: proveedor de firma electrónica con identificación, consentimiento expreso, documento final inalterable, hash, evidencia atribuible a cada firmante, sellado temporal, constancias y retención. No implementar firma dibujada o checkbox como sustituto universal de firma legal. Evaluar conservación y constancias NOM-151 cuando corresponda.

## Seguridad y privacidad

No alojar documentos reales en repositorios, leads, almacenamiento público ni enlaces sin control. Cumplir aviso de privacidad, minimización, conservación, derechos de titulares, segregación multi-organización, auditoría, copias de seguridad y revocación. Verificar la normativa de protección de datos aplicable antes de abrir el portal externo.

## Próximas entregas

1. API privada de expedientes y documentos con Firebase Auth, roles y organización.
2. Catálogo versionado de requisitos y checklist por participante.
3. Portal seguro para envío/recepción y revisión.
4. Control de contratos digitalizados, versiones y anexos.
5. Evaluación legal de firma electrónica y piloto con proveedor acreditado/apropiado.
6. Pruebas de aislamiento, seguridad y recuperación antes de producción.
