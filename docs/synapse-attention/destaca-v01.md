# Synapse Destaca · registro privado de recomendaciones

Fecha de preparación: 2026-10-28. Esta versión requiere publicar Functions y Hosting; no se han registrado recomendaciones reales durante las pruebas.

## Base recuperada y decisión de alcance

El prototipo privado `synapse-v2-prototipo.html` describía Destaca como reconocimiento de recomendaciones bajo reglas de elegibilidad. Era una demostración sin persistencia. No se recuperaron montos, porcentajes, ventanas de atribución, condiciones de devengo ni reglas de premios aprobadas.

Esta primera implementación permite registrar y dar seguimiento a recomendaciones. **No calcula ni autoriza beneficios, no declara elegibilidad y no genera pagos o comisiones.** La pantalla y las respuestas del servidor mantienen esa distinción. El programa comercial queda por configurar y revisar antes de ofrecerlo a clientes.

## Flujo implementado

1. Entrar a `/destaca` con la cuenta habilitada de Atención y elegir organización.
2. Registrar quién recomienda, la persona recomendada o alias, teléfonos opcionales, canal, interés y notas.
3. Anotar el permiso de contacto y su referencia. Pasar a Por contactar o En atención exige marcar permiso registrado. Es una declaración del operador, no una verificación de identidad o consentimiento externo automatizada.
4. Vincular opcionalmente un inmueble que esté autorizado para esa cuenta. No se publica ni se cambia ese inmueble.
5. Registrar la siguiente acción y fecha. Solo las acciones sincronizadas aparecen en Radar, con enlace a la misma recomendación.
6. Anotar un folio `RSV-…` si existe. Se conserva como **referencia pendiente de verificar**: escribirlo no acredita una reserva, confirmación de cita, contratación ni derecho a beneficio. No se consulta ni revela la colección privada de citas usando solamente un folio.
7. Registrar un resultado para cerrar como Resultado registrado, No procede o Archivada. El resultado es obligatorio en estos estados; la siguiente acción se limpia y deja de aparecer en Radar. La ficha y su historial se conservan.

La interfaz usa fichas compactas, búsqueda, filtros de estado y pestañas Personas y contexto / Seguimiento y resultado. Aplica el Theme Engine y aparece dentro de Gestión. La primera atribución declarada de quien recomienda se conserva en `origin`, aunque después se corrijan los datos visibles. No se fusionan personas ni se crean contactos o conversaciones automáticamente.

## Persistencia y fronteras

El servidor almacena en `destaca_v1/orgs/{organizationId}/agents/{uid}/recommendations/{id}`. Cada cuenta consulta sus propios registros; no es una bolsa compartida entre agentes. Firebase Auth y la membresía de Atención se verifican por solicitud. El acceso a Destaca no concede lectura de Directorio, Agenda ni finanzas.

Las escrituras usan versión esperada, identificador de solicitud y transacción conjunta de ficha/historial. Un reintento idéntico no duplica la recomendación; otro editor con versión antigua debe revisar su formulario. Los originales de atribución, marcas temporales y actor se fijan en servidor. Campos del navegador como `eligible`, `amountMinor`, `benefitStatus: paid` o `reservationVerification: verified` no activan nada: la normalización fija `eligibility: sin_reglas`, `benefitStatus: no_autorizado` y `reservationVerification: pendiente`.

No existen rutas de autorización de premios, abono, cargo, pago, desembolso ni liberación. No se conecta Cobranza Core ni se modifica su dominio. Tampoco se publica un formulario externo de referidos o un código de cobro.

Esta pantalla requiere conexión para guardar. Los errores conservan el formulario abierto; no hay borrador offline persistente de Destaca. Al salir se limpian campos privados, listas, historial y enlaces. No se usa localStorage para personas o recomendaciones.

## Radar de Territorio y Destaca

El navegador consulta una proyección mínima por organización y por agente: identificador del registro, título de contexto, descripción de la acción, fecha y versión. No recibe teléfonos, documentos, fotografías, notas completas ni historial para construir esas tarjetas.

Se verifica al iniciar sesión, al volver a la pestaña/Radar, con el botón Actualizar seguimientos y cada 60 segundos mientras Radar esté visible sin un diálogo abierto. Solicitudes simultáneas se reúnen; una respuesta tardía de otra sesión no rellena la pantalla tras salir. La consulta tiene tiempo máximo, incluido el token de acceso.

El indicador diferencia actualizado, comprobando, consulta incompleta, error y cuenta sin organización habilitada. Una fuente caída no se presenta como una comprobación completa sin pendientes. Las prioridades usan fecha civil de México y preservan el diseño compacto existente. Los enlaces abren el registro original en su pestaña de seguimiento; no crean una segunda tarea ni una copia del contacto.

## Territorio: resultado del seguimiento

Territorio incorpora Registrar resultado del seguimiento, con Completado/Cancelado y explicación obligatoria. El servidor conserva la acción anterior y su fecha en el historial, limpia solo la siguiente acción y mantiene contacto, ubicaciones, permisos, inmueble, fotos y etapa. El cierre rechaza una versión antigua para no cerrar una acción recién modificada. Un reintento tras pérdida de respuesta mantiene el mismo cierre y versión. Vaciar manualmente una acción existente sin resultado se rechaza.

Las fotos de Territorio siguen siendo locales al navegador; no se borran al cerrar el seguimiento ni se suben a la nube por esta integración.

## Validación y límites

245 pruebas de aplicación, modelo, HTTP y DOM aprobadas, cero fallos. Emulador RTDB: 25 comprobaciones W0–W24 aprobadas. Compilación de 68 archivos totales, 48 públicos; 67 hashes de manifiesto y dependencias locales de Functions comprobados.

Pruebas ficticias de modelo, servicio, HTTP, DOM, almacenamiento local, fuentes de Radar y emulador RTDB: aislamiento por organización/agente; concurrencia y reintentos; cierre con resultado; atribución original; folio no verificado; imposibilidad de activar beneficios desde campos falsificados; proyección mínima; respuestas tardías tras logout; tiempo máximo; fuentes parcialmente fallidas; navegación con teclado; y ausencia de cambios en contactos, citas, inventario o dinero.

El emulador utiliza la política observada del proyecto y verifica que el Web SDK no pueda leer ni escribir directamente Territorio/Destaca, incluso como dueño. No se despliegan reglas ni se cambian membresías. Esta evidencia no certifica reglas productivas modificadas por terceros ni sustituye un recorrido privado real después de publicar.

Siguientes decisiones del programa: reglas de atribución y duplicados entre agentes, consentimiento verificable, evidencia que permite validar reserva/resultado, beneficio autorizado, responsable de aprobación y eventual contrato con Cobranza Core. Hasta definirlas, registrar o cerrar una recomendación no genera un premio.
