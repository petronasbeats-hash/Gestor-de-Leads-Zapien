/* ADN Suites & Studios — LIVE intake V1
 * One-shot, idempotent browser migration.
 * Run ONLY from authenticated Synapse admin after reviewing DRY_RUN.
 * Does not overwrite an existing ADN unitId.
 */
(async function ADN_LIVE_INTAKE_V1(){
  const DRY_RUN = true; // EXONERATION GATE: change to false only after reviewing console output.
  if (typeof db === 'undefined' || typeof auth === 'undefined') throw new Error('Synapse db/auth not available.');
  if (!auth.currentUser) throw new Error('Authenticated Synapse admin session required.');

  const address = 'Calle 9 Nte 130, Moctezuma, 75780 Tehuacán, Pue.';
  const lat = 18.4641206;
  const lng = -97.3847854;
  const propertyName = 'ADN Suites & Studios';
  const propertyGroupId = 'adn-suites-studios';

  const units = [
    {unitId:'yang-10',unitNumber:'10',nombre:'ADN · YANG 10 · Suite Sierra',unitType:'SUITE',category:'YANG · Suite privada · Baño completo',precio:3500,m2c:18.14,banos:1,descripcion:'Suite Sierra. Habitación amplia de 18.14 m² aprox. más baño privado completo; preparación para tarja. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG: Sky Terrace, Jardín Botánico y área de lavado/tendido. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yang-09',unitNumber:'09',nombre:'ADN · YANG 09 · Suite 1-1',unitType:'SUITE',category:'YANG · Suite 1-1 · Baño compartido',precio:3000,m2c:13.11,banos:0.5,descripcion:'Suite 1-1 con 13.11 m² aprox. de espacio privado y baño compartido 1:1. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG: Sky Terrace, Jardín Botánico y área de lavado/tendido. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yang-08',unitNumber:'08',nombre:'ADN · YANG 08 · Suite 1-1',unitType:'SUITE',category:'YANG · Suite 1-1 · Baño compartido',precio:3000,m2c:10.40,banos:0.5,descripcion:'Suite 1-1 con 10.40 m² aprox. de espacio privado y baño compartido 1:1. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG: Sky Terrace, Jardín Botánico y área de lavado/tendido. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yang-07',unitNumber:'07',nombre:'ADN · YANG 07 · Suite Espiral',unitType:'SUITE',category:'YANG · Suite privada · Baño completo',precio:3500,m2c:14.34,banos:1,descripcion:'Suite Espiral, 14.34 m² totales aprox., baño privado completo, ventanal tipo balcón, ventanal amplio en baño y preparación para tarja. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG: Sky Terrace, Jardín Botánico y área de lavado/tendido. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yang-06',unitNumber:'06',nombre:'ADN · YANG 06',unitType:'SUITE',category:'YANG · Suite privada · Baño completo',precio:3500,m2c:20,banos:1,descripcion:'Suite amplia de 20 m² totales aprox. con baño privado completo. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG: Sky Terrace, Jardín Botánico y área de lavado/tendido. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yang-04',unitNumber:'04',nombre:'ADN · YANG 04 · Suite Sótano',unitType:'SUITE',category:'YANG · Suite privada · Baño completo',precio:3500,m2c:12.60,banos:1,descripcion:'Suite Sótano, 12.60 m² totales aprox., baño privado completo. Internet y agua incluidos, calentador solar. Acceso a amenidades YANG: Sky Terrace, Jardín Botánico y área de lavado/tendido. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yin-01',unitNumber:'01',nombre:'ADN · YIN 01 · Studio',unitType:'STUDIO',category:'YIN · Studio privado',precio:2800,m2c:12,banos:null,descripcion:'Studio privado de aproximadamente 12 m². Internet y agua incluidos, calentador solar y espacio para motos/bicicletas. No incluye amenidades exclusivas YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yin-06',unitNumber:'06',nombre:'ADN · YIN 06 · Studio',unitType:'STUDIO',category:'YIN · Studio privado',precio:2800,m2c:12,banos:null,descripcion:'Studio privado de aproximadamente 12 m². Internet y agua incluidos, calentador solar y espacio para motos/bicicletas. No incluye amenidades exclusivas YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'},
    {unitId:'yin-05',unitNumber:'05',nombre:'ADN · YIN 05 · Studio',unitType:'STUDIO',category:'YIN · Studio privado',precio:2800,m2c:12,banos:null,descripcion:'Studio privado de aproximadamente 12 m². Internet y agua incluidos, calentador solar y espacio para motos/bicicletas. No incluye amenidades exclusivas YANG. Cajón de estacionamiento con costo adicional sujeto a disponibilidad. Contrato 6 meses; depósito de un mes.'}
  ];

  const snap = await db.ref('propiedades').once('value');
  const existing = snap.val() || {};
  const byUnitId = new Map(Object.entries(existing).filter(([,p])=>p && p.propertyGroupId===propertyGroupId && p.unitId).map(([id,p])=>[p.unitId,{id,p}]));

  const plan = units.map(u => ({unitId:u.unitId, action:byUnitId.has(u.unitId)?'SKIP_EXISTS':'CREATE'}));
  console.table(plan);
  if (DRY_RUN) {
    console.log('DRY_RUN=true — no writes performed. Review plan, then set DRY_RUN=false.');
    return plan;
  }

  const updates = {};
  for (const u of units) {
    if (byUnitId.has(u.unitId)) continue;
    const propId = db.ref('propiedades').push().key;
    updates[propId] = {
      nombre:u.nombre,direccion:address,enlaceExterno:'',lat,lng,
      operacion:'Renta',precio:u.precio,recamaras:null,banos:u.banos,m2c:u.m2c,m2t:null,
      descripcion:u.descripcion,fotos:[],
      propertyName,propertyGroupId,unitId:u.unitId,unitNumber:u.unitNumber,
      unitType:u.unitType,category:u.category,engineVersion:'1.0',activo:true
    };
  }
  if (!Object.keys(updates).length) {
    console.log('No writes needed: all units already exist.');
    return plan;
  }
  await db.ref('propiedades').update(updates);
  console.log('ADN LIVE intake complete:', Object.keys(updates).length, 'unit(s) created.');
  return plan;
})();