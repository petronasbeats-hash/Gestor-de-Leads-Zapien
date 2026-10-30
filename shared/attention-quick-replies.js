(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SynapseQuickReplies=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const clean=value=>String(value==null?'':value).trim();
  const money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(value);
  function forProperty(sheet,reservationUrl){
    if(!sheet||!clean(sheet.propertyId)||!clean(sheet.name))return [];
    let url;try{url=new URL(reservationUrl);if(url.protocol!=='https:')throw Error();}catch{throw Error('INVALID_RESERVATION_URL');}
    const name=clean(sheet.name),rent=Number.isFinite(Number(sheet.rent))&&Number(sheet.rent)>0?money(Number(sheet.rent))+' MXN al mes':'renta por confirmar';
    const included=(sheet.included||[]).map(clean).filter(Boolean),excluded=(sheet.excluded||[]).map(clean).filter(Boolean),additional=(sheet.additional||[]).map(clean).filter(Boolean),pending=(sheet.pending||[]).map(clean).filter(Boolean);
    const services=[included.length?'La renta incluye: '+included.join(', ')+'.':'Voy a confirmar contigo qué servicios incluye la renta y cuáles se pagan por separado.'];
    if(excluded.length)services.push('No incluye: '+excluded.join(', ')+'.');
    if(additional.length)services.push('Adicionales: '+additional.join('. ')+'.');
    if(pending.length)services.push('Por confirmar: '+pending.join('. ')+'.');
    const entries=[
      {id:'availability',label:'Disponibilidad · ¿Sigue disponible?',text:'¡Hola! Gracias por tu interés en '+name+'. La renta publicada es de '+rent+'. Revisemos su disponibilidad y las opciones para visitarlo. ¿Para cuándo estás buscando mudarte?'},
      {id:'services',label:'Servicios · ¿Qué incluye la renta?',text:'Con gusto. Sobre '+name+':\n'+services.join('\n')},
      {id:'price',label:'Precio · ¿Cuánto cuesta la renta?',text:'La renta publicada de '+name+' es de '+rent+'. Si quieres, revisamos también los servicios incluidos y los gastos adicionales para que tengas el panorama completo.'},
      {id:'deposit',label:'Depósito y plazo · ¿Qué se solicita?',text:sheet.deposit>0&&sheet.termMonths>0?'Para '+name+' se solicita un depósito en garantía de '+money(sheet.deposit)+' MXN y un contrato de '+sheet.termMonths+' meses. Te comparto las condiciones para que puedas revisarlas antes de continuar.':'Voy a confirmar contigo el depósito y el plazo específicos de '+name+', para darte la información completa.'},
      {id:'requirements',label:'Requisitos · ¿Qué documentos necesito?',text:sheet.requirementsConfigured?'Para '+name+' se solicita:\n'+sheet.requirements.map(item=>'• '+clean(item.label)).join('\n')+'\nSi te falta algún requisito, cuéntame cuál para revisarlo contigo.':'Voy a confirmar los requisitos específicos de '+name+' y te los comparto para que puedas revisarlos con calma.'},
      {id:'visit',label:'Visita · ¿Cuándo puedo conocerlo?',text:'Será un gusto acompañarte a conocer '+name+'. Puedes consultar los horarios disponibles aquí:\n'+url.toString()+'\nSi algún horario te acomoda, te ayudo con el siguiente paso.'},
      {id:'photos',label:'Fotos y características · ¿Tienes más información?',text:'Claro. Te puedo compartir la ficha de '+name+' con sus fotografías y características. Cuéntame qué detalle te gustaría conocer para orientarte mejor.'},
      {id:'electricity',label:'Gastos adicionales · ¿Cuánto pagaré de servicios?',text:'Vamos a revisar los gastos de '+name+' para que tengas una estimación clara. '+(additional.length?'Los adicionales registrados son: '+additional.join('. ')+'. ':'')+'Confirmaré contigo los importes que aún no estén definidos.'},
      {id:'continuity',label:'Continuidad · ¿Cómo seguimos por el enlace?',text:'Te compartiré un enlace personal de Synapse Attention by HYPE Business. Ahí podrás consultar la ficha de '+name+' y continuar la conversación conmigo, sin registrarte ni recibir un SMS.'}
    ];
    return entries.map(entry=>({...entry,propertyId:sheet.propertyId,text:entry.text.length<=2000?entry.text:'Te preparo la información completa de '+name+' para compartirla contigo por partes y resolver tus dudas.'}));
  }
  return Object.freeze({forProperty});
});
