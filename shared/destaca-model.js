(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseDestaca=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const stages=Object.freeze({recibida:'Recibida',contactar:'Por contactar',en_atencion:'En atención',concretada:'Resultado registrado',no_procede:'No procede',archivada:'Archivada'});
 function id(v){if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw Error('DESTACA_INVALID_ID');return v;}
 function text(v,max=500){if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('DESTACA_INVALID_TEXT');return v.trim();}
 function choice(v,values,fallback){const value=v||fallback;if(!values.includes(value))throw Error('DESTACA_INVALID_CHOICE');return value;}
 function phone(v){const value=text(v,40),digits=value.replace(/\D/g,'');if(value&&(!/^\+?[0-9 ().-]+$/.test(value)||digits.length<7||digits.length>15))throw Error('DESTACA_INVALID_PHONE');return value;}
 function date(v){if(!v)return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw Error('DESTACA_INVALID_DATE');return v;}
 function normalize(v){
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('DESTACA_INVALID_RECORD');
  const recommender={name:text(v.recommender?.name,180),phone:phone(v.recommender?.phone)};if(!recommender.name)throw Error('DESTACA_RECOMMENDER_REQUIRED');
  const permission=choice(v.contactPermission,['pendiente','permitido','no_contactar'],'pendiente'),stage=choice(v.stage,Object.keys(stages),'recibida'),resultNote=text(v.resultNote,2000);
  if(['contactar','en_atencion'].includes(stage)&&permission!=='permitido')throw Error('DESTACA_CONTACT_PERMISSION_REQUIRED');
  if(['concretada','no_procede','archivada'].includes(stage)&&!resultNote)throw Error('DESTACA_RESULT_REQUIRED');
  const reservationFolio=text(v.reservationFolio,64).toUpperCase();if(reservationFolio&&!/^RSV-[A-Z0-9_-]{4,60}$/.test(reservationFolio))throw Error('DESTACA_INVALID_FOLIO');
  return {schemaVersion:1,id:id(v.id),recommender,referred:{name:text(v.referred?.name,180),phone:phone(v.referred?.phone)},source:text(v.source,180),interest:text(v.interest,500),propertyId:v.propertyId?id(v.propertyId):'',contactPermission:permission,permissionNote:text(v.permissionNote,1000),stage,notes:text(v.notes,3000),nextAction:['concretada','no_procede','archivada'].includes(stage)?{description:'',dueDate:''}:{description:text(v.nextAction?.description,400),dueDate:date(v.nextAction?.dueDate)},reservationFolio,reservationVerification:'pendiente',resultNote,eligibility:'sin_reglas',benefitStatus:'no_autorizado'};
 }
 return Object.freeze({stages,id,normalize});
});
