#!/usr/bin/env node
/* ============================================================================
   VALIDACIÓN CONTRA CARRERAS REALES · calculadora-trail.html
   ----------------------------------------------------------------------------
   Corré esto al tocar las constantes:   node scripts/validar-calculadora-trail.mjs

   Testea el CÓDIGO REAL, no una copia: extrae el <script> más largo del HTML y lo
   evalúa en Node con un DOM de mentira. Si el archivo cambia, el test cambia con él.

   Toma 14 atletas de élite con sus resultados reales (distancia y D+ de ITRA, medidos
   con el mismo criterio en todas las carreras) y, para cada par de carreras que la
   MISMA persona corrió dentro de 14 meses, usa una como referencia y predice la otra.
   Después compara con lo que realmente marcó el reloj.

   Sirve para dos cosas: saber cuánto vale el pronóstico (spoiler: error mediano ~7 %,
   no 3 %) y recalibrar la constante de desnivel sin inventar. El barrido de la
   constante está al final.
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


// Diario del lunes: para cada atleta, uso una carrera como referencia y predigo OTRA
// que corrió de verdad. Datos de ITRA (distancia y D+ medidos con el mismo criterio
// en todas las carreras, que es justo lo que el modelo necesita).

const D = {
 Elazzaoui:[["2026-07-05","Quebec Mega Trail 30K",29,1369,"2:08:53"],["2026-05-24","Ledro Sky",21,1656,"1:55:48"],
   ["2026-05-17","Zegama",43,2634,"3:45:07"],["2025-10-12","Ledro Sky Final",21,1700,"1:58:30"],
   ["2025-08-09","Sierre-Zinal",31,2190,"2:35:58"],["2025-06-29","Tepec Trail",34,1850,"3:00:01"]],
 Kiriago:[["2026-07-05","Quebec Mega Trail 30K",29,1369,"2:08:27"],["2026-05-24","Ledro Sky",21,1656,"1:57:07"],
   ["2026-05-09","Transvulcania Half",25,2135,"2:07:43"],["2026-05-07","Transvulcania Uphill",7,1174,"0:47:33"],
   ["2026-05-01","Innsbruck Trail",24,1481,"1:55:35"],["2026-04-30","Innsbruck VTC",7,1328,"0:50:57"]],
 Kipngeno:[["2026-05-24","Ledro Sky",21,1656,"2:00:43"],["2025-10-12","Ledro Sky Final",21,1700,"1:58:50"],
   ["2025-09-25","WMTRC Vertical",6,992,"0:39:20"],["2025-08-09","Sierre-Zinal",31,2190,"2:29:08"],
   ["2025-06-29","Tepec Trail",34,1850,"3:00:11"]],
 Blanes:[["2026-06-07","Euro Off-Road",13,785,"1:11:53"],["2025-09-26","WMTRC Long",45,3518,"4:51:52"],
   ["2025-08-09","Sierre-Zinal",31,2190,"2:35:19"],["2025-05-25","Zegama",43,2634,"3:50:53"]],
 Liaci:[["2025-09-28","WMTRC Short",14,829,"1:13:15"],["2025-09-25","WMTRC Vertical",6,992,"0:49:04"],
   ["2025-08-09","Sierre-Zinal",31,2190,"3:00:20"],["2024-10-19","GT Finals",24,1511,"2:18:27"],
   ["2024-09-22","Mammoth 26",26,1400,"2:22:31"]],
 Hottenrott:[["2026-07-25","Davos Silver Run",23,915,"1:46:39"],["2026-06-05","Euro Off-Road Up",8,1281,"1:00:31"],
   ["2026-04-30","Innsbruck VTC",7,1328,"1:00:41"],["2026-04-19","Berglauf 13K",13,750,"0:58:50"],
   ["2025-09-25","WMTRC Vertical",6,992,"0:47:43"]],
 Yao:[["2026-05-16","UTA50",51,2220,"4:33:12"],["2025-08-28","OCC",60,3280,"5:35:13"],
   ["2025-08-09","Sierre-Zinal",31,2190,"3:01:35"],["2025-07-04","Val d'Aran PDA",51,2720,"5:31:39"]],
 Saapunki:[["2025-09-25","WMTRC Vertical",6,992,"0:45:59"],["2025-08-09","Sierre-Zinal",31,2190,"3:02:29"],
   ["2024-07-14","Montemuro Vertical",10,1090,"1:04:07"],["2024-07-06","Grossglockner",13,1265,"1:25:29"],
   ["2024-06-16","Neirivue-Moleson",10,1290,"1:10:37"]],
 Gibson:[["2025-10-11","Ledro Sky Final",21,1700,"2:35:40"],["2025-09-28","WMTRC Short",14,829,"1:16:23"],
   ["2025-09-25","WMTRC Vertical",6,992,"0:46:07"],["2025-08-09","Sierre-Zinal",31,2190,"3:05:25"],
   ["2025-06-22","Broken Arrow 23K",22,1370,"2:03:46"]],
 Lang:[["2026-06-28","Marathon Mont-Blanc",43,2450,"4:21:23"],["2026-06-07","Euro Off-Road",13,782,"1:18:00"],
   ["2025-09-26","WMTRC Long",45,3518,"5:38:54"],["2025-08-26","ETC",15,1180,"1:38:17"],
   ["2025-08-09","Sierre-Zinal",31,2190,"3:07:16"]],
 Kimutai:[["2026-07-05","Quebec Mega Trail 30K",29,1369,"2:36:24"],["2026-05-24","Ledro Sky",21,1656,"2:15:48"],
   ["2025-08-09","Sierre-Zinal",31,2190,"2:55:31"],["2025-08-02","Pitz Alpine",20,985,"1:56:56"],
   ["2025-07-05","Restonica 50K",32,2274,"3:42:25"]],
 Rolli:[["2026-06-28","Marathon Mont-Blanc",43,2450,"3:56:50"],["2026-06-07","Euro Off-Road",13,785,"1:01:03"],
   ["2026-06-05","Euro Off-Road Up",8,1281,"0:52:24"],["2025-10-12","Ledro Sky Final",21,1700,"2:05:53"],
   ["2025-09-28","WMTRC Short",14,829,"1:03:56"]],
 Nilsson:[["2026-06-21","Titov Vrv Sky",19,1815,"2:09:06"],["2026-06-13","Pelister Half",21,1211,"1:39:57"],
   ["2026-06-07","Euro Off-Road",13,785,"1:02:05"],["2026-05-23","Uka Pain 28K",28,800,"1:46:14"],
   ["2026-05-09","Transvulcania Half",25,2135,"2:11:46"],["2026-05-07","Transvulcania Uphill",7,1174,"0:48:46"]],
 Briffod:[["2026-06-28","Marathon Mont-Blanc",43,2450,"3:46:20"],["2026-06-07","Rochers-de-Naye",18,1769,"1:27:49"],
   ["2026-05-17","Zegama",43,2634,"4:07:59"],["2026-04-25","Ventoux Coteaux",26,1100,"1:45:41"],
   ["2025-08-09","Sierre-Zinal",31,2190,"2:32:06"]],
};

const hhmmss = s => { const p = s.split(":").map(Number); return p[0]*3600+p[1]*60+p[2]; };
const dias = (a,b) => Math.abs(new Date(a)-new Date(b))/86400000;

function predecir(r0, r1){          // r0 = referencia, r1 = objetivo
  const s = reset();
  Object.assign(s.race, {dist:r1[2], dplus:r1[3], tipo:3,
    opts:{tipo:true, dneg:false, alt:false, obj:false}});
  ref({time:r0[4], dist:r0[2], dplus:r0[3], tipo:3, opts:{tipo:true, alt:false, dneg:false}});
  const r = calc();
  return r.ok ? r.totalSec : null;
}

const filas = [];
for (const [atleta, carreras] of Object.entries(D)) {
  for (const a of carreras) for (const b of carreras) {
    if (a === b) continue;
    if (dias(a[0], b[0]) > 430) continue;
    if (a[2] < 10 || b[2] < 10) continue;      // fuera los verticales puros
    if (a[2] > 60 || b[2] > 60) continue;      // fuera los ultra
    const p = predecir(a, b), real = hhmmss(b[4]);
    if (!p) continue;
    const ke = (d,dp) => d + dp/100*1.16;
    filas.push({atleta, de:a[1], a:b[1], real, pred:p, err:100*(p/real-1),
                ratio: Math.max(ke(b[2],b[3]),ke(a[2],a[3]))/Math.min(ke(b[2],b[3]),ke(a[2],a[3]))});
  }
}

const abs = filas.map(f=>Math.abs(f.err)).sort((x,y)=>x-y);
const med = a => a.length%2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2;
const sesgo = filas.reduce((s,f)=>s+f.err,0)/filas.length;

console.log(`\n${filas.length} predicciones sobre ${Object.keys(D).length} atletas · carreras de 10 a 60 km, misma persona, dentro de 14 meses\n`);
console.log(`  error ABSOLUTO mediano : ${med(abs).toFixed(1)} %`);
console.log(`  error absoluto medio   : ${(abs.reduce((a,b)=>a+b,0)/abs.length).toFixed(1)} %`);
console.log(`  SESGO (con signo)      : ${sesgo>0?"+":""}${sesgo.toFixed(1)} %   ${sesgo>0?"(predice de más = lento)":"(predice de menos = rápido)"}`);
console.log(`  dentro de ±3 %         : ${(100*abs.filter(x=>x<=3).length/abs.length).toFixed(0)} %`);
console.log(`  dentro de ±5 %         : ${(100*abs.filter(x=>x<=5).length/abs.length).toFixed(0)} %`);
console.log(`  dentro de ±10 %        : ${(100*abs.filter(x=>x<=10).length/abs.length).toFixed(0)} %`);
console.log(`  percentil 90           : ${abs[Math.floor(0.9*abs.length)].toFixed(1)} %`);

console.log("\npor cuánto extrapola (ratio de km-esfuerzo entre las dos carreras):");
for (const [lo,hi,et] of [[1,1.3,"casi igual (<1,3x)"],[1.3,1.8,"1,3 a 1,8x"],[1.8,10,"más de 1,8x"]]) {
  const g = filas.filter(f=>f.ratio>=lo&&f.ratio<hi);
  if(!g.length) continue;
  const ga = g.map(f=>Math.abs(f.err)).sort((x,y)=>x-y);
  const gs = g.reduce((s,f)=>s+f.err,0)/g.length;
  console.log(`  ${et.padEnd(20)} n=${String(g.length).padStart(3)}  error mediano ${med(ga).toFixed(1)}%  sesgo ${gs>0?"+":""}${gs.toFixed(1)}%  dentro de ±5%: ${(100*ga.filter(x=>x<=5).length/ga.length).toFixed(0)}%`);
}

console.log("\nlas 8 peores:");
filas.sort((a,b)=>Math.abs(b.err)-Math.abs(a.err)).slice(0,8).forEach(f=>
  console.log(`  ${f.atleta.padEnd(11)} ${f.de.slice(0,20).padEnd(21)}-> ${f.a.slice(0,20).padEnd(21)} real ${hms(f.real)} pred ${hms(f.pred)} ${f.err>0?"+":""}${f.err.toFixed(1)}%`));
console.log("\nlas 8 mejores:");
filas.slice(-8).reverse().forEach(f=>
  console.log(`  ${f.atleta.padEnd(11)} ${f.de.slice(0,20).padEnd(21)}-> ${f.a.slice(0,20).padEnd(21)} real ${hms(f.real)} pred ${hms(f.pred)} ${f.err>0?"+":""}${f.err.toFixed(1)}%`));

// ---- ¿de dónde sale el error? ----
const emp = (r)=>r[3]/r[2];   // metros de D+ por km = qué tan empinada es
const filas2 = [];
for (const [atleta, carreras] of Object.entries(D)) {
  for (const a of carreras) for (const b of carreras) {
    if (a===b || dias(a[0],b[0])>430) continue;
    if (a[2]<10||b[2]<10||a[2]>60||b[2]>60) continue;
    const p=predecir(a,b), real=hhmmss(b[4]); if(!p) continue;
    filas2.push({err:100*(p/real-1), dEmp:Math.abs(emp(a)-emp(b)), ea:emp(a), eb:emp(b)});
  }
}
console.log("\n\n=== ¿de dónde sale el error? por diferencia de EMPINADO entre las dos carreras ===");
console.log("(empinado = metros de D+ por km. Sierre-Zinal son 71, un trail rodador son 40, un vertical 150)\n");
for (const [lo,hi,et] of [[0,15,"parecidas (<15 m/km de dif)"],[15,30,"15 a 30 m/km"],[30,45,"30 a 45 m/km"],[45,999,"más de 45 m/km"]]) {
  const g=filas2.filter(f=>f.dEmp>=lo&&f.dEmp<hi); if(!g.length) continue;
  const ga=g.map(f=>Math.abs(f.err)).sort((x,y)=>x-y);
  const gs=g.reduce((s,f)=>s+f.err,0)/g.length;
  console.log(`  ${et.padEnd(28)} n=${String(g.length).padStart(3)}  error mediano ${med(ga).toFixed(1)}%  sesgo ${gs>0?"+":""}${gs.toFixed(1)}%  dentro de ±5%: ${(100*ga.filter(x=>x<=5).length/ga.length).toFixed(0)}%`);
}
const sim=filas2.filter(f=>f.dEmp<15).map(f=>Math.abs(f.err)).sort((x,y)=>x-y);
console.log(`\n  => Si la referencia tiene un empinado PARECIDO al de la carrera objetivo:`);
console.log(`     error mediano ${med(sim).toFixed(1)}%  ·  dentro de ±3%: ${(100*sim.filter(x=>x<=3).length/sim.length).toFixed(0)}%  ·  dentro de ±5%: ${(100*sim.filter(x=>x<=5).length/sim.length).toFixed(0)}%`);


/* ===== BARRIDO DE LA CONSTANTE DE DESNIVEL =====
   No usa el motor: aísla la cuenta de km-esfuerzo + Riegel para poder barrer la
   constante sin tocar el archivo. Es como se llegó al 0,80 que hoy vive en
   T_RECORRIDO. Si algún día hay más carreras cargadas arriba, se vuelve a correr. */
const paresB = [];
for (const [atleta, carreras] of Object.entries(D))
  for (const a of carreras) for (const b of carreras) {
    if (a === b || dias(a[0], b[0]) > 430) continue;
    if (a[2] < 10 || b[2] < 10 || a[2] > 60 || b[2] > 60) continue;
    paresB.push([atleta, a, b]);
  }
const keB = (d, dp, c) => d + dp / 100 * c;
function evaluar(c, exp, sinAtleta) {
  const e = paresB.filter(([at]) => at !== sinAtleta)
    .map(([, a, b]) => Math.abs(100 * (hhmmss(a[4]) * Math.pow(keB(b[2], b[3], c) / keB(a[2], a[3], c), exp) / hhmmss(b[4]) - 1)));
  return { mediana: med([...e].sort((x, y) => x - y)),
           p5: 100 * e.filter(x => x <= 5).length / e.length,
           p10: 100 * e.filter(x => x <= 10).length / e.length };
}
console.log("\n\n=== BARRIDO · " + paresB.length + " predicciones, Riegel fijo en 1,05 ===\n");
console.log("   c      error mediano   dentro +-5%   dentro +-10%");
let best = null;
for (let c = 20; c <= 160; c += 10) {
  const r = evaluar(c / 100, 1.05);
  if (!best || r.mediana < best[1].mediana) best = [c / 100, r];
  console.log("  " + (c / 100).toFixed(2) + "       " + r.mediana.toFixed(2) + "%          "
    + r.p5.toFixed(0) + "%           " + r.p10.toFixed(0) + "%" + (c === 80 ? "  <- la que usa hoy" : ""));
}
console.log("\n  mejor: c=" + best[0].toFixed(2) + " con " + best[1].mediana.toFixed(2) + "%");
console.log("\nexponente de Riegel, con c en el mejor valor:");
for (const e of [1.00, 1.03, 1.05, 1.06, 1.08, 1.10]) {
  const r = evaluar(best[0], e);
  console.log("  exp " + e.toFixed(2) + "   " + r.mediana.toFixed(2) + "%   +-5%: " + r.p5.toFixed(0) + "%   +-10%: " + r.p10.toFixed(0) + "%");
}
console.log("\nrobustez (saco un atleta entero y recalculo el mejor c):");
const opt = Object.keys(D).map(fuera => {
  let bc = null;
  for (let c = 20; c <= 160; c += 5) {
    const m = evaluar(c / 100, 1.05, fuera).mediana;
    if (!bc || m < bc[1]) bc = [c / 100, m];
  }
  return bc[0];
});
console.log("  optimos: " + opt.map(x => x.toFixed(2)).join(", "));
console.log("  rango: " + Math.min(...opt).toFixed(2) + " a " + Math.max(...opt).toFixed(2));


/* ===== COBERTURA DE LA BANDA =====
   Una banda que dice "8 de cada 10" y contiene 6 es peor que no tener banda.
   Esto lo comprueba contra el mismo set. Si tocás bandaDe() en el HTML, corré
   esto y mirá que siga cerca de 80. */
let _dentro = 0, _tot = 0, _d50 = 0;
for (const [atleta, carreras] of Object.entries(D))
  for (const a of carreras) for (const b of carreras) {
    if (a === b || dias(a[0], b[0]) > 430) continue;
    if (a[2] < 10 || b[2] < 10 || a[2] > 60 || b[2] > 60) continue;
    const s = reset();
    Object.assign(s.race, { dist: b[2], dplus: b[3], tipo: 3,
      opts: { tipo: true, dneg: false, alt: false, obj: false } });
    ref({ time: a[4], dist: a[2], dplus: a[3], tipo: 3, opts: { tipo: true, alt: false, dneg: false } });
    const r = calc();
    if (!r.ok || !r.banda) continue;
    const e = Math.abs(r.totalSec / hhmmss(b[4]) - 1);
    _tot++; if (e <= r.banda.p80) _dentro++; if (e <= r.banda.p50) _d50++;
  }
console.log("\n\n=== COBERTURA DE LA BANDA (n=" + _tot + ") ===");
console.log("  dentro de la banda del 80 %: " + (100*_dentro/_tot).toFixed(0) + " %   (tiene que dar ~80)");
console.log("  dentro de la mitad probable: " + (100*_d50/_tot).toFixed(0) + " %   (tiene que dar ~50)");
