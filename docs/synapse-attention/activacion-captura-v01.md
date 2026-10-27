# Candidato de captura y continuidad V0.1

Este cambio agrega una aplicación de atención y su servicio persistente. No está
desplegado. No confundir las pruebas de contrato o del prototipo anterior con
reservas realizadas por clientes ni con una validación de producción.

## Comportamiento implementado

- Asesor: iniciar con alias/nombre y teléfono opcionales, seleccionar fuente y
  canal de entrada por separado, elegir publicación activa y registrar la atención.
- Captura, mensaje o cambio de contexto y su evento de bitácora se confirman en
  una sola transacción por organización; el requestId protege reintentos.
- El cambio de inmueble usa versión esperada y conserva fuente, canal de entrada
  e inmueble original. Se valida el alcance del asesor por organización/unidad.
- El catálogo se vuelve a consultar al iniciar e inspeccionar una atención; no
  se sustituye una lectura fallida con un fixture. La interfaz abre Reservar para
  consultar horarios; todavía no crea una cita desde la conversación.
- Enlace con 256 bits aleatorios, almacenado como hash, con vigencia de 24 horas,
  rotación y revocación. Su preparación no envía mensajes a Marketplace/WhatsApp.
- El enlace muestra únicamente ficha pública. La vista de mensajes exige una
  verificación adicional del teléfono; escribirlo en un formulario no verifica
  su titularidad. Si no se capturó teléfono, el asesor debe obtenerlo por su canal
  antes de habilitar esa recuperación. Cambiar teléfono revoca el acceso anterior.
- Requisitos y condiciones permanecen separados de la ficha pública hasta que
  el asesor los comparte. Se conserva unidad y versión; una ficha distinta no
  hereda requisitos ADN ni condiciones de CL. Los textos libres heredados no se
  copian a la vista pública sin una descripción pública revisada.
- Resúmenes privados, acciones pendientes y reporte diario en America/Mexico_City.
  Importar una interacción sin fecha conserva la fecha desconocida. Eventos sin
  siguiente acción no eliminan el pendiente anterior. No hay reporte programado.

## Identidad y persistencia

`server/attention-service.cjs` recibe una autoridad ya verificada: no confía en
UID, organización, permisos o catálogo enviados por el navegador.
`server/attention-firebase-authority.cjs` es el adaptador candidato de Firebase
Auth existente: verifica el ID token y revocación con Admin SDK y resuelve la ACL
privada de Atención. No constituye integración con Zap Auth ni autorización para
modificar esa aplicación. El contrato permite sustituir el adaptador por Zap Auth
cuando su verificación de servidor se haya integrado y probado.

ACL propuesta, configurada únicamente mediante un administrador autenticado:

```
atencion_acl/orgs/{organizationId}/name
atencion_acl/orgs/{organizationId}/propertyIds/{publicationId}: true
atencion_acl/orgs/{organizationId}/members/{uid}/enabled: true
atencion_acl/orgs/{organizationId}/members/{uid}/role: "agent"
```

Un miembro puede tener además `propertyIds/{publicationId}: true` para restringir
su alcance dentro del catálogo de su organización. No se usa un UID incrustado en
el motor ni se deduce la pertenencia organizacional del nombre de un inmueble.

Datos nuevos: `atencion_v1/orgs/{organizationId}` (conversations/messages/journal/
commands) e índice privado `atencion_invites/{tokenHash}`. Las reglas reales
recibidas deniegan acceso directo a estas rutas; el servicio Admin verifica cada
operación. No es necesario abrirlas a navegadores para activar esta arquitectura.
No se guardan aquí documentos de arrendamiento: corresponden a BUNKER.

La transacción por organización es un límite de V0.1: antes de una operación de
gran volumen se requiere particionar por conversación, índices/paginación y un
outbox con retención. El índice de invitaciones puede dejar una referencia privada
huérfana si falla la transacción: no concede acceso sin el hash vigente de la
conversación. Su limpieza por vencimiento queda pendiente de un worker de retención.

## Preparación del release

Construir desde el candidato, con un destino nuevo y el directorio original del
Mac como proveedor de dependencias estáticas. No editar ni limpiar la carpeta
original. Ejemplo para el sitio que indica la configuración local recibida:

```bash
node scripts/build-attention-release.cjs \
  --site synapse-core \
  --legacy-root "$HOME/Downloads/Gestor-de-Leads-Zapien" \
  --out "$HOME/Downloads/synapse-atencion-candidato-v01"
```

El generador crea un directorio público acotado, un paquete de funciones separado,
un manifiesto y parámetros de proyecto/dominio. No publica ni cambia reglas.
Rechaza un directorio de salida existente y exige `404.html`, `leia.html` y
`assets/js/reprogramar-ui.v1.js`. El ZIP de estáticos recibido el 27 de octubre
completó esas dependencias. Se verificó la construcción con sus bytes reales;
no se sustituyeron por stubs. `static-source-manifest.json` conserva sus hashes.
La página personal de `/leia` se conserva como entrada del directorio original
para el paquete, sin añadir su contenido al repositorio de Atención.

Antes de desplegar: validar el paquete real completo, la cuenta del asesor y ACL,
proveedores/dominios de Authentication, integración telefónica y regresión de
Admin/Agenda/Reservar. La ruta SMS propuesta usa Firebase Auth; su activación y
costos no se dan por autorizados o configurados por el código. El paquete de
Cloud Functions requiere comprobar el plan/facturación del proyecto antes de
activar un servicio que no estaba desplegado.

## Pendientes que impiden anunciar el flujo completo

- Gateway de reservas de producción compartido por portal y atención, con
  disponibilidad autoritativa, exclusión de horario y folio único. Se conservaron
  los guardas de laboratorio de los módulos recibidos; no se retiraron para
  convertir pruebas de laboratorio en escrituras de producción.
- Vinculación autorizada de atención/lead/cita y evento duradero de reserva.
  La captura de Atención no afirma haber creado un lead o una cita legacy.
- Recordatorios realmente enviados, visita realizada autoritativa, seguimiento
  posterior y solicitud de contrato integrados con la persistencia real.
- Integración de Zap Auth/BUNKER y prueba de navegador de extremo a extremo.
- Validación de producción. `health` y el manifiesto anuncian reservas y avisos
  deshabilitados; las pruebas del prototipo no cambian esas capacidades.

El contrato puro de requisitos, recordatorios y solicitud de arrendamiento y su
prototipo anterior siguen disponibles para integrar esas etapas. No son botones
operativos de producción por el solo hecho de que sus pruebas de simulación pasen.

## Validación ejecutada del candidato

- 192 pruebas unitarias/de contrato pasan, incluidas las 147 pruebas recibidas
  en el archivo del Mac, el servicio nuevo y el generador del release.
- BCG37 (4 comprobaciones) y BCG39 (5) pasan con los módulos originales.
- Sintaxis de Admin/Agenda/Reservar y de los archivos nuevos comprobada; los
  módulos importados conservan exactamente sus hashes del archivo recibido.
- E1–E5 pasan con Admin SDK 14.5.0 contra RTDB Emulator 4.11.2: persistencia de
  captura/journal, ocho reintentos, carrera de versión, aislamiento organizacional
  y rechazo de lectura/escritura directas sin autorización.
- Ese emulador se ejecutó con CLI 14.22.0 y Java 17, porque el CLI 15.34.1 exige
  Java 21 y este entorno tenía Java 17. No se alteró el runtime del Mac. El test
  exige proyecto `demo-synapse-attention` y loopback 127.0.0.1:19020. Respeta la
  exclusión NO_PROXY de loopback, que el transporte WebSocket del SDK no aplica
  automáticamente. No contacta la base de producción.
- El paquete completo se construyó con los estáticos reales recibidos el 27 de
  octubre. Su función exporta `attentionApi` con metadatos gcfv2/us-central1 y
  sus rutas relativas resuelven en el paquete. Las referencias locales de los
  HTML publicados y los hashes de dependencias se verificaron.
- El wrapper de la función empaquetada pasó una prueba HTTP local: `health`
  responde 200 con reservas deshabilitadas; sesión y captura sin credenciales
  responden 401. Esta prueba no abrió sesiones ni escribió datos de producción.
- Se añadió una entrada a Atención en el Admin. El asesor reutiliza la sesión
  Firebase del Admin y el cliente tiene una sesión independiente; la recuperación
  de sesión del cliente espera a que Firebase termine de restaurarla.
- No se ha ejecutado la prueba completa de navegador ni la verificación SMS.

No se desplegaron funciones, páginas, reglas ni ACL. Los datos usados en las
pruebas son sintéticos, separados de clientes reales.
