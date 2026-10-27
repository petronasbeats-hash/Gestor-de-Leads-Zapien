/* Preserve the existing portal format and existing stored folios. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseReservationReference=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  function fromCitaId(citaId,existingFolio){
    if(existingFolio)return String(existingFolio);
    const clean=String(citaId||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
    if(clean.length<8)throw Error('CITA_ID_REQUIRED');
    return 'RSV-'+clean.slice(-8);
  }
  return Object.freeze({fromCitaId});
});
