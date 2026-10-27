
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createIdentity,
  createOperationalUnitId,
  resolveProperty,
  validateCatalog
} = require('../property/unit-identity-bridge.v0.1.js');

const base = Object.freeze({
  organizationId: 'org-a',
  propertyGroupId: 'adn',
  unitId: 'yang-10',
  propiedadId: 'prop-1'
});

function property(overrides = {}) {
  return {
    organizationId: 'org-a',
    propertyGroupId: 'adn',
    unitId: 'yang-10',
    activo: true,
    ...overrides
  };
}

test('H01: separadores especiales no colisionan', () => {
  const a = createOperationalUnitId({
    ...base,
    propertyGroupId: 'a/b',
    unitId: 'c'
  });

  const b = createOperationalUnitId({
    ...base,
    propertyGroupId: 'a',
    unitId: 'b/c'
  });

  assert.notEqual(a, b);
});

test('H02: espacios se normalizan consistentemente', () => {
  const a = createOperationalUnitId(base);

  const b = createOperationalUnitId({
    ...base,
    propertyGroupId: ' adn ',
    unitId: ' yang-10 '
  });

  assert.equal(a, b);
});

test('H03: dos fichas activas generan ambigüedad', () => {
  const catalog = {
    'prop-1': property(),
    'prop-2': property()
  };

  assert.throws(
    () => resolveProperty(catalog, base),
    /ambigua/i
  );
});

test('H04: identidad incompleta se reporta', () => {
  const catalog = {
    'prop-1': property(),
    'prop-2': {
      organizationId: 'org-a',
      propertyGroupId: 'adn',
      activo: true
    }
  };

  const result = validateCatalog(catalog, 'org-a');

  assert.equal(result.valid, false);
});

test('H05: organizaciones distintas no colisionan', () => {
  const catalog = {
    'prop-1': property(),
    'prop-2': property({
      organizationId: 'org-b'
    })
  };

  assert.equal(
    validateCatalog(catalog, 'org-a').valid,
    true
  );
});

test('H06: propiedad comercial incorrecta se rechaza', () => {
  const catalog = {
    'prop-1': property()
  };

  assert.throws(() => resolveProperty(catalog, {
    ...base,
    propiedadId: 'prop-equivocada'
  }));
});

test('H07: la identidad resultante es inmutable', () => {
  const identity = createIdentity(base);

  assert.equal(Object.isFrozen(identity), true);
});

test('H08: el resultado no modifica la ficha original', () => {
  const original = property();
  const catalog = { 'prop-1': original };

  resolveProperty(catalog, base);

  assert.deepEqual(catalog['prop-1'], original);
});

test('H09: unidad inactiva no se resuelve públicamente', () => {
  const catalog = {
    'prop-1': property({ activo: false })
  };

  assert.throws(
    () => resolveProperty(catalog, base),
    /no encontrada/i
  );
});

test('H10: misma unidad en edificios diferentes es válida', () => {
  const catalog = {
    'prop-1': property(),
    'prop-2': property({
      propertyGroupId: 'otro-edificio'
    })
  };

  assert.equal(
    validateCatalog(catalog, 'org-a').valid,
    true
  );
});
