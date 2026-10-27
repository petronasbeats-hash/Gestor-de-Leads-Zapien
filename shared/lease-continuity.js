(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseLeaseContinuity=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const clean=value=>String(value==null?'':value).trim();
  function propertySheet(propertyId,property,config){
    const profile=(config.profiles||[]).find(profile=>profile.propertyGroupId===property.propertyGroupId&&profile.unitTypes.includes(property.unitType));
    const override=config.properties?.[propertyId];
    const terms=override||profile||{};
    const photos=(Array.isArray(property.fotos)?property.fotos:[]).filter(url=>{try{return new URL(url).protocol==='https:';}catch{return false;}});
    return {propertyId,name:property.nombre,unitId:property.unitId||null,rent:Number(property.precio),description:property.descripcion||'',photos,
      included:terms.included||[],excluded:terms.excluded||[],additional:terms.additional||[],pending:terms.pending||[],
      termMonths:terms.termMonths||null,depositMonths:terms.depositMonths||null,
      deposit:terms.depositMonths?Number(property.precio)*terms.depositMonths:null,
      requirements:terms.requirements||[],requirementsConfigured:Boolean(terms.requirements?.length),
      conditionsVersion:terms.version||null,source:terms.source||null};
  }
  function sharePacket(sheet){
    if(!sheet.conditionsVersion)throw Error('CONDITIONS_NOT_CONFIGURED');
    return Object.freeze({propertyId:sheet.propertyId,conditionsVersion:sheet.conditionsVersion,rent:sheet.rent,deposit:sheet.deposit,termMonths:sheet.termMonths,
      requirements:sheet.requirements.map(item=>({id:item.id,label:item.label})),status:'shared'});
  }
  function prepareLeaseRequest({appointment,sheet,packet,input,today}){
    if(appointment.estado!=='realizada')throw Error('VISIT_NOT_COMPLETED');
    if(appointment.propertyId!==sheet.propertyId||input.propertyId!==sheet.propertyId)throw Error('CONTRACT_PROPERTY_MISMATCH');
    if(!packet||packet.propertyId!==sheet.propertyId||packet.conditionsVersion!==sheet.conditionsVersion)throw Error('CONDITIONS_REVIEW_REQUIRED');
    if(input.propertyConfirmed!==true)throw Error('PROPERTY_CONFIRMATION_REQUIRED');
    if(!clean(input.name)||!/^\+?\d[\d\s()-]{8,20}$/.test(clean(input.phone)))throw Error('CONTACT_DATA_REQUIRED');
    const signingDate=clean(input.proposedSigningDate)||null;
    if(signingDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(signingDate)||Number.isNaN(Date.parse(signingDate+'T12:00:00Z'))||new Date(signingDate+'T12:00:00Z').toISOString().slice(0,10)!==signingDate||signingDate<today))throw Error('INVALID_SIGNING_PROPOSAL');
    const declarations=sheet.requirements.map(requirement=>({requirementId:requirement.id,declaredAvailable:Boolean(input.declarations?.[requirement.id]),received:false,validated:false}));
    return Object.freeze({kind:'lease_preparation_requested',propertyId:sheet.propertyId,appointmentId:appointment.id,folio:appointment.folio,
      conditionsVersion:sheet.conditionsVersion,propertySnapshot:{name:sheet.name,rent:sheet.rent,deposit:sheet.deposit,termMonths:sheet.termMonths},
      applicant:{name:clean(input.name),phone:clean(input.phone),identityStatus:'unverified'},declarations,
      proposedSigningDate:signingDate,signingStatus:signingDate?'proposed':'not_proposed',status:'pending_review',
      documentsStatus:declarations.length&&declarations.every(item=>item.declaredAvailable)?'declared_available':'incomplete',
      contractStatus:'not_generated'});
  }
  return Object.freeze({propertySheet,sharePacket,prepareLeaseRequest});
});
