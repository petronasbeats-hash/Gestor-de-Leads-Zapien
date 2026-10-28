# Synapse Territorio · primera integración

Fecha: 2026-10-28. Estado: código preparado para revisión y publicación; no se han creado captaciones reales ni desplegado esta versión desde este entorno.

## Propósito y alcance

Se recupera la definición del prototipo privado `synapse-v2-prototipo.html` del 21 de octubre: captación en campo y fototeca geográfica, borradores sin conexión, ubicación de fotografía separada de la ubicación del inmueble y autorización antes de publicar. El prototipo era una demostración sin persistencia; esta integración agrega persistencia privada de datos y borradores locales.

La ruta `/territorio` forma parte de Gestión en el menú común de Synapse. Reutiliza las paletas y modos del Theme Engine. Las captaciones se muestran como fichas compactas, con búsqueda y filtro de estado; su editor usa pestañas Registro, Ubicaciones, Fotos y Seguimiento. La fototeca muestra las fotos locales de las captaciones filtradas.

## Flujo disponible

1. Iniciar sesión con una cuenta habilitada como agente en la organización de Atención.
2. Crear una captación con referencia, fuente, operación, tipo, zona, contacto observado y notas. El teléfono es opcional.
3. Registrar, de manera independiente, la ubicación del registro, la del inmueble y la anotada para cada foto. El GPS se consulta exclusivamente al pulsar el botón correspondiente; su precisión no se atribuye al inmueble ni a fotografías previas.
4. Agregar hasta ocho originales JPEG, PNG o WebP, de hasta 8 MB cada uno. No se extraen EXIF, fecha real de captura ni coordenadas de los archivos. Tampoco se interpreta la fecha del archivo como fecha de fotografía.
5. Guardar un borrador en el dispositivo. Sin red, esta acción funciona mientras la página ya esté abierta y el acceso haya sido iniciado. No existe un service worker ni una promesa de arranque offline desde una página cerrada.
6. Guardar datos y seguimiento en Synapse cuando exista conexión. El envío es explícito; recuperar la conexión no sube borradores automáticamente.
7. Revisar permiso de contacto, autorización de publicación y su referencia. Para marcar Lista para preparar ficha se exige una autorización declarada y una referencia de evidencia. Esto no prueba propiedad ni facultad legal de representación.
8. Vincular, si corresponde, una propiedad existente permitida para esa cuenta. La vinculación conserva una referencia privada; no cambia el catálogo, su estado, sus fotos o su publicación.

Los estados son Capturada, Contactar, Validar información y permiso, Lista para preparar ficha, Vinculada a inmueble y Archivada. La siguiente acción y fecha se consultan en Territorio. **Esta primera versión no agrega todavía esas acciones al Radar general ni a Agenda**. Archivar o vincular evita presentarla como una acción pendiente de captación dentro del módulo; no borra su ficha.

## Persistencia y límites de fotos

Los datos se sincronizan en `territorio_v1/orgs/{organizationId}/agents/{uid}/captures/{captureId}` mediante el servidor autenticado de Attention. La lista se limita al agente actual; no es una bandeja compartida por toda la organización. La membresía y autorización se resuelven en cada solicitud usando Firebase Auth y el ACL existente de Atención.

**Las fotos originales permanecen en IndexedDB en el navegador donde se guardaron. No hay carga a Storage ni respaldo de imágenes en la nube en esta versión.** Solo sus descripciones, permisos y coordenadas anotadas forman parte de la ficha sincronizada. En otro dispositivo pueden verse los datos de las fotos, pero no su original. Borrar los datos del navegador o perder el dispositivo puede eliminar los originales locales. No es un repositorio de documentos de identidad ni un expediente BUNKER; tampoco ofrece cifrado local adicional ni protección frente a quien controla el perfil del navegador.

La separación de borradores por organización/cuenta evita mezclarlos en la interfaz. Al salir se limpian campos privados, listas y URLs temporales de imágenes; los borradores guardados permanecen bajo su espacio local para la siguiente sesión de esa misma cuenta. No hay rastreo continuo de ubicación, OCR, datos de clientes en localStorage, carga automática, contactos automáticos ni publicación automática.

## Concurrencia y autorización

Las mutaciones usan una versión esperada e idempotencia por solicitud. Un reintento idéntico conserva la versión y su evento de historial; una solicitud reutilizada con datos distintos se rechaza. La ficha y el historial se guardan juntos en una transacción. Ante conflicto, se conserva el borrador local y el operador puede conservar una copia local independiente antes de abrir la versión actual de Synapse. La copia no se envía automáticamente.

Los enlaces a Maps se construyen únicamente con latitud/longitud validadas y se abren a petición del operador. La ubicación privada no se convierte en un mapa público del catálogo. No se modifican reglas de RTDB, reservas, contactos, contratos, Property Core o Cobranza Core. El navegador no escribe directamente en el nuevo nodo privado. Las verificaciones de reglas usan un emulador con la política observada del proyecto; no sustituyen una lectura de reglas reales después de cambios administrativos externos.

## Componentes

- `shared/territory-model.js`: normalización, etapas, permisos y ubicaciones independientes.
- `server/territory-service.cjs`: lista privada, propiedades permitidas y guardado transaccional.
- `server/attention-http.cjs`: rutas autenticadas `/agent/territory/list`, `/save` y `/properties` bajo `/attention-api`.
- `territorio.html`, `web/territory/*`: interfaz, IndexedDB, fotos locales y sincronización explícita.
- `scripts/build-attention-release.cjs`: ruta de Hosting, dependencias públicas/servidor y huellas de caché.

El endpoint `/attention-api/health` declara `territory: true` únicamente cuando el servicio está conectado y `territoryPrivatePhotos: false`. El manifiesto también distingue borradores locales de respaldo fotográfico.

## Validación

Pruebas automatizadas con datos ficticios:

- Ubicaciones independientes, coordenadas/fechas inválidas, permisos, límites y datos no inferidos.
- Aislamiento por organización y agente, vínculos autorizados y ausencia de cambios en catálogo/contactos/citas.
- Reintentos tras pérdida de respuesta, conflicto de versión, fallo de escritura y concurrencia.
- HTTP autenticado, cuerpo máximo de 16 KB y rechazo de campos de autoridad falsificados.
- IndexedDB con Blob original, separación de cuentas, captura offline en página abierta, recarga y sincronización sin enviar bytes fotográficos.
- Conflictos conservando copia local, navegación con teclado y validación de campos en pestañas ocultas.
- Emulador RTDB: transacciones con caché inicialmente vacía y competencia de instancias, denegación de lectura/escritura directa incluso para el dueño por Web SDK y ausencia de datos privados en proyecciones públicas.

Pendiente después de publicar: revisar visualmente en teléfono real y escritorio, y probar el ciclo de acceso/guardado con la cuenta del operador. No se ha realizado una prueba privada de producción en este entorno.

## Publicación y siguiente etapa

Publicar Functions (`functions:synapse-attention`) y Hosting juntos desde una compilación nueva y fijada al commit revisado. No desplegar reglas ni usar `--only functions` sin limitar el codebase. La compilación necesita las dependencias estáticas del repositorio original indicadas en la documentación de release.

Después: integrar las siguientes acciones de Territorio al Radar, incorporar un almacén privado de medios con políticas de acceso y respaldo, y preparar la conversión explícita de captación autorizada a identidad de Property Core. La publicación seguirá siendo una acción revisable; no debe activar contratos ni cobranza.
