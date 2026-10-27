
'use strict';

function required(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Campo obligatorio: ' + field);
  }
  return value.trim();
}

function createIdentity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Identidad inválida');
  }

  return Object.freeze({
    organizationId: required(input.organizationId, 'organizationId'),
    propertyGroupId: required(input.propertyGroupId, 'propertyGroupId'),
    unitId: required(input.unitId, 'unitId'),
    propiedadId: required(input.propiedadId, 'propiedadId')
  });
}

function createOperationalUnitId(input) {
  const identity = createIdentity(input);
  return JSON.stringify([
    identity.propertyGroupId,
    identity.unitId
  ]);
}

function resolveProperty(catalog, input) {
  const identity = createIdentity(input);

  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new TypeError('Catálogo inválido');
  }

  const matches = Object.entries(catalog).filter(([id, property]) =>
    property &&
    property.activo !== false &&
    property.organizationId === identity.organizationId &&
    property.propertyGroupId === identity.propertyGroupId &&
    property.unitId === identity.unitId
  );

  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? 'Unidad no encontrada'
        : 'Identidad ambigua: múltiples propiedades'
    );
  }

  const [propiedadId, property] = matches[0];

  if (propiedadId !== identity.propiedadId) {
    throw new Error('Conflicto de propiedad comercial');
  }

  return Object.freeze({
    identity,
    operationalUnitId: createOperationalUnitId(identity),
    propiedadId,
    property: Object.freeze({ ...property })
  });
}

function validateCatalog(catalog, organizationId) {
  required(organizationId, 'organizationId');

  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new TypeError('Catálogo inválido');
  }

  const seen = new Set();
  const duplicates = [];
  const incomplete = [];

  for (const [propiedadId, property] of Object.entries(catalog)) {
    if (!property || property.organizationId !== organizationId) continue;

    const hasGroup = typeof property.propertyGroupId === 'string' &&
      property.propertyGroupId.trim().length > 0;
    const hasUnit = typeof property.unitId === 'string' &&
      property.unitId.trim().length > 0;

    if (hasGroup !== hasUnit) {
      incomplete.push(Object.freeze({ propiedadId }));
      continue;
    }

    if (!hasGroup && !hasUnit) continue;

    const key = JSON.stringify([
      property.propertyGroupId,
      property.unitId
    ]);

    if (seen.has(key)) {
      duplicates.push(Object.freeze({ propiedadId, key }));
    } else {
      seen.add(key);
    }
  }

  return Object.freeze({
    valid: duplicates.length === 0 && incomplete.length === 0,
    duplicates: Object.freeze(duplicates),
    incomplete: Object.freeze(incomplete)
  });
}

module.exports = Object.freeze({
  createIdentity,
  createOperationalUnitId,
  resolveProperty,
  validateCatalog
});
