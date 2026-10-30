# Estructura general de Synapse Core

28 de octubre de 2026 · México. Preparada sobre la versión publicada 78707df.
Esta actualización necesita Hosting; no se declara publicada por crear el commit.

## Organización por tarea

Una navegación persistente con cinco áreas principales, común al espacio de
trabajo, al monitor de Atención y a las herramientas de inmuebles. En escritorio
aparece a la izquierda; en móvil, como una franja superior. Configuración es un
acceso secundario. Los enlaces de operación diaria usan la misma pestaña; la
vista pública del cliente abre una pestaña de consulta separada.

| Área | Tarea principal | Contenido |
| --- | --- | --- |
| Radar | Decidir qué atender ahora | Pendientes, prioridades y accesos a su registro |
| Atención | Conversar y dar continuidad | Bandeja, respuestas preparadas, inmueble, contacto y bitácora de atención |
| Directorio | Consultar personas y sus relaciones | Personas y Operaciones como dos vistas del mismo módulo |
| Agenda | Organizar el tiempo | Eventos, visitas, firmas; acceso a horarios y bloqueos |
| Inmuebles | Mantener la oferta | Lista del catálogo y editor de ficha |

Radar conserva sus prioridades y controles de evidencia. No duplica la agenda
ni convierte un evento abierto en uno guardado. Directorio conserva la persona
seleccionada al cambiar de vista dentro del espacio de trabajo. El botón Atrás
del navegador sigue los cambios entre Radar, Personas, Operaciones y Agenda.

La ficha de un contacto contiene relaciones, agenda e historial. Una operación
se consulta allí o en la pestaña Operaciones: no requiere otra ficha de persona
para cada rol. Atención mantiene sus pestañas compactas de conversación, inmueble,
contacto y bitácora. Un diálogo abierto bloquea el cambio de módulo desde el menú;
el navegador advierte al salir si hay una respuesta o resumen de atención sin enviar.
Los borradores privados no se guardan en localStorage.

## Inmuebles y herramientas administrativas

`/inmuebles` abre directamente Propiedades, con lista y editor en columnas en
pantallas amplias. El editor se despliega al agregar o editar; la importación ADN
queda dentro de una sección secundaria. La distribución se apila en pantallas
pequeñas. Los controles y escrituras existentes de propiedades se conservan.

`/agenda/horarios` abre directamente la herramienta existente de disponibilidad.
Agenda ofrece ese acceso junto a Nuevo evento. No añade una segunda lógica para
guardar horarios.

`/configuracion` reúne accesos a horarios, inmuebles y vista del cliente. Un
apartado de herramientas anteriores permite entrar al panel previo, incluidos
exportación/importación e históricos. No se elimina ningún registro anterior.

## Rutas y compatibilidad

| Ruta | Destino |
| --- | --- |
| `/`, `/radar` | Radar |
| `/directorio`, `/contactos` | Directorio · Personas |
| `/operaciones` | Directorio · Operaciones |
| `/atencion-operador` | Monitor de Atención |
| `/agenda` | Calendario interno |
| `/agenda/horarios` | Horarios y bloqueos |
| `/inmuebles` | Catálogo y edición |
| `/configuracion`, `/administracion` | Configuración |
| `/administracion?legacy=1` | Panel anterior completo |
| `/reservar` | Portal público, sin menú privado |
| `/atencion#TOKEN` | Continuidad privada del cliente, sin menú del operador |

Las rutas antiguas se conservan. La construcción incluye y versiona los tres
archivos nuevos de navegación compartida, además de los archivos anteriores.
Los permisos propios de cada módulo siguen vigentes: compartir un menú no otorga
acceso ni cambia la identidad de registros.

## Alcance y validación

Esta entrega reorganiza la experiencia y los accesos existentes. No fusiona por
nombre los registros de Atención con el Directorio ni atribuye mensajes a otra
persona. Los avisos de mensajes siguen funcionando dentro del monitor abierto;
no hay una bandeja global en Radar ni promesa de sonido con el navegador cerrado.
Las reservas desde chat y los recordatorios automáticos continúan sin activarse.

Pasaron 136 pruebas: navegación y jerarquía, historial del navegador, selección
de contacto, protección de diálogos y borradores, rutas administrativas, hashes de
publicación y regresiones de contactos, operaciones, reservas y atención. También
se analizaron los scripts de la página administrativa y los archivos nuevos.
No se hicieron escrituras de prueba en producción. La comprobación visual de la
nueva distribución queda para después del despliegue en Firebase Hosting.

Solo requiere reconstruir y publicar Hosting en synapse-core. No requiere aplicar
reglas, desplegar Functions ni migrar los datos actuales.
