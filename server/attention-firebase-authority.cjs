'use strict';
const {id} = require('./attention-store.cjs');
function createFirebaseAuthority({auth, db, now = () => Date.now()}) {
  async function verify(bearer) {
    if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ') || bearer.length > 8192) throw Error('AUTHENTICATION_REQUIRED');
    try { return await auth.verifyIdToken(bearer.slice(7), true); }
    catch { throw Error('AUTHENTICATION_REQUIRED'); }
  }
  return {
    async session(bearer) {
      const claims = await verify(bearer);
      const organizations = (await db.ref('atencion_acl/orgs').get()).val() || {};
      return {uid: claims.uid, organizations: Object.entries(organizations)
        .filter(([, org]) => org.members?.[claims.uid]?.enabled === true && org.members?.[claims.uid]?.role === 'agent')
        .map(([organizationId, org]) => ({id: organizationId, name: org.name || organizationId}))};
    },
    async agent(bearer, organizationId) {
      id(organizationId);
      const claims = await verify(bearer);
      const org = (await db.ref('atencion_acl/orgs/' + organizationId).get()).val();
      const member = org?.members?.[claims.uid];
      if (!member || member.enabled !== true || member.role !== 'agent') throw Error('ORGANIZATION_FORBIDDEN');
      const permitted = org.propertyIds || {};
      const propertyIds = Object.keys(permitted).filter(propertyId => permitted[propertyId] === true && (!member.propertyIds || member.propertyIds[propertyId] === true));
      return Object.freeze({uid: id(claims.uid), organizationId, role: 'agent', propertyIds});
    },
    async customer(bearer) {
      const claims = await verify(bearer);
      const recent = Number.isFinite(claims.auth_time) && now() / 1000 - claims.auth_time >= 0 && now() / 1000 - claims.auth_time <= 900;
      return {uid: id(claims.uid), role: 'customer', verifiedPhone: recent && claims.firebase?.sign_in_provider === 'phone' ? claims.phone_number : null};
    }
  };
}
module.exports = {createFirebaseAuthority};
