# Synapse · Cambaceo Conecta V0.1 (propuesta)

## Caso de uso
Un agente camina por un circuito y detecta una lona pública «Se vende» o «Se renta». Desde Huawei, iPad, tablet, Mac o laptop crea una oportunidad en menos de un minuto, sin confundirla con una captación autorizada.

## Captura rápida
- Foto del anuncio o fachada visible desde espacio público (con aviso de privacidad y permisos de cámara/galería).
- Coordenadas GPS obtenidas **solo con permiso**, precisión, fecha/hora y posibilidad de corregir marcador manualmente.
- Tipo de anuncio (venta/renta/otro), teléfono publicado, texto visible, dirección aproximada y notas.
- Origen: cambaceo; agente, fecha/hora, circuito/zona, estado de contacto y siguiente acción.
- Posibilidad de guardar borrador sin señal, con sincronización posterior **solo después de diseñar controles de privacidad y conflictos**.

## Ciclo de vida
Detectada -> pendiente de verificar -> contacto intentado -> contacto establecido -> titularidad/intermediación por confirmar -> interés en colaboración -> autorización documentada -> captación formal (Property Core). También descartada, duplicada, no contactar. Ninguna lona autoriza publicación.

## Funciones inteligentes propuestas
- OCR opcional y confirmación humana de teléfono y precio; nunca dar por exacta extracción automática.
- Detección de posibles duplicados por coordenadas, teléfono, fotos o dirección.
- Mapa de oportunidades, filtros por circuito, asignación y recordatorios de seguimiento.
- Acciones contextuales de llamada, WhatsApp y creación de tareas, sin envíos automáticos.
- Separar teléfono **anunciado** de identidad **verificada** del propietario.

## Seguridad
Acceso administrativo autenticado; reglas RTDB/Storage por rol/organización; permisos explícitos de geolocalización/cámara; retención limitada; no exponer ubicaciones ni teléfonos en portal público; respetar solicitudes de no contacto; historial auditable. No registrar ubicación continua del agente: GPS solo al crear/corregir oportunidad.

## UX y validación
Acción principal «+ Detectar oportunidad» en PWA administrativa; captura en 3-5 campos, resto opcional; guardado progresivo, estados claros y acceso táctil. Probar en Huawei sin GMS y Safari iPad/Mac. Mantener Habitat /reservar separado.

Estado: DISEÑO PROPUESTO, NO IMPLEMENTADO NI DESPLEGADO.

## Fototeca geográfica / Mapa de fotografías (decisión de producto 20 octubre 2026)

Inspiración UX: vista «Lugares» de Fotos en iOS, adaptada a prospección inmobiliaria, sin copiar su interfaz literalmente.

- Al capturar desde PWA, solicitar permiso de geolocalización y registrar `captureLocation: {lat, lng, accuracyMeters, capturedAt, source: 'browser-geolocation'}`; preservar fecha/hora, agente y asociación foto-oportunidad.
- Al importar fotos, intentar leer GPS EXIF **si existe**; indicar claramente cuando no exista, esté eliminado o no sea confiable; permitir fijar ubicación manualmente. No asumir que la ubicación EXIF es siempre la del inmueble.
- Mantener `propertyLocation` como campo **distinto** de `captureLocation`; ofrecer corregir el pin del inmueble sin sobrescribir el origen de la fotografía.
- Fototeca con mapa, marcadores agrupados por proximidad/zoom, miniaturas al tocar un pin, carrusel de fotos por oportunidad, filtros por circuito/fecha/agente/tipo/estado y navegación a la ficha de seguimiento.
- Si varias fotos corresponden al mismo anuncio, asociarlas a una oportunidad sin crear duplicados. Detección automática de coincidencias sujeta a revisión humana.
- Evitar seguimiento continuo de agentes; obtener ubicación solamente durante captura o por acción explícita. No publicar coordenadas, fotos, teléfonos ni datos de campo en Habitat /reservar.
- Guardar metadatos mínimos, aplicar autorización en RTDB/Storage, y no cachear imágenes privadas indiscriminadamente. Considerar errores de precisión, permisos denegados, capturas sin red y sincronización diferida.
- Probar permisos GPS y cámara en Huawei sin GMS, Safari iPad/iPhone y navegadores de escritorio. Una PWA no puede garantizar acceso a todas las fotos o a los metadatos que el SO elimina.

**Estado:** requisito funcional documentado; pendiente de implementación y pruebas, sin despliegue.
