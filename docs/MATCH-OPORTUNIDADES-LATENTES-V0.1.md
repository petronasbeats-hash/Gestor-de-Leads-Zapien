# Synapse · Match de oportunidades latentes V0.1

## Hipótesis de producto
Una oportunidad inmobiliaria detectada por Cambaceo Conecta puede no convertirse inicialmente en captación. Meses después, una demanda concreta de compra o renta puede coincidir con su ubicación, características y precio observado, y motivar una **revisión de contacto permitida**. La detección no equivale a autorización comercial.

## Dominios separados
- Oportunidad detectada: anuncio público, fotos, coordenadas de captura e inmueble diferenciadas, fecha, precio anunciado con fuente y vigencia, teléfono publicado y grado de verificación.
- Relación/contacto: propietario o anunciante verificado/no verificado, respuesta, consentimiento, restricciones y estado «no contactar».
- Demanda del comprador: presupuesto, ubicación, necesidades, temporalidad y autorización para compartir una propuesta.
- Coincidencia: criterios, evidencia, fecha de evaluación, incertidumbre, siguiente acción sugerida y resultado.
- Propiedad comercializable: solo tras autorización documentada, incorporada a Property Core y cartera activa.

## Flujo
1. Detectar anuncio; registrar origen, precio y fecha.
2. Contactar al anunciante si procede; respetar negativa a recibir nuevas gestiones.
3. Registrar demanda de comprador.
4. Buscar coincidencias tanto en cartera autorizada como en oportunidades latentes, **etiquetadas por separado**.
5. Revisar manualmente vigencia, titularidad, precio y restricciones de contacto.
6. Si el contacto está permitido, preguntar si el inmueble sigue disponible y si desea recibir una propuesta concreta, sin representar que Synapse ya comercializa la propiedad.
7. Solo con autorización correspondiente, compartir datos y negociar; registrar trazabilidad y permisos.

## Salvaguardas
- Un rechazo expreso a nuevos contactos impide recontacto automatizado y debe respetarse; un nuevo comprador no lo anula.
- No enviar ofertas, datos personales del comprador ni mensajes automáticos sin permisos y revisión humana.
- Precio observado no es precio vigente ni oferta vinculante.
- Distinguir anunciante de propietario, y propiedades propias/de terceros.
- Políticas de minimización, retención y borrado de datos; autorización en RTDB/Storage y roles por organización.
- Sin publicación pública de oportunidades latentes, fotografías, teléfonos o coordenadas.

Estado: concepto documentado, no implementado ni desplegado.
