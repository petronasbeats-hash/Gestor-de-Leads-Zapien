# Theme Engine Synapse · Índigo y Verde

28 de octubre de 2026, México. Motor Índigo cc9bb37 publicado; selección de
dos paletas preparada sobre esa versión.

## Identidad propuesta

La paleta seleccionada por el usuario para esta entrega usa índigo como identidad principal,
lavanda para acciones y foco en modo oscuro, blanco niebla para claridad y azul
noche para superficies oscuras. La selección corresponde a esta entrega; no se atribuye a una propuesta
anterior que no está documentada en el repositorio.

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Fondo | #F5F5FA | #111521 |
| Panel | #FEFEFF | #191F2E |
| Texto | #252B45 | #E9EDF8 |
| Texto secundario | #616B82 | #B1BBD1 |
| Acción y foco | #4F56B8 | #B9BDFF |
| Texto sobre acción | #FFFFFF | #22274D |
| Selección suave | #EAEAFD | #2A3158 |

Advertencias y errores conservan colores semánticos diferenciados. Las fotos de
inmuebles mantienen sus colores reales. La paleta modifica la presentación, no
el significado de estados, clasificaciones o permisos.

## Verde Synapse como alternativa

A petición del usuario se conserva también el verde con blanco cálido. Color y
Apariencia son elecciones independientes: Índigo/Verde y Sistema/Claro/Oscuro.
Índigo sigue siendo el valor inicial si no hay preferencia guardada. La paleta
Verde usa #184E40 sobre #F6F5EF en claro y #B9E4C7 sobre #10191B en oscuro.

La elección de color se guarda en synapse.palette.v1 como una enumeración sin
datos de clientes. Se sincroniza entre pestañas sin cambiar el modo de apariencia.
Cambiar color no recarga ni modifica formularios abiertos. Los controles están
agrupados para mantener la cabecera y el menú compactos.

## Motor compartido

Primera implementación del motor en este repositorio: web/theme/theme-engine.js
y web/theme/theme.css. Modos Sistema, Claro y Oscuro. La preferencia se guarda
localmente en synapse.theme.v1 como una enumeración; no contiene identidad,
conversaciones ni otros datos de clientes. No se consulta ni escribe Firebase
para guardar esta preferencia.

Sistema sigue prefers-color-scheme y reacciona a cambios. La selección manual
prevalece hasta volver a Sistema. Eventos de storage sincronizan otras pestañas
del mismo origen. Valores no reconocidos se ignoran y, si el almacenamiento está
bloqueado, la apariencia sigue funcionando durante la sesión.

El script se carga al inicio para aplicar la preferencia antes de montar la
aplicación. El HTML proporciona un tema claro de respaldo. El control accesible
se monta en el pie del menú interno, en la cabecera de Reservar o en la cabecera
de Atención del cliente. No duplica controles ni recarga la página al cambiar.

API: SynapseTheme.getPreference(), getResolvedTheme(), setPreference(value),
getPalette() y setPalette(value).
El evento synapse:themechange incluye únicamente preference, theme y palette. Las
variables semánticas --s-* son la fuente de color; los nombres anteriores como
--green y --mint se mantienen como alias de compatibilidad del acento índigo.

## Alcance visual

Se integra en Radar, Directorio, Operaciones, Agenda, Inmuebles, herramientas
administrativas, Atención de operador/cliente y Reservar. Las rutas antiguas y
las vistas públicas heredadas agenda.html/leia.html se conservan; no se cambia su
implementación externa durante esta entrega.

Tipografía Manrope/DM Sans, superficies, bordes, botones, formularios, selección,
estados y foco usan el mismo lenguaje. Los campos administrativos dejan de
depender de colores nativos blancos y pueden encogerse dentro de las columnas.
Los imports de fuentes anteriores se centralizan en la hoja compartida.

Radar añade cuatro tarjetas que filtran Hoy, Vencido, Próximo y Sin fecha sin
modificar registros ni prioridades del modelo. El Directorio incorpora iniciales
decorativas y un conteo de coincidencias. Agenda distingue estados con bordes y
mejora la lectura de vistas semana/mes. No se cierran pendientes históricos ni
se inventan compromisos para completar las tarjetas.

## Validación y publicación

153 pruebas de aplicación aprobadas: modos, persistencia, almacenamiento
bloqueado, cambios de sistema/pestaña, montaje en las cinco superficies y ausencia
de controles duplicados; contraste de texto normal de al menos 4.5:1 en pares
semánticos principales y de estado de las cuatro combinaciones de color y apariencia; borradores conservados al
cambiar tema y filtros de Radar sin escrituras. Se mantienen las regresiones de
reservas, folios, intervalos, Atención, contactos, operaciones y permisos.

La verificación visual final de la candidata requiere publicar Hosting. No se
crean citas ni mensajes de prueba en producción. No modifica reglas, funciones,
persistencia de clientes ni el audio Nexo. No se fusiona el PR automáticamente.

## Base publicada verificada

El usuario publicó cc9bb3760691bf1837d83292c8dd2c7a8d61bbf5 desde
/Users/mac/Downloads/synapse-indigo.iNtSJN/release. Los 32 archivos públicos
coincidieron con sus hashes y política de revalidación. En la sesión existente
se revisaron Radar en claro/oscuro y persistencia de apariencia al abrir Reservar;
se restauró Sistema después de la comprobación. No se crearon reservas ni mensajes.
La selección de Verde se verificará visualmente después de su publicación.
