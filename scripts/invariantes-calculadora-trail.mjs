#!/usr/bin/env node
/* ============================================================================
   BANCO DE INVARIANTES · calculadora-trail.html
   ----------------------------------------------------------------------------
   Corré esto además de los otros dos:   node scripts/invariantes-calculadora-trail.mjs

   POR QUÉ EXISTE (2026-08-10)

   Los otros dos bancos prueban CASOS: escenarios elegidos a mano, con el
   resultado esperado escrito al lado. Sirven, pero solo encuentran lo que a
   alguien se le ocurrió mirar. La columna «tecnicidad» no movía el tiempo
   estimado durante meses y ninguno de los dos lo vio, porque ninguno la tocó.

   Éste prueba PROPIEDADES que tienen que valer siempre, contra miles de
   escenarios generados al azar. No hace falta saber cuánto tiene que dar: hace
   falta saber qué no puede pasar nunca. Las tres que más importan, que son las
   que pidió Emiliano con estas palabras ("que no se sobre calculen cosas"):

     · CIERRE          la suma de las partes es el todo, siempre.
     · UNA SOLA VEZ    la misma magnitud no se puede cobrar dos veces.
     · SIN SORPRESAS   nada de NaN, de infinito, de tiempos negativos.

   El azar es REPRODUCIBLE (semilla fija): si algo falla, vuelve a fallar igual.
   ========================================================================== */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUTA_HTML = process.env.TRAIL_HTML
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tools', 'calculadora-trail.html');

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
  vm.runInContext(motor + ';globalThis.__api = { state, compute, fmtTime, fmtPace, T_RECORRIDO, T_SUPERFICIE, T_ALTITUD };', ctx);
} catch (e) {
  console.log('EL MOTOR TIRÓ UN ERROR AL CARGAR:', e.message);
  process.exit(1);
}
const A = ctx.__api;
const hms = s => A.fmtTime(s);

/* ---------------- azar reproducible ---------------- */
let semilla = 20260810;
function rnd() {                       // xorshift chico, siempre la misma serie
  semilla ^= semilla << 13; semilla >>>= 0;
  semilla ^= semilla >> 17;
  semilla ^= semilla << 5;  semilla >>>= 0;
  return semilla / 4294967296;
}
const entre = (a, b) => a + rnd() * (b - a);
const enteroEntre = (a, b) => Math.floor(entre(a, b + 1));
const unoDe = arr => arr[Math.floor(rnd() * arr.length)];
const aveces = p => rnd() < p;

/* ---------------- resultados ---------------- */
let ok = 0, mal = 0;
const fallos = [];
function chk(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { mal++; fallos.push(`${nombre}${detalle ? ' — ' + detalle : ''}`); console.log(`  FALLA ${nombre}  ->  ${detalle}`); }
}

/* ---------------- generador de escenarios ---------------- */
const SUPS = ['', 'tierra', 'ripio', 'cesped', 'cespedalto', 'arena', 'barro', 'nieve'];
const CIELOS = ['clear', 'part', 'cloud', 'light', 'rain', 'storm', 'snow'];
const VIENTOS = ['none', 'light', 'mod', 'strong', 'extreme'];

function escenarioAlAzar(opciones = {}) {
  const s = A.state;
  const dist = +entre(5, 170).toFixed(1);
  const dplus = enteroEntre(0, 9000);
  s.refMode = aveces(0.12) ? 'pace' : 'race';
  s.pace = { dist: +entre(5, 42).toFixed(1), time: hms(entre(1200, 18000)) };
  const nrefs = enteroEntre(1, 4);
  s.refs = [];
  for (let i = 0; i < nrefs; i++) {
    const d = +entre(8, 90).toFixed(1), dp = enteroEntre(0, 5000);
    s.refs.push({
      name: 'ref' + i, dist: d, dplus: dp, tipo: enteroEntre(1, 5),
      time: hms(entre(2400, 60000)),
      opts: { tipo: aveces(0.8), alt: aveces(0.4), dneg: aveces(0.4) },
      alt: enteroEntre(0, 3200), dneg: aveces(0.5) ? enteroEntre(0, 5000) : null,
    });
  }
  s.race = {
    name: 'obj', date: '', dist, dplus,
    opts: { tipo: aveces(0.85), dneg: aveces(0.5), alt: aveces(0.5), obj: aveces(0.3) },
    tipo: enteroEntre(1, 5),
    dneg: aveces(0.7) ? enteroEntre(0, 9000) : null,
    alt: enteroEntre(0, 3600),
    obj: hms(entre(3600, 90000)),
  };
  s.segEnabled = aveces(0.75);
  s.segments = [];
  const ntramos = opciones.tramos != null ? opciones.tramos : enteroEntre(0, 8);
  let restoD = dist, restoP = dplus;
  for (let i = 0; i < ntramos; i++) {
    const ultimo = i === ntramos - 1;
    const d = ultimo ? Math.max(0, +restoD.toFixed(2)) : +entre(0, restoD / 1.5).toFixed(2);
    const p = ultimo ? Math.max(0, restoP) : enteroEntre(0, Math.max(0, Math.floor(restoP / 1.5)));
    restoD -= d; restoP -= p;
    s.segments.push({
      name: 'T' + i, dist: d, dplus: p, dneg: enteroEntre(0, 3000),
      alt: aveces(0.5) ? enteroEntre(0, 3600) : null,
      tec: aveces(0.5) ? String(enteroEntre(1, 5)) : '',
      sup: unoDe(SUPS), pc: aveces(0.4) ? enteroEntre(0, 40) : 0,
    });
  }
  s.cond = {
    opts: { temp: aveces(0.5), hum: aveces(0.4), cielo: aveces(0.4), viento: aveces(0.4),
            sol: aveces(0.3), noche: aveces(0.3), mochila: aveces(0.4), exp: aveces(0.4),
            cruces: aveces(0.3), desnudo: aveces(0.3) },
    temp: aveces(0.85) ? enteroEntre(-20, 45) : null,
    hum: aveces(0.85) ? enteroEntre(0, 100) : null,
    cielo: unoDe(CIELOS), viento: unoDe(VIENTOS),
    sol: enteroEntre(0, 3), noche: unoDe([0, 0.25, 0.5, 0.75, 1]),
    mochila: unoDe([1.00, 1.015, 1.03, 1.05]), exp: unoDe([1.04, 1.01, 1.00, 0.98]),
    cruces: enteroEntre(0, 25), desnudo: enteroEntre(0, 60),
  };
  return s;
}

const N = 3000;

console.log(`motor cargado OK · ${motor.split('\n').length} líneas de JS`);
console.log(`azar reproducible (semilla ${20260810}) · ${N} escenarios por propiedad\n`);

/* ==========================================================================
   1 · CIERRE — la suma de las partes es el todo
   ========================================================================== */
console.log('=== 1 · CIERRE (la suma de las partes tiene que dar el todo) ===');
{
  let peorDz = 0, casoDz = '', peorTr = 0, casoTr = '', peorAcum = 0, casoAcum = '', validos = 0;
  let peorCol = 0, casoCol = '';
  for (let i = 0; i < N; i++) {
    escenarioAlAzar();
    const r = A.compute();
    if (!r.ok) continue;
    validos++;

    // (a) los renglones del desglose suman el tiempo estimado
    const suma = r.desglose.filter(x => x.tipo !== 'total').reduce((a, x) => a + x.seg, 0);
    const dTotal = r.desglose.find(x => x.tipo === 'total');
    const d1 = Math.abs(suma - r.totalSec);
    const d2 = Math.abs((dTotal ? dTotal.seg : NaN) - r.totalSec);
    if (Math.max(d1, d2) > peorDz) { peorDz = Math.max(d1, d2); casoDz = `desglose ${hms(suma)} · último ${hms(dTotal ? dTotal.seg : 0)} · total ${hms(r.totalSec)}`; }

    // (b) los tramos que se muestran suman el total
    const st = r.splits.reduce((a, s) => a + s.tSecAdj + s.pcSec, 0) + r.extraSec;
    if (Math.abs(st - r.totalSec) > peorTr) { peorTr = Math.abs(st - r.totalSec); casoTr = `tramos ${hms(st)} vs total ${hms(r.totalSec)}`; }

    /* (c) el acumulado del último tramo, MÁS los cruces y los PC globales, da el
       total. Los extras ya no se le suman al último tramo: se muestran en su
       propia fila, porque metidos ahí adentro el último tramo mostraba un reloj
       que incluía media hora que todavía no había pasado. */
    const ult = r.splits[r.splits.length - 1];
    const da = Math.abs(ult.accTimeAdj + r.extraSec - r.totalSec);
    if (da > peorAcum) { peorAcum = da; casoAcum = `${hms(ult.accTimeAdj)} + ${hms(r.extraSec)} vs ${hms(r.totalSec)}`; }
    // y la columna chica tiene que ser la suma de la columna grande
    const sumaCol = r.splits.reduce((a, s) => a + s.tSecAdj + s.pcSec, 0);
    const dc = Math.abs(ult.accTimeAdj - sumaCol);
    if (dc > peorCol) { peorCol = dc; casoCol = `${hms(ult.accTimeAdj)} vs ${hms(sumaCol)}`; }
  }
  console.log(`      ${validos} de ${N} escenarios devolvieron un resultado`);
  chk('los renglones del desglose suman SIEMPRE el tiempo estimado', peorDz < 1.5, `el peor se va ${peorDz.toFixed(3)} s · ${casoDz}`);
  chk('los tramos que se ven en pantalla suman SIEMPRE el total', peorTr < 1.5, `el peor se va ${peorTr.toFixed(3)} s · ${casoTr}`);
  chk('el acumulado del último tramo más los extras da SIEMPRE el total', peorAcum < 1.5, `el peor se va ${peorAcum.toFixed(3)} s · ${casoAcum}`);
  chk('el acumulado del último tramo es la suma de los tiempos de tramo', peorCol < 1.5, `el peor se va ${peorCol.toFixed(3)} s · ${casoCol}`);
}

/* ==========================================================================
   2 · UNA SOLA VEZ — nada se cobra dos veces
   ========================================================================== */
console.log('\n=== 2 · UNA SOLA VEZ (la misma magnitud no se puede cobrar dos veces) ===');

/* Escenario limpio y controlado, para poder comparar peras con peras. */
function limpio({ dist = 40, dplus = 2000, dneg = 2000, tipo = 3, alt = 0, altOn = false,
                  tramos = null, tec = '', sup = '', altSeg = null } = {}) {
  const s = A.state;
  s.refMode = 'race';
  s.refs = [{ name: 'ref', dist: 30, dplus: 1500, tipo: 3, time: '03:30:00',
              opts: { tipo: true, alt: false, dneg: false }, alt: 0, dneg: null }];
  s.race = { name: 'obj', date: '', dist, dplus,
             opts: { tipo: true, dneg: true, alt: altOn, obj: false },
             tipo, dneg, alt, obj: '' };
  s.segEnabled = tramos != null;
  s.segments = [];
  if (tramos != null) {
    const n = tramos;
    for (let i = 0; i < n; i++) {
      s.segments.push({ name: 'T' + i, dist: dist / n, dplus: dplus / n, dneg: dneg / n,
                        alt: altSeg, tec, sup, pc: 0 });
    }
  }
  s.cond = { opts: { temp:false,hum:false,cielo:false,viento:false,sol:false,noche:false,
                     mochila:false,exp:false,cruces:false,desnudo:false },
             temp: null, hum: null, cielo: 'part', viento: 'none', sol: 1, noche: 0,
             mochila: 1.00, exp: 1.00, cruces: 0, desnudo: 0 };
  return A.compute();
}
const T = r => (r && r.ok ? r.totalSec : NaN);

{
  // (a) LA ALTITUD, declarada en un lugar o en el otro, tiene que costar lo mismo.
  const soloGlobal = T(limpio({ alt: 2500, altOn: true, tramos: 4 }));
  const soloTramos = T(limpio({ alt: 0, altOn: false, tramos: 4, altSeg: 2500 }));
  const enLosDos   = T(limpio({ alt: 2500, altOn: true, tramos: 4, altSeg: 2500 }));
  const sinNada    = T(limpio({ tramos: 4 }));
  chk('altitud: declararla solo en la carrera o solo en los tramos cuesta lo mismo',
      Math.abs(soloGlobal - soloTramos) < 2, `${hms(soloGlobal)} vs ${hms(soloTramos)}`);
  chk('altitud: declararla en los DOS lugares no la cobra dos veces',
      Math.abs(enLosDos - soloGlobal) < 2, `${hms(enLosDos)} vs ${hms(soloGlobal)} (sin altitud: ${hms(sinNada)})`);
  chk('altitud: 2500 m cuesta más que no declararla', soloGlobal > sinNada + 60,
      `${hms(sinNada)} → ${hms(soloGlobal)}`);

  // (b) EL TERRENO, declarado arriba o tramo por tramo, tiene que costar lo mismo.
  const tipoArriba = T(limpio({ tipo: 5, tramos: 4 }));
  const tipoAbajo  = T(limpio({ tipo: 3, tramos: 4, tec: '5' }));
  const enAmbos    = T(limpio({ tipo: 5, tramos: 4, tec: '5' }));
  chk('terreno: declararlo en la carrera o en todos los tramos cuesta lo mismo',
      Math.abs(tipoArriba - tipoAbajo) < 2, `${hms(tipoArriba)} vs ${hms(tipoAbajo)}`);
  chk('terreno: declararlo en los DOS lugares no lo cobra dos veces',
      Math.abs(enAmbos - tipoArriba) < 2, `${hms(enAmbos)} vs ${hms(tipoArriba)}`);

  // (c) LA SUPERFICIE tiene que costar exactamente lo que dice su tabla.
  const base = T(limpio({ tramos: 4 }));
  for (const [clave, factor] of Object.entries(A.T_SUPERFICIE)) {
    const con = T(limpio({ tramos: 4, sup: clave }));
    chk(`superficie «${clave}» cuesta exactamente el ×${factor} de su tabla`,
        Math.abs(con / base - factor) < 0.002, `dio ×${(con / base).toFixed(4)}`);
  }

  // (d) EL INVARIANTE DURO, con distinta cantidad de tramos.
  const sinTramos = T(limpio({}));
  for (const n of [1, 2, 3, 5, 8, 20]) {
    const conTramos = T(limpio({ tramos: n }));
    chk(`${String(n).padStart(2)} tramos que no declaran nada no mueven el total ni un segundo`,
        Math.abs(conTramos - sinTramos) < 1, `${hms(sinTramos)} vs ${hms(conTramos)}`);
  }

  // (e) El tramo implícito «Resto del circuito» tampoco puede mover el total.
  {
    const s = A.state;
    limpio({ tramos: 2 });                       // deja el escenario armado
    s.segments = [{ name: 'medio', dist: 20, dplus: 1000, dneg: 1000, alt: null, tec: '', sup: '', pc: 0 }];
    const conResto = T(A.compute());
    chk('un solo tramo que cubre la mitad, con el resto implícito, no mueve el total',
        Math.abs(conResto - sinTramos) < 1, `${hms(sinTramos)} vs ${hms(conResto)}`);
  }

  /* (e2) EL D+ QUE LOS TRAMOS NO DECLARAN se cuenta al terreno de la carrera.
     Salio de una auditoria: unos tramos que cubrian toda la distancia pero solo
     la mitad del desnivel le pegaban su terreno a TODO el D+ de la carrera, asi
     que declarar 1000 de los 2000 metros como alpino salia igual que declarar
     los 2000. */
  {
    const s = A.state;
    limpio({ dist: 40, dplus: 2000, dneg: 2000, tipo: 3, tramos: 2 });
    // los dos tramos cubren la distancia entera pero solo la mitad del D+
    s.segments = [
      { name: 'A', dist: 20, dplus: 1000, dneg: 1000, alt: null, tec: '5', sup: '', pc: 0 },
      { name: 'B', dist: 20, dplus: 0,    dneg: 1000, alt: null, tec: '',  sup: '', pc: 0 },
    ];
    const mitad = T(A.compute());
    s.segments = [
      { name: 'A', dist: 20, dplus: 1000, dneg: 1000, alt: null, tec: '5', sup: '', pc: 0 },
      { name: 'B', dist: 20, dplus: 1000, dneg: 1000, alt: null, tec: '5', sup: '', pc: 0 },
    ];
    const todo = T(A.compute());
    chk('declarar el terreno de la mitad del D+ cuesta menos que declararlo entero',
        todo > mitad + 30, `mitad ${hms(mitad)} · entero ${hms(todo)}`);
    // y esa mitad tiene que caer entre no declarar nada y declararlo todo
    s.segments = [
      { name: 'A', dist: 20, dplus: 1000, dneg: 1000, alt: null, tec: '', sup: '', pc: 0 },
      { name: 'B', dist: 20, dplus: 1000, dneg: 1000, alt: null, tec: '', sup: '', pc: 0 },
    ];
    const nada = T(A.compute());
    chk('y queda entre no declarar nada y declararlo todo',
        mitad > nada - 1 && mitad < todo + 1, `${hms(nada)} < ${hms(mitad)} < ${hms(todo)}`);
  }

  /* (e3) LA ALTITUD DECLARADA SOLO EN LOS TRAMOS cuesta lo mismo que declarada
     solo arriba, y no puede esquivar el cobro. */
  {
    const soloArriba = T(limpio({ alt: 2500, altOn: true, tramos: 3 }));
    const soloAbajo  = T(limpio({ tramos: 3, altSeg: 2500 }));
    chk('la altitud puesta solo en los tramos cuesta lo mismo que puesta solo arriba',
        Math.abs(soloArriba - soloAbajo) < 2, `${hms(soloArriba)} vs ${hms(soloAbajo)}`);
  }

  // (f) Las paradas se SUMAN, no se multiplican por el clima.
  {
    const s = A.state;
    limpio({ tramos: 3 });
    s.segments.forEach(g => { g.pc = 10; });      // 30 min parados
    const sinClima = T(A.compute());
    s.cond.opts.viento = true; s.cond.viento = 'extreme';
    const conClima = T(A.compute());
    limpio({ tramos: 3 });
    const pelado = T(A.compute());
    s.cond.opts.viento = true; s.cond.viento = 'extreme';
    const peladoClima = T(A.compute());
    chk('las paradas suman lo mismo con clima que sin clima',
        Math.abs((sinClima - pelado) - (conClima - peladoClima)) < 1.5,
        `sin clima +${hms(sinClima - pelado)} · con clima +${hms(conClima - peladoClima)}`);
  }
}

/* ==========================================================================
   3 · SIN SORPRESAS — nada de NaN, infinitos ni tiempos imposibles
   ========================================================================== */
console.log('\n=== 3 · SIN SORPRESAS (nada de NaN, infinitos ni tiempos imposibles) ===');
{
  let crash = 0, noFinito = 0, negativo = 0, textoFeo = 0, bandaMala = 0, ejemplo = '';
  let validos = 0;
  for (let i = 0; i < N; i++) {
    escenarioAlAzar();
    let r;
    try { r = A.compute(); } catch (e) { crash++; if (!ejemplo) ejemplo = 'crash: ' + e.message; continue; }
    if (!r.ok) continue;
    validos++;
    const nums = [r.totalSec, r.pace, r.effPace, r.kmEffRace, r.kmEffUsado, r.condMult,
                  r.extraSec, r.pcFijoSec, r.banda.p80, r.banda.p50, r.ratioUsado,
                  r.refPace.confidence];
    if (nums.some(x => !isFinite(x))) { noFinito++; if (!ejemplo) ejemplo = 'no finito: ' + JSON.stringify(nums); }
    if (r.totalSec <= 0) { negativo++; if (!ejemplo) ejemplo = 'total ' + r.totalSec; }
    if (r.totalSec * (1 - r.banda.p80) <= 0) { bandaMala++; if (!ejemplo) ejemplo = 'borde rápido negativo'; }
    // ningún ritmo con segundos ":60", ni en los tramos ni en el desglose
    for (const s of r.splits) {
      const p = A.fmtPace(s.tSecAdj / Math.max(s.dist, 0.01));
      if (/:60$/.test(p)) { textoFeo++; if (!ejemplo) ejemplo = 'ritmo ' + p; }
      if (!isFinite(s.tSecAdj) || !isFinite(s.accTimeAdj) || s.tSecAdj < 0) { noFinito++; if (!ejemplo) ejemplo = 'tramo ' + JSON.stringify([s.tSecAdj, s.accTimeAdj]); }
    }
    for (const d of r.desglose) {
      if (!isFinite(d.seg)) { noFinito++; if (!ejemplo) ejemplo = 'renglón ' + d.nombre; }
      if (/null|undefined|NaN/.test(String(d.nombre) + String(d.sub))) { textoFeo++; if (!ejemplo) ejemplo = 'texto ' + d.nombre + ' / ' + d.sub; }
    }
  }
  console.log(`      ${validos} de ${N} escenarios devolvieron un resultado`);
  chk('ningún escenario hace explotar el motor', crash === 0, `${crash} explotaron · ${ejemplo}`);
  chk('ningún número sale NaN ni infinito', noFinito === 0, `${noFinito} casos · ${ejemplo}`);
  chk('ningún tiempo sale en cero o negativo', negativo === 0, `${negativo} casos · ${ejemplo}`);
  chk('el borde rápido de la banda sigue siendo un tiempo posible', bandaMala === 0, `${bandaMala} casos`);
  chk('ningún texto de pantalla dice null, undefined, NaN ni un ritmo con :60', textoFeo === 0, `${textoFeo} casos · ${ejemplo}`);
}

/* ==========================================================================
   4 · SENTIDO COMÚN — cada control tira para el lado que dice
   ========================================================================== */
console.log('\n=== 4 · SENTIDO COMÚN (cada control tira para el lado que dice) ===');
{
  const M = 400;
  const peor = {};
  const contar = (k, bien, det) => { peor[k] = peor[k] || { mal: 0, ej: '' }; if (!bien) { peor[k].mal++; if (!peor[k].ej) peor[k].ej = det; } };

  for (let i = 0; i < M; i++) {
    escenarioAlAzar({ tramos: enteroEntre(0, 5) });
    const s = A.state;
    const r0 = A.compute();
    if (!r0.ok) continue;
    const t0 = r0.totalSec;

    /* Comparación PAREADA: se fuerza el estado flojo, se mide, se fuerza el
       estado duro sobre el MISMO escenario, se mide. Comparar contra "lo que
       hubiera" no sirve: si el escenario al azar ya traía 45 °C, poner 38 es
       bajar el calor, y la prueba fallaba por culpa de la prueba. */
    const pareado = (nombre, flojo, duro) => {
      const copia = JSON.parse(JSON.stringify(s));
      flojo(s); const a = A.compute();
      Object.assign(s, JSON.parse(JSON.stringify(copia)));
      duro(s);  const b = A.compute();
      Object.assign(s, copia);
      if (a.ok && b.ok) contar(nombre, b.totalSec >= a.totalSec - 0.5, `${hms(a.totalSec)} → ${hms(b.totalSec)}`);
    };

    pareado('más distancia → más tiempo',
      st => { st.race.dist = 30; }, st => { st.race.dist = 60; });
    pareado('más D+ → más tiempo',
      st => { st.race.dplus = 1000; }, st => { st.race.dplus = 4000; });
    pareado('terreno de la carrera más duro → más tiempo',
      st => { st.race.opts.tipo = true; st.race.tipo = 1; st.segments.forEach(g => { g.tec = ''; }); },
      st => { st.race.opts.tipo = true; st.race.tipo = 5; st.segments.forEach(g => { g.tec = ''; }); });
    pareado('más altitud → más tiempo',
      st => { st.race.opts.alt = true; st.race.alt = 200; st.segments.forEach(g => { g.alt = null; }); },
      st => { st.race.opts.alt = true; st.race.alt = 3400; st.segments.forEach(g => { g.alt = null; }); });
    pareado('más calor → más tiempo',
      st => { st.cond.opts.temp = true; st.cond.temp = 12; },
      st => { st.cond.opts.temp = true; st.cond.temp = 38; });
    pareado('más viento → más tiempo',
      st => { st.cond.opts.viento = true; st.cond.viento = 'none'; },
      st => { st.cond.opts.viento = true; st.cond.viento = 'extreme'; });
    pareado('mochila más pesada → más tiempo',
      st => { st.cond.opts.mochila = true; st.cond.mochila = 1.00; },
      st => { st.cond.opts.mochila = true; st.cond.mochila = 1.05; });
    pareado('menos experiencia → más tiempo',
      st => { st.cond.opts.exp = true; st.cond.exp = 0.98; },
      st => { st.cond.opts.exp = true; st.cond.exp = 1.04; });
    pareado('más paradas → más tiempo',
      st => { st.cond.opts.desnudo = true; st.cond.desnudo = 0; },
      st => { st.cond.opts.desnudo = true; st.cond.desnudo = 60; });
    pareado('más cruces → más tiempo',
      st => { st.cond.opts.cruces = true; st.cond.cruces = 0; },
      st => { st.cond.opts.cruces = true; st.cond.cruces = 25; });
    pareado('más noche → más tiempo',
      st => { st.cond.opts.noche = true; st.cond.noche = 0; },
      st => { st.cond.opts.noche = true; st.cond.noche = 1; });
    pareado('peor cielo → más tiempo',
      st => { st.cond.opts.cielo = true; st.cond.cielo = 'part'; },
      st => { st.cond.opts.cielo = true; st.cond.cielo = 'storm'; });
    pareado('tramos en nieve → más tiempo que en tierra',
      st => { st.segEnabled = true; st.segments.forEach(g => { g.sup = 'tierra'; }); },
      st => { st.segEnabled = true; st.segments.forEach(g => { g.sup = 'nieve'; }); });
    pareado('tramos en terreno 5 → más tiempo que en 1',
      st => { st.segEnabled = true; st.segments.forEach(g => { g.tec = '1'; }); },
      st => { st.segEnabled = true; st.segments.forEach(g => { g.tec = '5'; }); });
    pareado('tramos más altos → más tiempo',
      st => { st.segEnabled = true; st.race.opts.alt = false; st.segments.forEach(g => { g.alt = 200; }); },
      st => { st.segEnabled = true; st.race.opts.alt = false; st.segments.forEach(g => { g.alt = 3400; }); });
    pareado('más paradas en los tramos → más tiempo',
      st => { st.segEnabled = true; st.segments.forEach(g => { g.pc = 0; }); },
      st => { st.segEnabled = true; st.segments.forEach(g => { g.pc = 15; }); });
    pareado('la referencia más lenta → más tiempo',
      st => { st.refMode = 'race'; st.refs = [{ name:'r', dist:30, dplus:1500, tipo:3, time:'03:00:00', opts:{tipo:true,alt:false,dneg:false}, alt:0, dneg:null }]; },
      st => { st.refMode = 'race'; st.refs = [{ name:'r', dist:30, dplus:1500, tipo:3, time:'05:00:00', opts:{tipo:true,alt:false,dneg:false}, alt:0, dneg:null }]; });
    pareado('la referencia en terreno más duro → MENOS tiempo (corre más)',
      st => { st.refMode = 'race'; st.refs = [{ name:'r', dist:30, dplus:1500, tipo:5, time:'04:00:00', opts:{tipo:true,alt:false,dneg:false}, alt:0, dneg:null }]; },
      st => { st.refMode = 'race'; st.refs = [{ name:'r', dist:30, dplus:1500, tipo:1, time:'04:00:00', opts:{tipo:true,alt:false,dneg:false}, alt:0, dneg:null }]; });
  }
  for (const [nombre, d] of Object.entries(peor)) {
    chk(nombre, d.mal === 0, `${d.mal} escenarios al revés · ej: ${d.ej}`);
  }
}

/* ==========================================================================
   5 · CONTINUIDAD — un metro de más no puede mover minutos
   ========================================================================== */
console.log('\n=== 5 · CONTINUIDAD (un metro de más no puede mover minutos) ===');
{
  const saltos = [];
  for (let i = 0; i < 300; i++) {
    escenarioAlAzar({ tramos: enteroEntre(0, 4) });
    const s = A.state;
    s.race.opts.alt = true;
    const puntos = [1199, 1201, 1799, 1801, 2299, 2301, 2799, 2801, 3299, 3301];
    for (const p of puntos) {
      s.race.alt = p; const a = A.compute();
      s.race.alt = p + 1; const b = A.compute();
      if (a.ok && b.ok) {
        const salto = Math.abs(b.totalSec - a.totalSec) / a.totalSec;
        if (salto > 0.002) saltos.push(`${p}→${p + 1} m: ${(salto * 100).toFixed(2)} %`);
      }
    }
  }
  chk('un metro de altitud nunca mueve el resultado más de 0,2 %', saltos.length === 0, saltos.slice(0, 3).join(' · '));

  const saltosD = [];
  for (let i = 0; i < 300; i++) {
    escenarioAlAzar({ tramos: enteroEntre(0, 4) });
    const s = A.state;
    const d0 = s.race.dplus;
    s.race.dplus = d0; const a = A.compute();
    s.race.dplus = d0 + 1; const b = A.compute();
    if (a.ok && b.ok) {
      const salto = Math.abs(b.totalSec - a.totalSec) / a.totalSec;
      if (salto > 0.002) saltosD.push(`${d0}→${d0 + 1} m D+: ${(salto * 100).toFixed(2)} %`);
    }
  }
  chk('un metro de D+ nunca mueve el resultado más de 0,2 %', saltosD.length === 0, saltosD.slice(0, 3).join(' · '));
}

/* ==========================================================================
   6 · ENTRADAS HOSTILES
   ========================================================================== */
console.log('\n=== 6 · ENTRADAS HOSTILES (que no explote ni conteste cualquier cosa) ===');
{
  const casos = [
    ['distancia vacía', s => { s.race.dist = 0; }, r => !r.ok],
    ['distancia negativa', s => { s.race.dist = -10; }, r => !r.ok],
    ['D+ sin cargar', s => { s.race.dplus = null; }, r => !r.ok],
    ['D+ negativo', s => { s.race.dplus = -100; }, r => !r.ok],
    ['D+ de 0 (carrera de llano)', s => { s.race.dplus = 0; }, r => r.ok && isFinite(r.totalSec) && r.totalSec > 0],
    ['carrera de 1000 km', s => { s.race.dist = 1000; s.race.dplus = 40000; }, r => r.ok && isFinite(r.totalSec)],
    ['carrera de 100 metros', s => { s.race.dist = 0.1; s.race.dplus = 5; }, r => r.ok && r.totalSec > 0],
    ['tiempo de referencia basura', s => { s.refs[0].time = 'abc'; s.refs.length = 1; }, r => !r.ok],
    ['tiempo de referencia de 1 segundo', s => { s.refs.length = 1; s.refs[0].time = '00:00:01'; }, r => r.ok && isFinite(r.totalSec)],
    ['referencia de 1 metro', s => { s.refs.length = 1; s.refs[0].dist = 0.001; }, r => r.ok && isFinite(r.totalSec)],
    ['referencia de 40 horas', s => { s.refs.length = 1; s.refs[0].time = '40:00:00'; }, r => r.ok && isFinite(r.totalSec)],
    ['20 tramos', s => { s.segEnabled = true; s.segments = Array.from({ length: 20 }, (_, i) => ({ name: 'T' + i, dist: 2, dplus: 100, dneg: 100, alt: null, tec: '', sup: '', pc: 0 })); }, r => r.ok && isFinite(r.totalSec)],
    ['un tramo de 10 metros', s => { s.segEnabled = true; s.segments = [{ name: 'x', dist: 0.01, dplus: 0, dneg: 0, alt: null, tec: '', sup: '', pc: 0 }]; }, r => r.ok && isFinite(r.totalSec)],
    ['tramos que suman el triple de la carrera', s => { s.segEnabled = true; s.segments = [{ name: 'a', dist: s.race.dist * 3, dplus: 5000, dneg: 5000, alt: null, tec: '', sup: '', pc: 0 }]; }, r => r.ok && isFinite(r.totalSec)],
    ['todos los tramos sin distancia', s => { s.segEnabled = true; s.segments = [{ name: 'a', dist: 0, dplus: 500, dneg: 0, alt: 2000, tec: '5', sup: 'nieve', pc: 10 }]; }, r => r.ok && isFinite(r.totalSec)],
    ['modo ritmo de ruta con tramos', s => { s.refMode = 'pace'; s.pace = { dist: 21.1, time: '01:45:00' }; s.segEnabled = true; s.segments = [{ name: 'a', dist: 10, dplus: 500, dneg: 200, alt: 1800, tec: '4', sup: 'barro', pc: 5 }]; }, r => r.ok && isFinite(r.totalSec)],
    ['nombre con comillas y etiquetas', s => { s.race.name = '<b>"La Cruz"</b> & cía'; }, r => r.ok],
    ['nombre de 500 caracteres', s => { s.race.name = 'x'.repeat(500); }, r => r.ok],
    ['todos los toggles prendidos y todos los campos vacíos', s => {
      Object.keys(s.cond.opts).forEach(k => { s.cond.opts[k] = true; });
      s.cond.temp = null; s.cond.hum = null; s.cond.cruces = 0; s.cond.desnudo = 0;
      s.race.opts.dneg = true; s.race.dneg = null; s.race.opts.alt = true; s.race.alt = 0;
    }, r => r.ok && isFinite(r.totalSec)],
  ];
  for (const [nombre, aplicar, esperado] of casos) {
    limpio({ tramos: 2 });
    let r;
    try { aplicar(A.state); r = A.compute(); }
    catch (e) { chk(nombre, false, 'explotó: ' + e.message); continue; }
    chk(nombre, esperado(r), r.ok ? `dio ${hms(r.totalSec)}` : 'rechazado: ' + (r.errs || []).join(' / '));
  }
}

/* ==========================================================================
   INFORME
   ========================================================================== */
console.log(`\n=========== ${ok} pasan · ${mal} fallan ===========`);
if (mal) {
  console.log('\nFALLAN:');
  fallos.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
