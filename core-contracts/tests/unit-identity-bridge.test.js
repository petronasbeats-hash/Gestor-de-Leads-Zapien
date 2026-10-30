
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createIdentity,
  createOperationalUnitId,
  resolveProperty,
  validateCatalog
} = require('../property/unit-identity-bridge.v0.1.js');

const identity = {
  organizationId: 'org-a',
  propertyGroupId: 'adn-suites-studios',
  unitId: 'yang-10',
  propiedadId: 'prop-123'
};

test('Acepta identidad completa', () => {
  assert.equal(createIdentity(identity).unitId, 'yang-10');
});

test('Rechaza identidad sin organización', () => {
  assert.throws(() => createIdentity({
    ...identity,
    organizationId: ''
  }));
});

test('Rechaza identidad sin edificio', () => {
  assert.throws(() => createIdentity({
    ...identity,
    propertyGroupId: ''
  }));
});

test('Rechaza identidad sin unidad', () => {
  assert.throws(() => createIdentity({
    ...identity,
    unitId: ''
  }));
});

test('Rechaza identidad sin propiedad comercial', () => {
  assert.throws(() => createIdentity({
    ...identity,
    propiedadId: ''
  }));
});

test('Distingue unidades iguales en edificios diferentes', () => {
  const a = createOperationalUnitId(identity);
  const b = createOperationalUnitId({
    ...identity,
    propertyGroupId: 'otro-edificio'
  });
  assert.notEqual(a, b);
});

test('Resuelve propiedad comercial exacta', () => {
  const catalog = {
    'prop-123': {
      organizationId: 'org-a',
      propertyGroupId: 'adn-suites-studios',
      unitId: 'yang-10',
      activo: true
    }
  };

  assert.equal(resolveProperty(catalog, identity).propiedadId, 'prop-123');
});

test('Rechaza coincidencias de otra organización', () => {
  const catalog = {
    'prop-123': {
      organizationId: 'org-b',
      propertyGroupId: 'adn-suites-studios',
      unitId: 'yang-10'
    }
  };

  assert.throws(() => resolveProperty(catalog, identity));
});

test('Detecta identidades duplicadas', () => {
  const catalog = {
    a: {
      organizationId: 'org-a',
      propertyGroupId: 'adn',
      unitId: '01'
    },
    b: {
      organizationId: 'org-a',
      propertyGroupId: 'adn',
      unitId: '01'
    }
  };

  assert.equal(validateCatalog(catalog, 'org-a').valid, false);
});

test('No confunde unidades de edificios distintos', () => {
  const catalog = {
    a: {
      organizationId: 'org-a',
      propertyGroupId: 'adn',
      unitId: '01'
    },
    b: {
      organizationId: 'org-a',
      propertyGroupId: 'otro',
      unitId: '01'
    }
  };

  assert.equal(validateCatalog(catalog, 'org-a').valid, true);
});
