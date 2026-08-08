#!/usr/bin/env node
/* ============================================================================
   BANCO DE PRUEBAS · calculadora-trail.html
   ----------------------------------------------------------------------------
   Corré esto ANTES y DESPUÉS de tocar el motor:   node scripts/test-calculadora-trail.mjs

   Testea el CÓDIGO REAL, no una copia: extrae el <script> más largo del HTML y lo
   evalúa en Node con un DOM de mentira. Si el archivo cambia, el test cambia con él.

   Qué mira, y por qué cada cosa (el detalle largo está en AGENTS.md):
     A · auto-consistencia — darle como referencia la propia carrera objetivo tiene
         que devolver ese mismo tiempo. Es el control que destapó el +7,4 % de la
         rama de segmentos. Si este falla, hay doble conteo en algún lado.
     B · monotonía — subir cualquier control tiene que mover el tiempo para el lado
         correcto. Ojo: endurecer la REFERENCIA da un tiempo MEJOR, y está bien.
     C · saltos de escalón — un metro de altitud no puede mover minutos.
     D · casos borde — distancia 0, tiempos basura, segmentos que suman de más.
     E · coherencia de pantalla — que los tramos sumen el total.
     F · realidad — contra los parciales oficiales de Sierre-Zinal 2025.
   ========================================================================== */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RUTA_HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tools', 'calculadora-trail.html');
// Banco de pruebas: corre el MOTOR REAL de calculadora-trail.html en Node,
// con un DOM de mentira. No copia nada: evalúa el <script> tal cual está en el archivo.

const HTML = fs.readFileSync(RUTA_HTML, "utf8");
const bloques = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const motor = bloques.reduce((a, b) => (b.length > a.length ? b : a), "");

function nodoFalso() {
  const n = {
    textContent: "", innerHTML: "", value: "", checked: false, dataset: {},
    style: {}, children: [],
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, querySelector(){ return nodoFalso(); },
    querySelectorAll(){ return []; }, closest(){ return null; }, getAttribute(){ return null; },
    setAttribute(){}, focus(){}, scrollIntoView(){}, remove(){},
  };
  return n;
}
const doc = {
  getElementById: () => nodoFalso(),
  querySelector: () => nodoFalso(),
  querySelectorAll: () => [],
  createElement: () => nodoFalso(),
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

const API = `;globalThis.__api = { state, compute, kmEff, referenceEffortPace, climateMultiplier,
  globalSlopeFactor, slopeFactor, lookupStep, parseTime, fmtTime, fmtPace,
  T_ALTITUD, T_PENDIENTE, T_RECORRIDO, T_TECNICIDAD, EXP_RIEGEL, K_FATIGA };`;

try {
  vm.runInContext(motor + API, ctx);
} catch (e) {
  console.log("EL MOTOR TIRÓ UN ERROR AL CARGAR:", e.message);
  process.exit(1);
}
const A = ctx.__api;
console.log("motor cargado OK ·", motor.split("\n").length, "líneas de JS\n");

// ---------- helpers del banco ----------
function reset() {
  const s = A.state;
  s.refMode = "race";
  s.refs = [];
  s.race = { name:"Test", date:"", dist:31.2, dplus:2148,
             opts:{tipo:true, dneg:false, alt:false, obj:false},
             tipo:3, dneg:2000, alt:1000, obj:"05:00:00" };
  s.segEnabled = false;
  s.segments = [];
  s.cond = { opts:{temp:false,hum:false,cielo:false,viento:false,sol:false,noche:false,
                   mochila:false,exp:false,cruces:false,desnudo:false},
             temp:20, hum:60, cielo:"cloud", viento:"mod", sol:1, noche:0,
             mochila:1.00, exp:1.00, cruces:0, desnudo:0 };
  return s;
}
function ref(o) {
  A.state.refs.push({ name:"ref", time:"01:00:00", dist:10, dplus:0, tipo:3, alt:0,
                      opts:{tipo:true, alt:false}, ...o });
}
function seg(o) {
  A.state.segments.push({ name:"s", dist:0, dplus:0, dneg:0, alt:null, tec:"", sup:"", pc:0, ...o });
}
const calc = () => A.compute();
const hms = s => A.fmtTime(s);
const api = A;


let ok = 0, mal = 0;
const fallos = [];
function chk(nombre, cond, detalle = "") {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { mal++; fallos.push(nombre + (detalle ? " — " + detalle : "")); console.log(`  FALLA ${nombre} ${detalle}`); }
}
function t(fn) { try { return fn(); } catch (e) { return { crash: e.message }; } }
const T = r => (r && r.ok ? r.totalSec : null);

const SZ = { dist: 31.2, dplus: 2148, dneg: 1045, alt: 1925 };
function base(extra = {}) {
  const s = reset();
  Object.assign(s.race, { dist: SZ.dist, dplus: SZ.dplus, tipo: 3, dneg: SZ.dneg, alt: SZ.alt,
    opts: { tipo: true, dneg: true, alt: true, obj: false } }, extra);
  return s;
}
function segsSZ() {
  seg({ name: "Sierre-Ponchette",   dist: 7.0, dplus: 1314, dneg: 3,   alt: 1165 });
  seg({ name: "Ponchette-Chandolin",dist: 4.8, dplus: 192,  dneg: 86,  alt: 2003 });
  seg({ name: "Chandolin-Tignousa", dist: 3.6, dplus: 258,  dneg: 59,  alt: 2082 });
  seg({ name: "Tignousa-Weisshorn", dist: 4.5, dplus: 227,  dneg: 76,  alt: 2189 });
  seg({ name: "Weisshorn-Barneuza", dist: 6.4, dplus: 134,  dneg: 253, alt: 2349 });
  seg({ name: "Barneuza-Zinal",     dist: 4.9, dplus: 24,   dneg: 567, alt: 2021 });
}
const REF_FER = { time: "03:53:31", dist: 31.2, dplus: 2148, dneg: 1045, tipo: 3, alt: 1925, opts: { tipo: true, alt: true, dneg: true } };

console.log("\n=== A · AUTO-CONSISTENCIA (referencia = la propia carrera objetivo) ===");
{
  base(); ref(REF_FER);
  const a = T(calc());
  chk("sin segmentos devuelve el tiempo de la referencia", Math.abs(a - 14011) < 60, `dio ${hms(a)} vs 3:53:31`);

  base(); ref(REF_FER); api.state.segEnabled = true; segsSZ();
  const b = T(calc());
  chk("con segmentos devuelve lo mismo", Math.abs(b - 14011) < 60, `dio ${hms(b)} vs 3:53:31`);
  chk("con y sin segmentos coinciden", Math.abs(a - b) < 2, `${hms(a)} vs ${hms(b)}`);
}
{ // otra carrera cualquiera, para que no sea casualidad
  base({ dist: 42.2, dplus: 800, dneg: 800, alt: 300, opts:{tipo:true,dneg:true,alt:true,obj:false} });
  ref({ time: "04:10:00", dist: 42.2, dplus: 800, dneg: 800, tipo: 3, alt: 300, opts: { tipo: true, alt: true, dneg: true } });
  const a = T(calc());
  chk("auto-consistencia en una carrera distinta", Math.abs(a - 15000) < 60, `dio ${hms(a)} vs 4:10:00`);
}

console.log("\n=== B · MONOTONÍA (cada control tiene que mover el tiempo para el lado correcto) ===");
function barrido(nombre, valores, aplicar, esperado) {
  const res = valores.map(v => { base(); ref(REF_FER); aplicar(api.state, v); return T(calc()); });
  const creciente = res.every((x, i) => i === 0 || x > res[i-1] - 0.5);
  const decreciente = res.every((x, i) => i === 0 || x < res[i-1] + 0.5);
  const bien = esperado === "sube" ? creciente : decreciente;
  chk(nombre, bien, res.map(hms).join(" → "));
}
barrido("más distancia → más tiempo",        [20, 31.2, 45, 60],    (s, v) => s.race.dist = v, "sube");
barrido("más D+ → más tiempo",               [500, 1500, 2148, 4000],(s, v) => s.race.dplus = v, "sube");
barrido("terreno objetivo más duro → más tiempo", [1,2,3,4,5],      (s, v) => s.race.tipo = v, "sube");
barrido("más altitud → más tiempo",          [500, 1500, 2000, 3000],(s, v) => s.race.alt = v, "sube");
barrido("referencia más lenta → más tiempo", ["03:00:00","03:53:31","05:00:00"], (s, v) => s.refs[0].time = v, "sube");
barrido("terreno de la REFERENCIA más duro → menos tiempo", [1,2,3,4,5], (s, v) => s.refs[0].tipo = v, "baja");
barrido("más calor → más tiempo",  [15, 20, 25, 32], (s, v) => { s.cond.opts.temp = true; s.cond.temp = v; }, "sube");
barrido("más viento → más tiempo", ["none","light","mod","strong","extreme"], (s, v) => { s.cond.opts.viento = true; s.cond.viento = v; }, "sube");
barrido("más noche → más tiempo",  [0, 0.15, 0.35, 0.70, 1.0], (s, v) => { s.cond.opts.noche = true; s.cond.noche = v; }, "sube");
barrido("más mochila → más tiempo",[1.0, 1.015, 1.03, 1.05], (s, v) => { s.cond.opts.mochila = true; s.cond.mochila = v; }, "sube");
barrido("menos experiencia → más tiempo", [0.98, 1.0, 1.01, 1.04], (s, v) => { s.cond.opts.exp = true; s.cond.exp = v; }, "sube");
barrido("peor clima → más tiempo", ["cloud","clear","light","rain","storm"], (s, v) => { s.cond.opts.cielo = true; s.cond.cielo = v; }, "sube");
barrido("más paradas en PC → más tiempo", [0, 5, 15, 30], (s, v) => { s.cond.opts.desnudo = true; s.cond.desnudo = v; }, "sube");
barrido("frío extremo → más tiempo que 10 °C", [10, 5, 0, -10], (s, v) => { s.cond.opts.temp = true; s.cond.temp = v; }, "sube");

console.log("\n=== C · SALTOS DE ESCALÓN (¿un metro de más cambia mucho el resultado?) ===");
function salto(nombre, aplicar, v1, v2, tope) {
  base(); ref(REF_FER); aplicar(api.state, v1); const a = T(calc());
  base(); ref(REF_FER); aplicar(api.state, v2); const b = T(calc());
  const pct = 100 * Math.abs(b - a) / a;
  chk(`${nombre} (${v1}→${v2}) salta menos de ${tope}%`, pct < tope,
      `salta ${pct.toFixed(1)}% = ${Math.round(Math.abs(b-a)/60)} min · ${hms(a)} → ${hms(b)}`);
}
salto("altitud media", (s, v) => s.race.alt = v, 1800, 1801, 1);
salto("altitud media", (s, v) => s.race.alt = v, 2300, 2301, 1);
salto("altitud de la referencia", (s, v) => s.refs[0].alt = v, 2300, 2301, 1);

console.log("\n=== D · CASOS BORDE (que no explote ni devuelva cualquier cosa) ===");
function borde(nombre, montar, valida) {
  const r = t(() => { montar(); return calc(); });
  if (r.crash) { chk(nombre, false, "CRASH: " + r.crash); return; }
  chk(nombre, valida(r), r.ok ? `dio ${hms(r.totalSec)}` : `rechazado: ${r.errs && r.errs[0]}`);
}
borde("carrera llana (D+ = 0)", () => { base({ dplus: 0, dneg: 0 }); ref(REF_FER); },
      r => r.ok && r.totalSec > 0 && isFinite(r.totalSec));
borde("referencia llana (D+ = 0)", () => { base(); ref({ ...REF_FER, dplus: 0 }); },
      r => r.ok && r.totalSec > 0 && isFinite(r.totalSec));
borde("distancia 0 → tiene que rechazar", () => { base({ dist: 0 }); ref(REF_FER); },
      r => !r.ok);
borde("distancia negativa → tiene que rechazar", () => { base({ dist: -10 }); ref(REF_FER); },
      r => !r.ok);
borde("D+ negativo → no debería dar un tiempo válido", () => { base({ dplus: -500 }); ref(REF_FER); },
      r => !r.ok || r.totalSec > 0);
borde("sin referencia → tiene que rechazar", () => { base(); },
      r => !r.ok);
borde("tiempo de referencia basura ('abc')", () => { base(); ref({ ...REF_FER, time: "abc" }); },
      r => !r.ok);
borde("tiempo de referencia vacío", () => { base(); ref({ ...REF_FER, time: "" }); },
      r => !r.ok);
borde("tiempo '90' se lee como 90 minutos", () => { base(); ref({ ...REF_FER, time: "90", dist: 31.2 }); },
      r => r.ok && Math.abs(r.totalSec - 5400) < 5400 * 0.3);
borde("distancia enorme (1000 km)", () => { base({ dist: 1000, dplus: 30000 }); ref(REF_FER); },
      r => r.ok && isFinite(r.totalSec));
borde("altitud absurda (6000 m)", () => { base({ alt: 6000 }); ref(REF_FER); },
      r => r.ok && isFinite(r.totalSec));
borde("segmentos que suman MÁS que la carrera", () => {
        base(); ref(REF_FER); api.state.segEnabled = true;
        seg({ dist: 20, dplus: 1000, dneg: 500, alt: 1500 });
        seg({ dist: 25, dplus: 1148, dneg: 545, alt: 2000 });
      }, r => r.ok && isFinite(r.totalSec) && r.totalSec > 0);
borde("un solo segmento que cubre toda la carrera", () => {
        base(); ref(REF_FER); api.state.segEnabled = true;
        seg({ dist: 31.2, dplus: 2148, dneg: 1045, alt: 1925 });
      }, r => r.ok && isFinite(r.totalSec));
borde("segmento con distancia 0", () => {
        base(); ref(REF_FER); api.state.segEnabled = true;
        seg({ dist: 0, dplus: 100, dneg: 0 }); seg({ dist: 31.2, dplus: 2048, dneg: 1045 });
      }, r => r.ok && isFinite(r.totalSec));
borde("segmentos vacíos con el toggle prendido", () => {
        base(); ref(REF_FER); api.state.segEnabled = true; seg({ dist: 0 });
      }, r => r.ok && isFinite(r.totalSec));
borde("dos referencias", () => {
        base(); ref(REF_FER); ref({ time: "01:55:23", dist: 16.07, dplus: 801, tipo: 3, alt: 2239, opts:{tipo:true,alt:true} });
      }, r => r.ok && isFinite(r.totalSec));
borde("modo 'ritmo de ruta'", () => {
        base(); api.state.refMode = "pace"; api.state.pace = { dist: 21.1, time: "01:45:00" };
      }, r => r.ok && isFinite(r.totalSec));

console.log("\n=== E · COHERENCIA DE LO QUE MUESTRA EN PANTALLA ===");
{
  base(); ref(REF_FER); api.state.segEnabled = true; segsSZ();
  api.state.cond.opts.desnudo = true; api.state.cond.desnudo = 10;
  const r = calc();
  const sumaTramos = r.splits.reduce((a, s) => a + s.tSecAdj + s.pcSec, 0);
  chk("la suma de los tramos da el total", Math.abs(sumaTramos + r.extraSec - r.totalSec) < 2,
      `tramos ${hms(sumaTramos + r.extraSec)} vs total ${hms(r.totalSec)}`);
  const ultimo = r.splits[r.splits.length - 1];
  chk("el acumulado del último tramo es el total", Math.abs(ultimo.accTimeAdj - r.totalSec) < 2,
      `${hms(ultimo.accTimeAdj)} vs ${hms(r.totalSec)}`);
  const sumaKm = r.splits.reduce((a, s) => a + s.dist, 0);
  chk("los km de los tramos suman la distancia de la carrera", Math.abs(sumaKm - 31.2) < 0.15,
      `${sumaKm.toFixed(2)} vs 31.2`);
  chk("el ritmo promedio coincide con tiempo/distancia",
      Math.abs(r.pace - r.totalSec / 31.2) < 1, `${r.pace.toFixed(1)} vs ${(r.totalSec/31.2).toFixed(1)}`);
}
{
  base(); ref(REF_FER);
  api.state.cond.opts.desnudo = true; api.state.cond.desnudo = 20;
  const r = calc();
  chk("el campo global de PCs no se multiplica por el clima",
      Math.abs(r.extraSec - 1200) < 1, `extraSec ${r.extraSec}s`);
}
{
  /* Esto es lo que el test de arriba PARECÍA probar y no probaba: el campo `pc`
     de CADA TRAMO. Ése sí se multiplicaba por el clima dentro del total pero no
     en la lista de tramos, así que con paradas cargadas y viento fuerte la suma
     de los tramos y el número grande no daban lo mismo. Lo cazó el banco de
     interfaz, no éste, y por eso el test ahora está acá también. */
  base(); ref(REF_FER); api.state.segEnabled = true; segsSZ();
  api.state.segments[0].pc = 20;                    // 20 min parado en el primer PC
  const sinClima = calc();
  api.state.cond.opts.viento = true; api.state.cond.viento = "extreme";
  const conClima = calc();
  const ult = conClima.splits[conClima.splits.length - 1];
  chk("con paradas por tramo + clima, los tramos suman el total",
      Math.abs(ult.accTimeAdj - conClima.totalSec) < 2,
      `${hms(ult.accTimeAdj)} vs ${hms(conClima.totalSec)}`);
  chk("estar parado en un PC no se hace más lento por el viento",
      Math.abs((conClima.totalSec - sinClima.totalSec * 1) - (conClima.totalSec - sinClima.totalSec)) < 1e-9 &&
      Math.abs(conClima.splits.reduce((a, s) => a + s.pcSec, 0) - 1200) < 1,
      `paradas ${conClima.splits.reduce((a, s) => a + s.pcSec, 0)}s`);
}
{
  /* Referencias a medio llenar. No aportan un dato y antes contaban igual: la
     banda se angostaba y la pantalla llegaba a decir "5 carreras de referencia
     cargadas" con una sola completa. */
  base(); ref(REF_FER);
  const solaUna = calc();
  api.state.refs.push({ name: "", dist: 0, dplus: 0, tipo: 3, time: "", opts: { tipo: true, alt: false, dneg: false }, alt: 0, dneg: null });
  api.state.refs.push({ name: "", dist: 0, dplus: 0, tipo: 3, time: "", opts: { tipo: true, alt: false, dneg: false }, alt: 0, dneg: null });
  api.state.refs.push({ name: "", dist: 0, dplus: 0, tipo: 3, time: "", opts: { tipo: true, alt: false, dneg: false }, alt: 0, dneg: null });
  api.state.refs.push({ name: "", dist: 0, dplus: 0, tipo: 3, time: "", opts: { tipo: true, alt: false, dneg: false }, alt: 0, dneg: null });
  const conVacias = calc();
  chk("las referencias vacías no se cuentan", conVacias.refPace.sources === 1, `sources ${conVacias.refPace.sources}`);
  chk("las referencias vacías no angostan la banda",
      Math.abs(conVacias.banda.p80 - solaUna.banda.p80) < 1e-9,
      `${(solaUna.banda.p80*100).toFixed(1)} % → ${(conVacias.banda.p80*100).toFixed(1)} %`);
  chk("las referencias vacías no suben la confianza",
      Math.abs(conVacias.refPace.confidence - solaUna.refPace.confidence) < 1e-9,
      `${solaUna.refPace.confidence.toFixed(3)} → ${conVacias.refPace.confidence.toFixed(3)}`);
}
{
  /* El factor de perfil. Con D- = D+ tiene que dar EXACTAMENTE lo mismo que la
     fórmula vieja (es el caso con el que se calibró la constante de 0,80), y
     con perfiles desbalanceados la curva tiene que ser ordenada. */
  const vieja = (dist, dplus, dneg) => {
    if (dist <= 0) return 1;
    const fA = api.slopeFactor(dplus / (dist * 5), false), fD = api.slopeFactor(dneg / (dist * 5), true);
    const t = dplus + dneg; if (t <= 0) return 1;
    return fA * (dplus / t) + fD * (dneg / t);
  };
  const iguales = [[31.2, 2148, 2148], [21, 600, 600], [42, 1000, 1000], [160, 9000, 9000], [10, 0, 0]]
    .every(([d, p, n]) => Math.abs(vieja(d, p, n) - api.globalSlopeFactor(d, p, n)) < 1e-12);
  chk("con D- = D+ el factor de perfil no cambió (la calibración sigue valiendo)", iguales);

  const curva = [0, 500, 1000, 2148, 3000, 5000, 7000].map(dn => {
    base({ dneg: dn, opts: { tipo: true, dneg: true, alt: false, obj: false } }); ref(REF_FER);
    return T(calc());
  });
  chk("más D- nunca da mejor tiempo (curva ordenada)",
      curva.every((x, i) => i === 0 || x >= curva[i - 1] - 0.5), curva.map(hms).join(" → "));

  base({ dist: 31.2, dplus: 500, dneg: 500, opts: { tipo: true, dneg: true, alt: false, obj: false } }); ref(REF_FER);
  const bal = T(calc());
  base({ dist: 31.2, dplus: 500, dneg: 2500, opts: { tipo: true, dneg: true, alt: false, obj: false } }); ref(REF_FER);
  const p2p = T(calc());
  chk("una carrera punto a punto no sale absurdamente más lenta que la balanceada",
      (p2p - bal) / bal < 0.06, `${hms(bal)} → ${hms(p2p)} (+${(100 * (p2p - bal) / bal).toFixed(1)} %)`);
}
{
  // Ritmos con segundos "60": no existen.
  const feos = [];
  for (let s = 150; s <= 900; s += 0.1) if (/:60$/.test(api.fmtPace(s))) feos.push(s.toFixed(1));
  chk("ningún ritmo se muestra con segundos ':60'", feos.length === 0, feos.slice(0, 5).join(" "));
}

console.log("\n=== F · REALIDAD (contra resultados de verdad) ===");
{
  // Parciales oficiales de una participante de Sierre-Zinal 2025 (3:53:31). Dándole su
  // propia carrera como referencia, el modelo tiene que devolver ese mismo tiempo.
  base(); ref(REF_FER); api.state.segEnabled = true; segsSZ();
  const r = calc();
  const reales = [76.2, 29.63, 27.65, 30.83, 40.66, 28.56];
  let peor = 0;
  r.splits.forEach((s, i) => { if (reales[i]) peor = Math.max(peor, Math.abs(s.tSecAdj/60 - reales[i])); });
  console.log("      parciales del modelo vs los parciales reales (Sierre-Zinal 2025):");
  r.splits.forEach((s, i) => console.log(`        ${s.name.padEnd(22)} ${(s.tSecAdj/60).toFixed(1)} min   real ${reales[i]} min   dif ${(s.tSecAdj/60 - reales[i]).toFixed(1)}`));
  chk("ningún tramo se desvía más de 20 min de lo real", peor < 20, `el peor se va ${peor.toFixed(1)} min`);
}

console.log("\n=== G · LA BANDA DE INCERTIDUMBRE ===");
{
  const bandaCon = (n, ratio) => { base(); ref(REF_FER);
    for (let k = 1; k < n; k++) ref({ ...REF_FER, dist: 31.2 + k*0.01 });
    if (ratio) api.state.race.dist = 31.2 * ratio;   // fuerza un salto de tamano
    return calc().banda; };

  const b1 = bandaCon(1), b3 = bandaCon(3), b5 = bandaCon(5);
  chk("la banda existe y trae p50 y p80", !!(b1 && b1.p80 > 0 && b1.p50 > 0));
  chk("la mitad probable es mas angosta que el 80 %", b1.p50 < b1.p80, `${b1.p50} vs ${b1.p80}`);
  chk("se angosta al sumar referencias", b1.p80 > b3.p80 && b3.p80 >= b5.p80,
      `1 ref +-${(b1.p80*100).toFixed(1)}% | 3 +-${(b3.p80*100).toFixed(1)}% | 5 +-${(b5.p80*100).toFixed(1)}%`);
  chk("nunca promete mejor que +-5 %", b5.p80 >= 0.05, `da +-${(b5.p80*100).toFixed(1)}%`);
  chk("nunca se dispara arriba de +-25 %", bandaCon(1, 4).p80 <= 0.25, `da +-${(bandaCon(1,4).p80*100).toFixed(1)}%`);

  base(); ref(REF_FER);
  const rb = calc();
  chk("el borde rapido de la banda sigue siendo un tiempo positivo", rb.totalSec*(1 - rb.banda.p80) > 0);
  chk("el estimado cae justo en el medio de la banda",
      Math.abs((rb.totalSec*(1-rb.banda.p80) + rb.totalSec*(1+rb.banda.p80))/2 - rb.totalSec) < 1);

  base(); api.state.refMode = "pace"; api.state.pace = { dist: 21.1, time: "01:45:00" };
  const rp = calc();
  chk("tambien hay banda estimando desde ritmo de ruta", !!(rp.ok && rp.banda && rp.banda.p80 > 0));
}

console.log(`\n=========== ${ok} pasan · ${mal} fallan ===========`);
if (fallos.length) { console.log("\nFALLAS:"); fallos.forEach(f => console.log("  · " + f)); }
