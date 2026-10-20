# Synapse PWA V1 — rama de preparación (NO desplegada)

Objetivo: instalar Synapse en Mac y Huawei, sin modificar flujos de reserva.

Archivos iniciales: manifest.webmanifest e iconos SVG provisionales. **No declarar lista la instalación** hasta generar PNG de 192 y 512 px, vincular manifest en index.html, agenda.html y reservar.html, validar rutas HTTPS, evaluar service worker sin caché de datos de clientes y verificar instalación en dispositivos reales.

**Bloqueadores previos al deploy:** reconciliar diferencias entre versión local/producción y GitHub main; probar Admin, Agenda, Reservar y sincronización; verificar seguridad; aprobar deploy explícitamente.

**Huawei sin GMS:** el navegador puede ofrecer acceso directo en vez de WebAPK. No prometer notificaciones push.

**Política de caché:** nunca cachear API Firebase, respuestas autenticadas, datos de clientes, citas ni documentos. Network-only para contenido dinámico; offline solo shell estático después de pruebas.

Estado: PREPARACIÓN, no integrado, no probado, no desplegado.

## Decisión aprobada: separación administrativa/pública (20 octubre 2026)

**PWA Synapse:** exclusiva para uso administrativo y seguimiento por personal autorizado, en Huawei, Mac y dispositivos compatibles. Punto de entrada administrativo, autenticación obligatoria y autorización efectiva en backend/reglas Firebase para leads, agenda, propiedades, compromisos, cobros y expedientes. No asumir seguridad por ocultar pantallas o instalar PWA.

**Portal público:** Habitat /reservar, exclusivamente para clientes y prospectos. Debe seguir accesible desde enlace web sin instalar PWA ni iniciar sesión administrativa. No incluir /reservar dentro del alcance funcional o de navegación de la PWA administrativa. Mantener separación de módulos, sin fusionar Agenda con Reservar.

**Instalabilidad:** ajustar manifest para que start_url, scope e id representen únicamente la superficie administrativa. Como las rutas actuales comparten origen, verificar limitaciones de scope y evitar afirmar aislamiento por manifest: el aislamiento real depende de autenticación, autorización y reglas de base de datos. Evaluar rutas /admin/ o subdominio administrativo si la separación de alcance lo requiere, sin cambiar rutas públicas sin pruebas.

**Pruebas de aceptación:** (1) instalación en Huawei y Mac abre administración; (2) visitante sin sesión no ve ni consulta datos privados; (3) /reservar permanece accesible por navegador sin instalación ni autenticación administrativa; (4) una reserva pública no altera permisos privados; (5) no caché de datos sensibles; (6) sesiones caducadas no muestran información privada en offline.

**Estado:** decisión documentada; implementación y despliegue pendientes de validación.

## Propuesta funcional: captación desde cualquier dispositivo (20 octubre 2026)

La PWA administrativa debe evolucionar de visor/seguimiento a **estación de trabajo inmobiliaria adaptable** para celular Android/Huawei, iPhone, iPad, tablet, laptop y Mac. Propuesta pendiente de priorización y validación, no implementada.

**Flujo inicial de captación:** identificar propietario/contacto y consentimiento; registrar inmueble o grupo/unidad reutilizando Property Core; ubicación con privacidad y acceso según rol; recorrido con fotografías, medidas y observaciones; condiciones comerciales; documentos y checklist BUNKER; pendientes, validación y autorización antes de publicación; crear siguientes acciones y agenda.

**UX:** interfaz responsive y táctil, formularios progresivos con guardado seguro de borradores, carga de fotos desde cámara/galería, campos contextuales, prevención de duplicados, posibilidad de reanudar y trazabilidad de cambios. No inventar ni autocompletar datos críticos sin confirmación.

**Seguridad y consistencia:** autenticar y autorizar cada escritura en backend/reglas RTDB/Storage; aislar organizaciones y roles; nunca guardar documentos sensibles en caché sin diseño de seguridad; evitar publicación automática; conservar módulos existentes y no desplegar sin pruebas. El modo sin conexión requiere diseño separado de conflictos y permisos.

**Estado:** propuesta de producto documentada, no codificada.
