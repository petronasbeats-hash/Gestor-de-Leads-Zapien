'use strict';
(() => {
  const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  let properties={},selected='',photos=[],photoIndex=0,photoTrigger,bookingTrigger,receiptText='';
  const https=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}};
  const photoRows=p=>(Array.isArray(p?.fotos)?p.fotos:typeof p?.fotos==='string'?p.fotos.split('\n'):[]).map((url,i)=>({url:https(url),caption:p.photoMeta?.[i]?.caption||''})).filter(row=>row.url);
  const money=p=>Number(p?.precio)>0?'$'+Number(p.precio).toLocaleString('es-MX'):'Consulta el precio';
  function setStep(id){for(const step of ['space','visit','confirm']){if(step===id)$('step-'+step).setAttribute('aria-current','step');else $('step-'+step).removeAttribute('aria-current');}}
  function status(message,error=false){$('public-status').textContent=message;$('public-status').classList.toggle('error',error);}
  function choose(id){const select=$('f-propiedad-publico');select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));$('propiedad-picker-card').scrollIntoView({block:'start',behavior:'smooth'});}
  function fallback(parent){const box=el('div',undefined,'photo-fallback');box.append(el('span','◉'),el('small','Conoce todos los detalles en la ficha'));parent.append(box);}
  function image(parent,url,name,lazy=true){const img=el('img');img.src=url;img.alt=name;img.loading=lazy?'lazy':'eager';img.decoding='async';img.addEventListener('error',()=>{img.remove();fallback(parent);},{once:true});parent.append(img);}
  function zone(p){return window.publicLocationLabel?.(p)?.replace(/^📍\s*/,'')||'Tehuacán · consulta la zona con tu asesor';}
  function renderCatalog(data,id){
    properties=data||{};selected=id||'';document.body.classList.toggle('has-property',!!selected);$('mobile-booking').hidden=!selected;$('mobile-price').textContent=selected?money(properties[selected]):'';$('catalog-section').hidden=!!selected;$('property-experience').hidden=!selected;$('propiedad-picker-card').style.display=selected?'grid':'none';setStep(selected?'visit':'space');
    const query=$('catalog-search').value.trim().toLocaleLowerCase('es'),operation=$('catalog-operation').value;
    const active=Object.entries(properties).filter(([,p])=>p&&p.activo!==false),rows=active.filter(([,p])=>(!operation||p.operacion===operation)&&(!query||[p.nombre,p.category,p.descripcion,p.zonaPublica,zone(p)].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(query)));
    $('catalog-count').textContent=rows.length+' espacio'+(rows.length===1?'':'s')+' en catálogo';$('catalog-grid').replaceChildren();
    for(const [key,p]of rows){
      const card=el('article',undefined,'space-card'),cover=el('div',undefined,'space-photo'),availablePhotos=photoRows(p);
      if(availablePhotos.length)image(cover,availablePhotos[0].url,p.nombre||'Espacio en Tehuacán');else fallback(cover);
      cover.append(el('span',p.unitType||p.operacion||'Conoce este espacio','space-type'));
      const copy=el('div',undefined,'space-copy');copy.append(el('h3',p.nombre||'Espacio en Tehuacán'),el('p',zone(p),'space-zone'));
      const specs=[p.recamaras?Number(p.recamaras)+' rec.':null,p.banos?Number(p.banos)+' baño'+(Number(p.banos)===1?'':'s'):null,p.category].filter(Boolean);copy.append(el('p',specs.join(' · ')||'Consulta las características de este espacio.','space-specs'));
      const price=el('div',money(p),'space-price');if(Number(p.precio)>0)price.append(el('small',p.operacion==='Renta'?'MXN / mes':'MXN'));copy.append(price);
      const button=el('button','Conocer este espacio ↗','btn');button.type='button';button.setAttribute('aria-label','Conocer '+(p.nombre||'este espacio'));button.addEventListener('click',()=>choose(key));copy.append(button);card.append(cover,copy);$('catalog-grid').append(card);
    }
    if(!rows.length)$('catalog-grid').append(el('div',active.length?'No encontramos coincidencias. Prueba con otro nombre o cambia el filtro.':'Por ahora no hay espacios publicados. Retoma la conversación con tu asesor para conocer opciones.','empty'));
  }
  function showPhoto(index,trigger){if(!photos.length)return;photoIndex=(index+photos.length)%photos.length;const row=photos[photoIndex];$('photo-large').src=row.url;$('photo-large').alt=row.caption||'Fotografía '+(photoIndex+1)+' del espacio';$('photo-caption').textContent=(photoIndex+1)+' / '+photos.length+(row.caption?' · '+row.caption:'');$('photo-prev').disabled=$('photo-next').disabled=photos.length<2;if(!$('photo-dialog').open){photoTrigger=trigger;$('photo-dialog').showModal();}}
  function listBox(title,rows,kind){if(!rows?.length)return null;const box=el('div',undefined,'service-box '+(kind||'')),ul=el('ul');box.append(el('h4',title));for(const row of rows)ul.append(el('li',row));box.append(ul);return box;}
  function renderDetails(p,id){
    if(!p)return;photos=photoRows(p);$('property-category').textContent=p.category||p.unitType||p.operacion||'TU PRÓXIMO ESPACIO';
    const gallery=$('propiedad-fotos');gallery.replaceChildren();gallery.style.display='grid';
    if(!photos.length)fallback(gallery);
    photos.slice(0,5).forEach((row,i)=>{const button=el('button',undefined,'gallery-photo'+(!i?' gallery-cover':''));button.type='button';button.setAttribute('aria-label',i?'Ver fotografía '+(i+1):'Abrir galería de '+p.nombre);image(button,row.url,row.caption||p.nombre,i>0);if(!i)button.append(el('span','Ver '+photos.length+' foto'+(photos.length===1?'':'s')));if(i===4&&photos.length>5)button.append(el('span','+'+(photos.length-4)+' fotos'));button.addEventListener('click',()=>showPhoto(i,button));gallery.append(button);});
    const sheet=window.SynapseLeaseContinuity?.propertySheet(id,p,window.SYNAPSE_PUBLIC_TERMS||{}),services=$('property-services');services.replaceChildren();
    if(sheet&&(sheet.included.length||sheet.additional.length||sheet.excluded.length||sheet.pending.length)){
      const root=el('section',undefined,'services'),grid=el('div',undefined,'service-grid');root.append(el('h3','Para que tengas todo claro'));
      for(const box of [listBox('Incluido',sheet.included),listBox('Se paga por separado',sheet.additional,'additional'),listBox('Esta unidad no incluye',sheet.excluded,'excluded')])if(box)grid.append(box);
      root.append(grid);if(sheet.pending.length)root.append(el('p','Por confirmar con tu asesor: '+sheet.pending.join('. '),'pending-text'));services.append(root);
    }
    $('property-conditions').hidden=p.operacion!=='Renta';const content=$('property-conditions-content');content.replaceChildren();
    if(p.operacion==='Renta'){
      if(sheet?.termMonths||sheet?.deposit){const grid=el('div',undefined,'terms-grid');if(sheet.termMonths){const term=el('p','Plazo del contrato');term.append(el('strong',sheet.termMonths+' meses'));grid.append(term);}if(sheet.deposit){const deposit=el('p','Depósito');deposit.append(el('strong','$'+sheet.deposit.toLocaleString('es-MX')+' MXN'));grid.append(deposit);}content.append(grid);}
      if(sheet?.requirementsConfigured){content.append(el('p','Para preparar tu proceso de alquiler:'));const ul=el('ul');sheet.requirements.forEach(r=>ul.append(el('li',r.label)));content.append(ul,el('p','Tu asesor te indicará cuándo y por qué medio compartir los documentos. No los necesitas para reservar una visita.','pending-text'));}
      else content.append(el('p','Tu asesor te compartirá el depósito, el plazo y los requisitos que corresponden a este inmueble. Puedes conocerlo primero en tu visita.'));
    }
  }
  function bookingOpened(){bookingTrigger=document.activeElement;setStep('confirm');$('booking-preview').innerHTML=$('confirm-summary').innerHTML;$('f-nombre').focus();document.body.style.overflow='hidden';}
  function bookingClosed(){document.body.style.overflow='';setStep(selected?'visit':'space');if(bookingTrigger?.isConnected)bookingTrigger.focus();}
  function receipt(text){receiptText=text;const copy=$('copy-confirmation');if(copy)copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(receiptText);$('receipt-copy-status').textContent='Confirmación copiada. Ya puedes guardarla o compartirla.';}catch{$('receipt-copy-status').textContent='Puedes seleccionar y copiar los datos de tu confirmación.';}});}
  $('mobile-calendar').addEventListener('click',()=>$('visit-title').scrollIntoView({block:'start',behavior:'smooth'}));
  $('catalog-search').addEventListener('input',()=>renderCatalog(properties,selected));$('catalog-operation').addEventListener('change',()=>renderCatalog(properties,selected));$('back-catalog').addEventListener('click',()=>choose(''));
  $('close-photos').addEventListener('click',()=>$('photo-dialog').close());$('photo-dialog').addEventListener('close',()=>photoTrigger?.focus());$('photo-prev').addEventListener('click',()=>showPhoto(photoIndex-1));$('photo-next').addEventListener('click',()=>showPhoto(photoIndex+1));
  document.addEventListener('keydown',event=>{if($('photo-dialog').open){if(event.key==='ArrowRight'){event.preventDefault();showPhoto(photoIndex+1);}if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(photoIndex-1);}return;}if(!$('overlay').classList.contains('open'))return;if(event.key==='Escape'&&$('btn-confirm-booking')&&!$('btn-confirm-booking').disabled){$('overlay').classList.remove('open');bookingClosed();}if(event.key==='Tab'){const nodes=[...$('modal-content').querySelectorAll('button:not(:disabled),input:not([type=hidden]),select,a[href]')];if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0]?.focus();}}});
  window.SynapseReserveUI={renderCatalog,renderDetails,status,setStep,bookingOpened,bookingClosed,receipt,https};
})();
