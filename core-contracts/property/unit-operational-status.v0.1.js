(function(root) {
  'use strict';

  const VERSION = '0.1';

  const DEFAULT_STATUS = Object.freeze({
    physicalCondition: 'unknown',
    visitPolicy: 'verification_required',
    photoStatus: 'unverified',
    deliveryStatus: 'unknown',
    estimatedCompletionAt: null,
    lastVerifiedAt: null,
    maintenanceReportStatus: 'unknown'
  });

  const ALLOWED_VALUES = Object.freeze({
    physicalCondition: ['unknown', 'ready', 'maintenance', 'damaged', 'under_construction'],
    visitPolicy: ['verification_required', 'allowed', 'allowed_with_notice', 'not_allowed'],
    photoStatus: ['unverified', 'verified_current', 'outdated', 'unavailable'],
    deliveryStatus: ['unknown', 'ready', 'not_ready'],
    maintenanceReportStatus: ['unknown', 'pending', 'verified', 'not_required']
  });

  function validDate(value) {
    if (typeof value !== 'string') return false;

    const match = value.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
    );

    if (!match) return false;

    const time = Date.parse(value);
    if (!Number.isFinite(time)) return false;

    const [year, month, day] = match[1].split('-').map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));

    return calendar.getUTCFullYear() === year &&
      calendar.getUTCMonth() === month - 1 &&
      calendar.getUTCDate() === day;
  }

  function validEvidence(evidence, verifiedAt, organizationId, unitId) {
    if (!evidence || typeof evidence !== 'object' ||
        Array.isArray(evidence)) return false;

    return typeof organizationId === 'string' &&
      organizationId.trim().length > 0 &&
      typeof unitId === 'string' &&
      unitId.trim().length > 0 &&
      evidence.organizationId === organizationId &&
      evidence.unitId === unitId &&
      evidence.status === 'verified' &&
      typeof evidence.id === 'string' &&
      evidence.id.trim().length > 0 &&
      typeof evidence.verifiedBy === 'string' &&
      evidence.verifiedBy.trim().length > 0 &&
      validDate(evidence.verifiedAt) &&
      evidence.verifiedAt === verifiedAt;
  }

  function normalize(status) {
    const input = status && typeof status === 'object'
      && !Array.isArray(status) ? status : {};

    const result = {};
    for (const key of Object.keys(DEFAULT_STATUS)) {
      const value = input[key];

      if (Object.prototype.hasOwnProperty.call(ALLOWED_VALUES, key)) {
        result[key] = ALLOWED_VALUES[key].includes(value)
          ? value
          : DEFAULT_STATUS[key];
      } else if (
        key === 'lastVerifiedAt' ||
        key === 'estimatedCompletionAt'
      ) {
        result[key] = validDate(value) ? value : null;
      } else {
        result[key] = value == null
          ? DEFAULT_STATUS[key]
          : value;
      }
    }

    result.organizationId =
      typeof input.organizationId === 'string' &&
      input.organizationId.trim()
        ? input.organizationId : null;

    result.unitId =
      typeof input.unitId === 'string' &&
      input.unitId.trim()
        ? input.unitId : null;

    result.verificationEvidence = validEvidence(
      input.verificationEvidence,
      result.lastVerifiedAt,
      result.organizationId,
      result.unitId
    ) ? {
      id: input.verificationEvidence.id,
      organizationId: result.organizationId,
      unitId: result.unitId,
      verifiedBy: input.verificationEvidence.verifiedBy,
      verifiedAt: input.verificationEvidence.verifiedAt,
      status: 'verified'
    } : null;

    return result;
  }

  function evaluate(status) {
    const s = normalize(status);
    const warnings = [];

    if (s.physicalCondition !== 'ready') {
      warnings.push('Condición física no confirmada como lista');
    }

    if (s.visitPolicy === 'allowed_with_notice') {
      warnings.push('Visita permitida con aviso; verificar acceso seguro');
    } else if (s.visitPolicy !== 'allowed') {
      warnings.push('Visita pendiente de autorización o verificación');
    }

    if (s.photoStatus !== 'verified_current') {
      warnings.push('Fotografías actuales no verificadas');
    }

    if (s.deliveryStatus !== 'ready') {
      warnings.push('Entrega no confirmada');
    }

    return {
      version: VERSION,
      status: s,
      warnings,
      readyForDelivery:
        s.physicalCondition === 'ready' &&
        s.deliveryStatus === 'ready' &&
        s.lastVerifiedAt !== null &&
        s.verificationEvidence !== null
    };
  }

  const api = Object.freeze({
    VERSION,
    DEFAULT_STATUS,
    normalize,
    evaluate
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.UnitOperationalStatus = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
