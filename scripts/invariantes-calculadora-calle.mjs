#!/usr/bin/env node
/* ============================================================================
   BANCO DE INVARIANTES · calculadora-calle.html
   ----------------------------------------------------------------------------
   Corré esto antes y después de tocar el motor de ruta:
       node scripts/invariantes-calculadora-calle.mjs

   POR QUÉ EXISTE (2026-08-19)

   La calculadora de ruta no tenía ningún banco que corriera en Node: el único
   que había maneja la página en el navegador. Así que la cuenta nunca se había
   contrastado automáticamente contra la tabla publicada de Daniels, ni se había
   buscado doble conteo barriendo escenarios.

   Prueba PROPIEDADES, no casos: cosas que tienen que valer siempre, contra
   miles de escenarios al azar con semilla fija (si algo falla, vuelve a fallar
   igual). Las tres que más importan:

     · CIERRE          la suma de las partes es el todo, siempre.
     · UNA SOLA VEZ    la misma magnitud no se puede cobrar dos veces.
     · SIN SORPRESAS   nada de NaN, de infinito, de tiempos negativos.

   Y una cuarta que en ruta es la más importante: que el VDOT siga coincidiendo
   con la tabla publicada de Daniels.
   ========================================================================== */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUTA_HTML = process.env.CALLE_HTML
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tools', 'calculadora-calle.html');

const HTML = fs.readFileSync(RUTA_HTML, 'utf8');
const bloques = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const motor = bloques.reduce((a, b) => (b.length > a.length ? b : a), '');

function nodoFalso() {
  return {
    textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {},
    children: [], hidden: false, options: null,
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){}, appendChild(){},
    querySelector(){ return nodoFalso(); }, querySelectorAll(){ return []; },
    closest(){ return null; }, getAttribute(){ return null; }, setAttribute(){},
    hasAttribute(){ return false; }, focus(){}, scrollIntoView(){}, remove(){},
  };
}
const doc = {
  getElementById: () => nodoFalso(), querySelector: () => nodoFalso(),
  querySelectorAll: () => [], createElement: () => nodoFalso(),
  addEventListener(){}, body: nodoFalso(), head: nodoFalso(),
};
const ctx = {
  document: doc,
  window: { addEventListener(){}, scrollTo(){}, matchMedia: () => ({ matches:false, addEventListener(){} }),
            localStorage: { getItem: () => null, setItem(){}, removeItem(){} }, parent: null },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  alert(){}, confirm: () => true, console, setTimeout, clearTimeout, Math, Date, JSON,
  navigator: { clipboard: { writeText(){} } }, URL: { createObjectURL(){}, revokeObjectURL(){} },
  Blob: class {}, ResizeObserver: class { observe(){} },
};
ctx.globalThis = ctx;
ctx.window.document = doc;
vm.createContext(ctx);
try {
  vm.runInContext(motor + ';globalThis.__api = { state, compute, fmtTime, fmtPace, parseTime,'
    + ' vdotFromPerf, timeFromVdot, altFactor, slopeFactor, globalSlopeFactor, climateMultiplier,'
    + ' T_SUPERFICIE, T_ALTITUD };', ctx);
} catch (e) {
  console.log('EL MOTOR TIRÓ UN ERROR AL CARGAR:', e.message);
  process.exit(1);
}
const A = ctx.__api;
const hms = s => A.fmtTime(s);

/* ---------------- azar reproducible ---------------- */
let semilla = 20260819;
function rnd() {
  semilla ^= semilla << 13; semilla >>>= 0;
  semilla ^= semilla >> 17;
  semilla ^= semilla << 5;  semilla >>>= 0;
  return semilla / 4294967296;
}
const entre = (a, b) => a + rnd() * (b - a);
const enteroEntre = (a, b) => Math.floor(entre(a, b + 1));
const unoDe = arr => arr[Math.floor(rnd() * arr.length)];
const aveces = p => rnd() < p;

let ok = 0, mal = 0;
const fallos = [];
function chk(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log('  ok   ' + nombre); }
  else { mal++; fallos.push(nombre + (detalle ? ' — ' + detalle : '')); console.log('  FALLA ' + nombre + '  ->  ' + detalle); }
}

const SUPS = ['', 'asfalto', 'hormigon', 'tartan', 'adoquin', 'mixto', 'ripio'];
const CIELOS = ['clear', 'part', 'cloud', 'light', 'rain', 'storm'];
const VIENTOS = ['none', 'light', 'mod', 'strong', 'extreme'];
const EXPS = ['debut', 'nuevo', 'experimentado', 'veterano'];
const GRUPOS = ['solo', 'small', 'medium', 'large'];

function escenarioAlAzar(opciones = {}) {
  const s = A.state;
  const dist = +entre(3, 100).toFixed(1);
  s.refMode = unoDe(['race', 'race', 'race', 'vam', 'pace']);
  s.vam = { speed: +entre(10, 22).toFixed(1) };
  s.pace = { dist: +entre(3, 42).toFixed(1), time: hms(entre(600, 18000)) };
  const nrefs = enteroEntre(1, 3);
  s.refs = [];
  for (let i = 0; i < nrefs; i++) {
    s.refs.push({
      name: 'ref' + i, dist: +entre(3, 42).toFixed(1), time: hms(entre(600, 20000)),
      opts: { dplus: aveces(0.4), alt: aveces(0.3) },
      dplus: aveces(0.6) ? enteroEntre(0, 1500) : null, alt: enteroEntre(0, 2500),
    });
  }
  s.race = {
    name: 'obj', date: '', dist,
    opts: { dplus: aveces(0.6), dneg: aveces(0.4), alt: aveces(0.4), sup: aveces(0.4), obj: aveces(0.3) },
    dplus: aveces(0.8) ? enteroEntre(0, 2500) : null,
    dneg: aveces(0.7) ? enteroEntre(0, 2500) : null,
    alt: enteroEntre(0, 3000), sup: unoDe(SUPS.slice(1)), obj: hms(entre(900, 30000)),
  };
  s.segEnabled = aveces(0.7);
  s.segments = [];
  const ntramos = opciones.tramos != null ? opciones.tramos : enteroEntre(0, 6);
  let restoD = dist;
  for (let i = 0; i < ntramos; i++) {
    const ultimo = i === ntramos - 1;
    const d = ultimo ? Math.max(0, +restoD.toFixed(2)) : +entre(0, restoD / 1.5).toFixed(2);
    restoD -= d;
    s.segments.push({
      name: 'T' + i, dist: d, dplus: enteroEntre(0, 800), dneg: enteroEntre(0, 800),
      alt: aveces(0.4) ? enteroEntre(0, 3000) : null,
      sup: unoDe(SUPS), stop: aveces(0.3) ? enteroEntre(0, 10) : 0,
    });
  }
  s.cond = {
    opts: { temp: aveces(0.5), hum: aveces(0.4), cielo: aveces(0.4), viento: aveces(0.4),
            sol: aveces(0.3), exp: aveces(0.4), grupo: aveces(0.4), strategy: aveces(0.3),
            stops: aveces(0.3) },
    temp: aveces(0.85) ? enteroEntre(-10, 42) : null,
    hum: aveces(0.85) ? enteroEntre(0, 100) : null,
    cielo: unoDe(CIELOS), viento: unoDe(VIENTOS), sol: enteroEntre(0, 3),
    exp: unoDe(EXPS), grupo: unoDe(GRUPOS), strategy: unoDe(['even', 'neg1', 'neg2', 'pos1']),
    stops: enteroEntre(0, 600),
  };
  return s;
}

const N = 3000;
console.log('motor cargado OK · ' + motor.split('\n').length + ' líneas de JS');
console.log('azar reproducible (semilla 20260819) · ' + N + ' escenarios por propiedad\n');

/* ==========================================================================
   0 · LA CIENCIA — el VDOT contra la tabla publicada de Daniels
   ========================================================================== */
console.log('=== 0 · LA CIENCIA (VDOT contra la tabla publicada de Daniels) ===');
{
  const casos = [
    ['10K en 40:00 da VDOT 52', 10, 40 * 60, 52],
    ['5K en 20:00 da VDOT 50', 5, 20 * 60, 50],
    ['media en 1:30:00 da VDOT 51', 21.097, 90 * 60, 51],
    ['maratón en 3:00:00 da VDOT 54', 42.195, 180 * 60, 54],
    ['10K en 50:00 da VDOT 40', 10, 50 * 60, 40],
  ];
  for (const [nombre, d, t, esperado] of casos) {
    const v = A.vdotFromPerf(d, t);
    chk(nombre, v != null && Math.abs(v - esperado) < 1.2, 'dio ' + (v ? v.toFixed(1) : v));
  }
  /* Solo con velocidades plausibles (5 a 25 km/h). timeFromVdot busca la
     velocidad dentro de [3, 30] km/h y CLAVA en el borde si el dato pedido cae
     afuera, asi que con entradas absurdas el circulo no cierra por diseño. */
  let peor = 0;
  for (let i = 0; i < 200; i++) {
    const d = entre(1, 100);
    const kmh = entre(5, 25);
    const t = d / kmh * 3600;
    const v = A.vdotFromPerf(d, t);
    if (!v || v <= 0) continue;
    const t2 = A.timeFromVdot(v, d);
    if (t2) peor = Math.max(peor, Math.abs(t2 - t) / t);
  }
  chk('del tiempo al VDOT y de vuelta al tiempo se cierra el círculo', peor < 0.005,
      'el peor se va ' + (peor * 100).toFixed(3) + ' %');
}

/* ==========================================================================
   1 · CIERRE
   ========================================================================== */
console.log('\n=== 1 · CIERRE (la suma de las partes tiene que dar el todo) ===');
{
  let peorTr = 0, casoTr = '', peorAcum = 0, casoAcum = '', validos = 0;
  for (let i = 0; i < N; i++) {
    escenarioAlAzar();
    const r = A.compute();
    if (!r.ok) continue;
    validos++;
    const st = r.splits.reduce((a, s) => a + s.tSecAdj + s.stopSec, 0) + r.extraSec;
    if (Math.abs(st - r.totalSec) > peorTr) { peorTr = Math.abs(st - r.totalSec); casoTr = hms(st) + ' vs ' + hms(r.totalSec); }
    const ult = r.splits[r.splits.length - 1];
    const sumaCol = r.splits.reduce((a, s) => a + s.tSecAdj + s.stopSec, 0);
    // (el acumulado del ultimo tramo mas los extras tiene que dar el total)
    const da = Math.abs(ult.accTimeAdj - sumaCol);
    if (da > peorAcum) { peorAcum = da; casoAcum = hms(ult.accTimeAdj) + ' vs ' + hms(sumaCol); }
  }
  console.log('      ' + validos + ' de ' + N + ' escenarios devolvieron un resultado');
  chk('los tramos que se ven en pantalla suman SIEMPRE el total', peorTr < 1.5, 'el peor se va ' + peorTr.toFixed(3) + ' s · ' + casoTr);
  chk('el acumulado del último tramo es la suma de los tiempos de tramo', peorAcum < 1.5, 'el peor se va ' + peorAcum.toFixed(3) + ' s · ' + casoAcum);
}

/* ==========================================================================
   2 · UNA SOLA VEZ
   ========================================================================== */
console.log('\n=== 2 · UNA SOLA VEZ (la misma magnitud no se cobra dos veces) ===');
function limpio(o) {
  o = o || {};
  const dist = o.dist != null ? o.dist : 42;
  const dplus = o.dplus != null ? o.dplus : null;
  const dneg = o.dneg != null ? o.dneg : null;
  const s = A.state;
  s.refMode = 'race';
  s.refs = [{ name: 'r', dist: 10, time: '00:40:00', opts: { dplus: false, alt: false }, dplus: null, alt: 0 }];
  s.race = { name: 'o', date: '', dist,
             opts: { dplus: dplus != null, dneg: dneg != null, alt: !!o.altOn, sup: !!o.supOn, obj: false },
             dplus, dneg, alt: o.alt || 0, sup: o.sup || 'asfalto', obj: '' };
  s.segEnabled = o.tramos != null;
  s.segments = [];
  if (o.tramos != null) {
    for (let i = 0; i < o.tramos; i++) {
      s.segments.push({ name: 'T' + i, dist: dist / o.tramos,
        dplus: (o.dplusSeg != null ? o.dplusSeg : (dplus || 0)) / o.tramos,
        dneg: (o.dplusSeg != null ? o.dplusSeg : ((dneg != null ? dneg : dplus) || 0)) / o.tramos,
        alt: o.altSeg != null ? o.altSeg : null, sup: o.supSeg || '', stop: 0 });
    }
  }
  s.cond = { opts: { temp:false, hum:false, cielo:false, viento:false, sol:false,
                     exp:false, grupo:false, strategy:false, stops:false },
             temp: null, hum: null, cielo: 'part', viento: 'none', sol: 0,
             exp: 'experimentado', grupo: 'solo', strategy: 'even', stops: 0 };
  return A.compute();
}
const T = r => (r && r.ok ? r.totalSec : NaN);
{
  const soloArriba = T(limpio({ dplus: 600, dneg: 600 }));
  const conTramos  = T(limpio({ dplus: 600, dneg: 600, tramos: 4 }));
  chk('el desnivel declarado arriba cuesta lo mismo con y sin tramos que lo reproducen',
      Math.abs(soloArriba - conTramos) < 2, hms(soloArriba) + ' vs ' + hms(conTramos));

  const sinD = T(limpio({ dplus: 0, dneg: 0, tramos: 4, dplusSeg: 0 }));
  const conD = T(limpio({ dplus: 1200, dneg: 1200, tramos: 4, dplusSeg: 0 }));
  chk('subir el D+ de la carrera sube el tiempo aunque los tramos declaren 0',
      conD > sinD + 30, 'sin D+ ' + hms(sinD) + ' · con 1200 m ' + hms(conD));

  const altArriba = T(limpio({ alt: 2500, altOn: true, tramos: 3 }));
  const altAbajo  = T(limpio({ tramos: 3, altSeg: 2500 }));
  const altAmbos  = T(limpio({ alt: 2500, altOn: true, tramos: 3, altSeg: 2500 }));
  chk('altitud: arriba o en los tramos cuesta lo mismo', Math.abs(altArriba - altAbajo) < 2, hms(altArriba) + ' vs ' + hms(altAbajo));
  chk('altitud: en los dos lados no se cobra dos veces', Math.abs(altAmbos - altArriba) < 2, hms(altAmbos) + ' vs ' + hms(altArriba));

  const sinNada = T(limpio({}));
  for (const clave of Object.keys(A.T_SUPERFICIE)) {
    const factor = A.T_SUPERFICIE[clave];
    const arriba = T(limpio({ sup: clave, supOn: true }));
    const abajo  = T(limpio({ tramos: 3, supSeg: clave }));
    chk('superficie «' + clave + '» cuesta el ×' + factor + ' de su tabla',
        Math.abs(arriba / sinNada - factor) < 0.002, 'dio ×' + (arriba / sinNada).toFixed(4));
    chk('superficie «' + clave + '» cuesta lo mismo arriba que en los tramos',
        Math.abs(arriba - abajo) < 2, hms(arriba) + ' vs ' + hms(abajo));
  }

  const sinTramos = T(limpio({ dplus: 500, dneg: 500 }));
  for (const n of [1, 2, 3, 5, 8]) {
    const conTr = T(limpio({ dplus: 500, dneg: 500, tramos: n }));
    chk(String(n).padStart(2) + ' tramos que reproducen la carrera no mueven el total',
        Math.abs(conTr - sinTramos) < 2, hms(sinTramos) + ' vs ' + hms(conTr));
  }

  {
    const s = A.state;
    limpio({ tramos: 3 });
    s.segments.forEach(g => { g.stop = 5; });
    const sinClima = T(A.compute());
    s.cond.opts.viento = true; s.cond.viento = 'extreme';
    const conClima = T(A.compute());
    limpio({ tramos: 3 });
    const pelado = T(A.compute());
    s.cond.opts.viento = true; s.cond.viento = 'extreme';
    const peladoClima = T(A.compute());
    chk('las paradas suman lo mismo con clima que sin clima',
        Math.abs((sinClima - pelado) - (conClima - peladoClima)) < 1.5,
        'sin clima +' + hms(sinClima - pelado) + ' · con clima +' + hms(conClima - peladoClima));
  }
}

/* ==========================================================================
   3 · SIN SORPRESAS
   ========================================================================== */
console.log('\n=== 3 · SIN SORPRESAS (nada de NaN, infinitos ni tiempos imposibles) ===');
{
  let crash = 0, noFinito = 0, negativo = 0, feo = 0, ejemplo = '', validos = 0;
  for (let i = 0; i < N; i++) {
    escenarioAlAzar();
    let r;
    try { r = A.compute(); } catch (e) { crash++; if (!ejemplo) ejemplo = 'crash: ' + e.message; continue; }
    if (!r.ok) continue;
    validos++;
    const nums = [r.totalSec, r.pace, r.avgKmh, r.vdot, r.vamKmh, r.pctVam, r.condMult, r.extraSec];
    if (nums.some(x => !isFinite(x))) { noFinito++; if (!ejemplo) ejemplo = 'no finito: ' + JSON.stringify(nums); }
    if (r.totalSec <= 0) { negativo++; if (!ejemplo) ejemplo = 'total ' + r.totalSec; }
    for (const s of r.splits) {
      const p = A.fmtPace(s.tSecAdj / Math.max(s.dist, 0.01));
      if (/:60$/.test(p)) { feo++; if (!ejemplo) ejemplo = 'ritmo ' + p; }
      if (!isFinite(s.tSecAdj) || !isFinite(s.accTimeAdj) || s.tSecAdj < 0) { noFinito++; if (!ejemplo) ejemplo = 'tramo raro'; }
    }
  }
  console.log('      ' + validos + ' de ' + N + ' escenarios devolvieron un resultado');
  chk('ningún escenario hace explotar el motor', crash === 0, crash + ' explotaron · ' + ejemplo);
  chk('ningún número sale NaN ni infinito', noFinito === 0, noFinito + ' casos · ' + ejemplo);
  chk('ningún tiempo sale en cero o negativo', negativo === 0, negativo + ' casos · ' + ejemplo);
  chk('ningún ritmo se muestra con segundos ":60"', feo === 0, feo + ' casos · ' + ejemplo);
}

/* ==========================================================================
   4 · SENTIDO COMÚN — comparaciones pareadas
   ========================================================================== */
console.log('\n=== 4 · SENTIDO COMÚN (cada control tira para el lado que dice) ===');
{
  const M = 400;
  const peor = {};
  const contar = (k, bien, det) => { peor[k] = peor[k] || { mal: 0, ej: '' }; if (!bien) { peor[k].mal++; if (!peor[k].ej) peor[k].ej = det; } };
  for (let i = 0; i < M; i++) {
    escenarioAlAzar({ tramos: enteroEntre(0, 4) });
    const s = A.state;
    const pareado = (nombre, flojo, duro) => {
      const copia = JSON.parse(JSON.stringify(s));
      flojo(s); const a = A.compute();
      Object.assign(s, JSON.parse(JSON.stringify(copia)));
      duro(s);  const b = A.compute();
      Object.assign(s, copia);
      if (a.ok && b.ok) contar(nombre, b.totalSec >= a.totalSec - 0.5, hms(a.totalSec) + ' → ' + hms(b.totalSec));
    };
    pareado('más distancia da más tiempo',
      st => { st.refMode='race'; st.refs=[{name:'r',dist:10,time:'00:45:00',opts:{dplus:false,alt:false},dplus:null,alt:0}]; st.segEnabled=false; st.race.dist = 10; },
      st => { st.refMode='race'; st.refs=[{name:'r',dist:10,time:'00:45:00',opts:{dplus:false,alt:false},dplus:null,alt:0}]; st.segEnabled=false; st.race.dist = 42; });
    pareado('más D+ da más tiempo',
      st => { st.race.opts.dplus = true; st.race.dplus = 0; st.race.opts.dneg = true; st.race.dneg = 0; st.segments.forEach(g => { g.dplus = 0; g.dneg = 0; }); },
      st => { const n = Math.max(1, st.segments.length); st.race.opts.dplus = true; st.race.dplus = 1500; st.race.opts.dneg = true; st.race.dneg = 1500; st.segments.forEach(g => { g.dplus = 1500 / n; g.dneg = 1500 / n; }); });
    pareado('más altitud da más tiempo',
      st => { st.race.opts.alt = true; st.race.alt = 100; st.segments.forEach(g => { g.alt = null; }); },
      st => { st.race.opts.alt = true; st.race.alt = 3000; st.segments.forEach(g => { g.alt = null; }); });
    pareado('peor superficie da más tiempo',
      st => { st.race.opts.sup = true; st.race.sup = 'asfalto'; st.segments.forEach(g => { g.sup = ''; }); },
      st => { st.race.opts.sup = true; st.race.sup = 'ripio'; st.segments.forEach(g => { g.sup = ''; }); });
    pareado('más calor da más tiempo',
      st => { st.cond.opts.temp = true; st.cond.temp = 10; },
      st => { st.cond.opts.temp = true; st.cond.temp = 38; });
    pareado('más viento da más tiempo',
      st => { st.cond.opts.viento = true; st.cond.viento = 'none'; },
      st => { st.cond.opts.viento = true; st.cond.viento = 'extreme'; });
    pareado('menos experiencia da más tiempo',
      st => { st.cond.opts.exp = true; st.cond.exp = 'veterano'; },
      st => { st.cond.opts.exp = true; st.cond.exp = 'debut'; });
    pareado('correr solo da más tiempo que en pelotón',
      st => { st.cond.opts.grupo = true; st.cond.grupo = 'large'; },
      st => { st.cond.opts.grupo = true; st.cond.grupo = 'solo'; });
    pareado('más paradas da más tiempo',
      st => { st.cond.opts.stops = true; st.cond.stops = 0; },
      st => { st.cond.opts.stops = true; st.cond.stops = 300; });
    pareado('la referencia más lenta da más tiempo',
      st => { st.refMode = 'race'; st.refs = [{ name:'r', dist:10, time:'00:35:00', opts:{dplus:false,alt:false}, dplus:null, alt:0 }]; },
      st => { st.refMode = 'race'; st.refs = [{ name:'r', dist:10, time:'00:55:00', opts:{dplus:false,alt:false}, dplus:null, alt:0 }]; });
  }
  for (const nombre of Object.keys(peor)) chk(nombre, peor[nombre].mal === 0, peor[nombre].mal + ' escenarios al revés · ej: ' + peor[nombre].ej);
}

/* ==========================================================================
   5 · CONTINUIDAD
   ========================================================================== */
console.log('\n=== 5 · CONTINUIDAD (un metro de más no puede mover minutos) ===');
{
  const saltos = [];
  for (let i = 0; i < 200; i++) {
    escenarioAlAzar({ tramos: enteroEntre(0, 3) });
    const s = A.state;
    s.race.opts.alt = true;
    for (const p of [1199, 1499, 1799, 2299, 2799]) {
      s.race.alt = p; const a = A.compute();
      s.race.alt = p + 1; const b = A.compute();
      if (a.ok && b.ok) {
        const salto = Math.abs(b.totalSec - a.totalSec) / a.totalSec;
        if (salto > 0.002) saltos.push(p + '→' + (p + 1) + ' m: ' + (salto * 100).toFixed(2) + ' %');
      }
    }
  }
  chk('un metro de altitud nunca mueve el resultado más de 0,2 %', saltos.length === 0, saltos.slice(0, 3).join(' · '));

  const saltosD = [];
  for (let i = 0; i < 200; i++) {
    escenarioAlAzar({ tramos: 0 });
    const s = A.state;
    s.race.opts.dplus = true;
    s.race.dplus = 500; const a = A.compute();
    s.race.dplus = 501; const b = A.compute();
    if (a.ok && b.ok) {
      const salto = Math.abs(b.totalSec - a.totalSec) / a.totalSec;
      if (salto > 0.002) saltosD.push('500→501 m: ' + (salto * 100).toFixed(2) + ' %');
    }
  }
  chk('un metro de D+ nunca mueve el resultado más de 0,2 %', saltosD.length === 0, saltosD.slice(0, 3).join(' · '));

  {
    const vals = [];
    for (const f of [0.94, 0.95, 0.96]) {
      const s = A.state;
      limpio({ dist: 42, dplus: 600, dneg: 600, tramos: 1 });
      s.segments = [{ name:'a', dist: 42 * f, dplus: 600 * f, dneg: 600 * f, alt: null, sup: '', stop: 0 }];
      vals.push(A.compute().totalSec);
    }
    let maxSalto = 0;
    for (let i = 1; i < vals.length; i++) maxSalto = Math.max(maxSalto, Math.abs(vals[i] - vals[i - 1]) / vals[i - 1]);
    chk('cruzar el borde del «Resto del circuito» no pega un salto', maxSalto < 0.01, (maxSalto * 100).toFixed(2) + ' %');
  }
}

/* ==========================================================================
   6 · ENTRADAS HOSTILES
   ========================================================================== */
console.log('\n=== 6 · ENTRADAS HOSTILES ===');
{
  const casos = [
    ['distancia vacía', s => { s.race.dist = 0; }, r => !r.ok],
    ['distancia negativa', s => { s.race.dist = -5; }, r => !r.ok],
    ['carrera de 100 metros', s => { s.race.dist = 0.1; }, r => r.ok && r.totalSec > 0],
    ['carrera de 250 km', s => { s.race.dist = 250; }, r => r.ok && isFinite(r.totalSec)],
    ['tiempo de referencia basura', s => { s.refs = [{name:'r',dist:10,time:'abc',opts:{dplus:false,alt:false},dplus:null,alt:0}]; }, r => !r.ok],
    ['referencia de 1 segundo', s => { s.refs = [{name:'r',dist:10,time:'00:00:01',opts:{dplus:false,alt:false},dplus:null,alt:0}]; }, r => r.ok && isFinite(r.totalSec)],
    // Una referencia de 1 metro es basura: rechazarla o dar un numero finito, las dos estan bien.
    ['referencia de 1 metro', s => { s.refs = [{name:'r',dist:0.001,time:'00:40:00',opts:{dplus:false,alt:false},dplus:null,alt:0}]; }, r => !r.ok || isFinite(r.totalSec)],
    ['20 tramos', s => { s.segEnabled = true; s.segments = Array.from({length:20},(_,i)=>({name:'T'+i,dist:2,dplus:20,dneg:20,alt:null,sup:'',stop:0})); }, r => r.ok && isFinite(r.totalSec)],
    ['un tramo de 10 metros', s => { s.segEnabled = true; s.segments = [{name:'x',dist:0.01,dplus:0,dneg:0,alt:null,sup:'',stop:0}]; }, r => r.ok && isFinite(r.totalSec)],
    ['tramos que suman el triple', s => { s.segEnabled = true; s.segments = [{name:'a',dist:s.race.dist*3,dplus:900,dneg:900,alt:null,sup:'',stop:0}]; }, r => r.ok && isFinite(r.totalSec)],
    ['tramos sin distancia', s => { s.segEnabled = true; s.segments = [{name:'a',dist:0,dplus:300,dneg:0,alt:2000,sup:'ripio',stop:5}]; }, r => r.ok && isFinite(r.totalSec)],
    ['modo VAM', s => { s.refMode = 'vam'; s.vam = {speed:16}; }, r => r.ok && isFinite(r.totalSec)],
    ['modo VAM en 0', s => { s.refMode = 'vam'; s.vam = {speed:0}; }, r => !r.ok],
    ['modo ritmo test', s => { s.refMode = 'pace'; s.pace = {dist:5, time:'00:20:00'}; }, r => r.ok && isFinite(r.totalSec)],
    ['nombre con etiquetas HTML', s => { s.race.name = '<b>"X"</b> & cía'; }, r => r.ok],
    ['todos los toggles prendidos y todo vacío', s => {
       Object.keys(s.cond.opts).forEach(k => { s.cond.opts[k] = true; });
       s.cond.temp = null; s.cond.hum = null; s.cond.stops = 0;
       s.race.opts.dplus = true; s.race.dplus = null;
       s.race.opts.dneg = true; s.race.dneg = null;
       s.race.opts.alt = true; s.race.alt = 0;
     }, r => r.ok && isFinite(r.totalSec)],
  ];
  for (const caso of casos) {
    const nombre = caso[0], aplicar = caso[1], esperado = caso[2];
    limpio({ tramos: 2 });
    let r;
    try { aplicar(A.state); r = A.compute(); }
    catch (e) { chk(nombre, false, 'explotó: ' + e.message); continue; }
    chk(nombre, esperado(r), r.ok ? 'dio ' + hms(r.totalSec) : 'rechazado');
  }
}

console.log('\n=========== ' + ok + ' pasan · ' + mal + ' fallan ===========');
if (mal) {
  console.log('\nFALLAN:');
  fallos.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
