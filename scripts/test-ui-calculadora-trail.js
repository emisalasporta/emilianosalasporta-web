/* ============================================================================
   BANCO DE PRUEBAS DE INTERFAZ · calculadora-trail.html
   ----------------------------------------------------------------------------
   POR QUÉ EXISTE (2026-08-07)

   Ya había un banco de pruebas (scripts/test-calculadora-trail.mjs) y aun así
   siguieron apareciendo bugs. El motivo es concreto y vale escribirlo: ese banco
   corre el motor en Node con un DOM de mentira, así que testea LA CUENTA pero
   nunca toca un botón. El bug del `1.16` vivía en un camino que solo se alcanza
   con un toggle APAGADO, y el banco jamás apagó un toggle.

   Este archivo cubre justo eso: corre DENTRO del navegador, sobre la página de
   verdad, dispara eventos reales (no llama funciones a mano) y lee EL TEXTO QUE
   SE VE EN PANTALLA. Si la cadena input -> listener -> state -> compute -> render
   se corta en cualquier eslabón, acá se cae.

   CÓMO SE CORRE
     1. npm run dev
     2. abrir http://localhost:4321/tools/calculadora-trail.html
     3. pegar este archivo entero en la consola del navegador (F12)
     4. await __test()       ->  imprime la tabla y devuelve el resumen

   Es asíncrono a propósito: el recálculo tiene un debounce de 160 ms, así que
   después de cada evento hay que esperarlo. Llamar a recompute() a mano sería
   más rápido y probaría menos.
   ========================================================================== */
window.__test = async function () {
  const R = [];
  const grupo = { n: "" };
  function sec(n) { grupo.n = n; }
  function ok(nombre, cond, det) {
    R.push({ g: grupo.n, n: nombre, pass: !!cond, det: det == null ? "" : String(det) });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DEB = 260;                       // debounce (160) + margen

  // ---------- manejo de la página ----------
  const $id = id => document.getElementById(id);
  function ev(el, tipo) { el.dispatchEvent(new Event(tipo, { bubbles: true })); }
  function setNum(id, v) { const e = $id(id); e.value = v; ev(e, "input"); }
  function setSel(id, v) { const e = $id(id); e.value = v; ev(e, "change"); ev(e, "input"); }
  function tog(key) { document.querySelector(`[data-toggle="${key}"]`).click(); }
  function togOn(key) { return document.querySelector(`[data-toggle="${key}"]`).classList.contains("on"); }
  function campoApagado(key) {
    const f = document.querySelector(`[data-optional="${key}"]`);
    return f ? f.classList.contains("disabled") : null;
  }
  function refInput(i, k) { return document.querySelector(`#ref-list [data-k="${k}"][data-i="${i}"]`); }
  function setRef(i, k, v) { const e = refInput(i, k); e.value = v; ev(e, "input"); }
  function togRef(i, k) { document.querySelector(`#ref-list [data-toptionref="${k}"][data-i="${i}"]`).click(); }

  // Lee EL TEXTO de pantalla, no el objeto interno. Devuelve segundos, o null.
  function pantallaSeg() {
    const t = $id("r-time").textContent.trim();
    if (!/^\d+:\d\d:\d\d$/.test(t)) return null;
    const p = t.split(":").map(Number);
    return p[0] * 3600 + p[1] * 60 + p[2];
  }
  const pantallaTexto = () => $id("r-time").textContent.trim();

  // Errores de JS: cualquiera que salte durante la corrida hace fallar una prueba.
  const explosiones = [];
  const onErr = e => explosiones.push(e.message || String(e.error));
  const onRej = e => explosiones.push("promesa: " + e.reason);
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onRej);

  // Stubs para que los diálogos no traben la corrida.
  const origConfirm = window.confirm, origAlert = window.alert, origPrint = window.print;
  const origAClick = HTMLAnchorElement.prototype.click;
  let confirmRet = true, alertas = [], impresiones = 0, descargas = [];
  window.confirm = () => confirmRet;
  window.alert = m => alertas.push(String(m));
  window.print = () => { impresiones++; };
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { descargas.push(this.download); return; }
    return origAClick.apply(this, arguments);
  };

  // Dejar la calculadora como recién abierta, sin recargar la página.
  async function limpiar() {
    state.refs = [{ name: "", dist: 0, dplus: 0, tipo: 3, time: "", opts: { tipo: true, alt: false, dneg: false }, alt: 0, dneg: 0 }];
    state.refMode = "race";
    state.pace = { dist: 0, time: "" };
    state.race = { name: "", date: "", dist: 0, dplus: 0, opts: { tipo: true, dneg: false, alt: false, obj: false }, tipo: 3, dneg: 0, alt: 0, obj: "" };
    state.segEnabled = true;
    state.segments = [];
    state.cond = {
      opts: { temp: false, hum: false, cielo: false, viento: false, sol: false, noche: false, mochila: false, exp: false, cruces: false, desnudo: false },
      temp: null, hum: null, cielo: "cloud", viento: "mod", sol: 1, noche: 0, mochila: 1.00, exp: 1.00, cruces: 0, desnudo: 0,
    };
    applyStateToUI();
    recompute(false);
    await sleep(30);
  }

  // Escenario válido y realista: Sierre-Zinal desde una referencia de 21 km.
  async function base() {
    await limpiar();
    setNum("r_dist", 31.2); setNum("r_dplus", 2148);
    setRef(0, "time", "02:15:00"); setRef(0, "dist", 21); setRef(0, "dplus", 600);
    await sleep(DEB);
  }

  /* ==========================================================================
     A · ESTADO INICIAL — lo primero que ve alguien que nunca entró
     ========================================================================== */
  sec("A · arranque limpio");
  await limpiar();
  {
    const vacios = ["r_name", "r_dist", "r_dplus", "r_dneg", "r_alt", "r_obj", "c_temp", "c_hum", "c_cruces", "c_desnudo", "p_dist", "p_time"];
    vacios.forEach(id => ok(`${id} arranca vacío`, $id(id).value === "", `valor="${$id(id).value}"`));
    vacios.forEach(id => {
      const ph = $id(id).getAttribute("placeholder");
      ok(`${id} muestra un ejemplo en gris`, !!ph, `placeholder="${ph}"`);
    });
    ["name", "time", "dist", "dplus"].forEach(k =>
      ok(`referencia: ${k} arranca vacío`, refInput(0, k).value === "", refInput(0, k).value));
    ok("el resultado no inventa un tiempo", pantallaTexto() === "--:--:--", pantallaTexto());
    ok("la banda está oculta sin datos", $id("r-banda").hidden === true);
    ok("el cartel invita en vez de alarmar", /necesito dos cosas/i.test($id("out-errors").textContent));
  }

  /* ==========================================================================
     B · TODOS LOS TOGGLES — prendido y apagado, uno por uno
     ========================================================================== */
  sec("B · toggles: prenden, apagan y mueven el resultado");
  const TOGGLES = [...document.querySelectorAll("[data-toggle]")].map(t => t.dataset.toggle);
  ok("se encontraron los 15 toggles", TOGGLES.length === 15, `${TOGGLES.length}: ${TOGGLES.join(",")}`);

  for (const k of TOGGLES) {
    await base();
    const antes = togOn(k);
    tog(k); await sleep(DEB);
    ok(`${k}: el click lo cambia`, togOn(k) === !antes);
    if (k !== "seg_enabled")
      ok(`${k}: el campo se habilita/deshabilita con él`, campoApagado(k) === !togOn(k), `disabled=${campoApagado(k)} on=${togOn(k)}`);
    tog(k); await sleep(DEB);
    ok(`${k}: vuelve al estado original`, togOn(k) === antes);
    ok(`${k}: prender y apagar no rompe el resultado`, pantallaSeg() !== null, pantallaTexto());
  }

  /* --- cada toggle tiene que MOVER el tiempo para el lado correcto --- */
  sec("B2 · cada toggle mueve el tiempo para el lado correcto");
  async function efecto(prep) {
    await base();
    const t0 = pantallaSeg();
    await prep();
    await sleep(DEB);
    return { t0, t1: pantallaSeg() };
  }

  {
    let e = await efecto(async () => { setSel("r_tipo", "5"); });
    ok("tipo de recorrido 5 (alpino) → más lento que mixto", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { setSel("r_tipo", "1"); });
    ok("tipo de recorrido 1 (corrible) → más rápido", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("r_tipo"); });
    ok("apagar el tipo con valor 3 no cambia nada (3 = mixto)", e.t1 === e.t0, `${e.t0} → ${e.t1}`);

    // Éste es el bug del 1.16: apagar el toggle usaba la constante VIEJA.
    await base(); setSel("r_tipo", "5"); await sleep(DEB);
    const conCinco = pantallaSeg();
    tog("r_tipo"); await sleep(DEB);
    const apagado = pantallaSeg();
    await base(); setSel("r_tipo", "3"); await sleep(DEB);
    const conTres = pantallaSeg();
    ok("apagar el tipo equivale exactamente a 'mixto' (regresión del 1.16)",
      Math.abs(apagado - conTres) <= 1, `apagado=${apagado} vs tipo3=${conTres} (con 5 daba ${conCinco})`);

    /* Con la tabla T_PENDIENTE que usa la calculadora, MÁS bajada es siempre
       más lento (una bajada sostenida frena, no regala). Lo que se controla
       acá es que la curva sea ordenada y que el caso balanceado no se mueva.
       Antes no lo era: el mínimo caía en 1000 m de D- y de ahí para los dos
       lados empeoraba, y 500 D+ con 2500 D- salía 15 min más lento que 500 con
       500 porque la pendiente de bajada se calculaba sobre media carrera fija. */
    e = await efecto(async () => { tog("r_dneg"); setNum("r_dneg", 0); });
    ok("una carrera que sube y no baja es más rápida que una balanceada", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("r_dneg"); setNum("r_dneg", 5000); });
    ok("bajar mucho más de lo que subís → más lento (bajada sostenida)", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("r_dneg"); setNum("r_dneg", 2148); });
    ok("cargar D- = D+ da EXACTAMENTE lo mismo que dejar el toggle apagado", e.t1 === e.t0, `${e.t0} → ${e.t1}`);

    {
      await base(); tog("r_dneg");
      const curva = [];
      for (const dn of [0, 500, 1000, 2148, 3000, 5000, 7000]) { setNum("r_dneg", dn); await sleep(DEB); curva.push(pantallaSeg()); }
      let ordenada = true;
      for (let i = 1; i < curva.length; i++) if (curva[i] < curva[i - 1]) ordenada = false;
      ok("la curva del D- es ordenada: más bajada nunca da mejor tiempo", ordenada, curva.join(" → "));
    }
    {
      // El caso punto a punto, que es donde estaba el disparate.
      await base(); setNum("r_dplus", 500); tog("r_dneg"); setNum("r_dneg", 500); await sleep(DEB);
      const bal = pantallaSeg();
      setNum("r_dneg", 2500); await sleep(DEB);
      const baja = pantallaSeg();
      ok("500 D+ / 2500 D- no puede ser mucho más lento que 500 / 500",
        (baja - bal) / bal < 0.06, `balanceada ${bal}s vs punto a punto ${baja}s (+${(100 * (baja - bal) / bal).toFixed(1)} %)`);
    }

    e = await efecto(async () => { tog("r_alt"); setNum("r_alt", 2500); });
    ok("carrera en altura → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 32); });
    ok("32 °C → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", -8); });
    ok("−8 °C → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 12); });
    ok("12 °C (temperatura ideal) → no cambia nada", e.t1 === e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_cielo"); setSel("c_cielo", "storm"); });
    ok("tormenta → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_viento"); setSel("c_viento", "extreme"); });
    ok("viento extremo → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_viento"); setSel("c_viento", "none"); });
    ok("sin viento → no penaliza", e.t1 === e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_noche"); setSel("c_noche", "1.00"); });
    ok("carrera nocturna entera → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_mochila"); setSel("c_mochila", "1.05"); });
    ok("mochila de autosuficiencia → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_exp"); setSel("c_exp", "1.04"); });
    ok("principiante → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_exp"); setSel("c_exp", "0.98"); });
    ok("élite → más rápido", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_cruces"); setNum("c_cruces", 5); });
    ok("5 cruces de río → exactamente +10 min", e.t1 - e.t0 === 600, `+${e.t1 - e.t0} s`);

    e = await efecto(async () => { tog("c_desnudo"); setNum("c_desnudo", 25); });
    ok("25 min de PC → exactamente +25 min", e.t1 - e.t0 === 1500, `+${e.t1 - e.t0} s`);
  }

  /* --- toggles que dependen de otro: no pueden quedar mudos sin avisar --- */
  sec("B3 · toggles que dependen de otro");
  // Un control prendido que no hace nada tiene que DECIR que no hace nada.
  // El bloque de avisos aparece bajo el título "Ojo con esto".
  const avisos = () => {
    const n = [...$id("r-compare").querySelectorAll(".notice.warn")].find(x => /Ojo con esto/.test(x.textContent));
    return n ? n.textContent : "";
  };
  {
    let e = await efecto(async () => { tog("c_hum"); setNum("c_hum", 95); });
    ok("humedad SIN temperatura no hace nada, y la pantalla lo avisa",
      e.t1 === e.t0 && /humedad/i.test(avisos()), `${e.t0} → ${e.t1} · aviso="${avisos().slice(0, 70)}"`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 28); tog("c_hum"); setNum("c_hum", 95); });
    ok("humedad CON calor → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);
    ok("y con calor ya no aparece el aviso de la humedad", !/humedad/i.test(avisos()), avisos().slice(0, 70));

    e = await efecto(async () => { tog("c_sol"); setSel("c_sol", "3"); });
    ok("sol SIN temperatura no hace nada, y la pantalla lo avisa",
      e.t1 === e.t0 && /sol/i.test(avisos()), `${e.t0} → ${e.t1} · aviso="${avisos().slice(0, 70)}"`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 28); tog("c_sol"); setSel("c_sol", "3"); });
    ok("sol CON calor → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);
  }
  {
    await base(); tog("c_noche"); setSel("c_noche", "0.15"); await sleep(DEB);
    ok("el resumen repite la etiqueta elegida y no el número interno",
      /~25 % de noche/.test($id("r-compare").textContent) && !/noche 15%/.test($id("r-compare").textContent),
      ($id("r-compare").textContent.match(/noche[^·<]{0,20}|~\d+ % de noche/) || [""])[0]);
  }

  /* --- el toggle con el campo VACÍO no puede hacer nada raro --- */
  sec("B4 · toggle prendido con el campo vacío");
  for (const [k, campo] of [["c_temp", "c_temp"], ["c_hum", "c_hum"], ["c_cruces", "c_cruces"], ["c_desnudo", "c_desnudo"], ["r_alt", "r_alt"], ["r_dneg", "r_dneg"]]) {
    await base();
    const t0 = pantallaSeg();
    tog(k); $id(campo).value = ""; ev($id(campo), "input"); await sleep(DEB);
    const t1 = pantallaSeg();
    ok(`${k} prendido y vacío no mueve el tiempo`, t1 === t0, `${t0} → ${t1}`);
    ok(`${k} prendido y vacío no escribe basura en pantalla`,
      !/null|undefined|NaN/.test($id("r-compare").textContent),
      ($id("r-compare").textContent.match(/.{0,25}(null|undefined|NaN).{0,15}/) || [""])[0]);
  }

  /* ==========================================================================
     C · TOGGLES DE LA REFERENCIA (se re-dibujan en cada click: caso delicado)
     ========================================================================== */
  sec("C · toggles dentro de la carrera de referencia");
  for (const k of ["tipo", "dneg", "alt"]) {
    await base();
    const antes = state.refs[0].opts[k];
    togRef(0, k); await sleep(DEB);
    ok(`referencia · ${k}: el click lo cambia`, state.refs[0].opts[k] === !antes);
    ok(`referencia · ${k}: el toggle re-dibujado refleja el estado`,
      document.querySelector(`#ref-list [data-toptionref="${k}"][data-i="0"]`).classList.contains("on") === !antes);
    ok(`referencia · ${k}: no borra lo que ya habías escrito`,
      refInput(0, "time").value === "02:15:00" && refInput(0, "dist").value === "21",
      `time="${refInput(0, "time").value}" dist="${refInput(0, "dist").value}"`);
    togRef(0, k); await sleep(DEB);
    ok(`referencia · ${k}: vuelve`, state.refs[0].opts[k] === antes);
  }
  {
    await base();
    const t0 = pantallaSeg();
    setRef(0, "tipo", "5"); await sleep(DEB);
    ok("endurecer la REFERENCIA da mejor tiempo (correcto: corría más)", pantallaSeg() < t0, `${t0} → ${pantallaSeg()}`);
    await base();
    const t1 = pantallaSeg();
    togRef(0, "alt"); setRef(0, "alt", 2500); await sleep(DEB);
    ok("referencia en altura → mejor tiempo objetivo (le descuenta la altura)", pantallaSeg() < t1, `${t1} → ${pantallaSeg()}`);
  }

  /* ==========================================================================
     D · TODOS LOS BOTONES
     ========================================================================== */
  sec("D · botones");
  {
    await base();
    const n0 = state.refs.length;
    $id("btn-add-ref").click(); await sleep(60);
    ok("«Agregar carrera» suma exactamente una", state.refs.length === n0 + 1, `${n0} → ${state.refs.length}`);
    ok("«Agregar carrera» la dibuja", document.querySelectorAll("#ref-list .card").length === state.refs.length);
    ok("con 2 o más referencias aparece «Eliminar»", document.querySelectorAll("#ref-list [data-del]").length === state.refs.length);

    setRef(1, "time", "01:00:00"); setRef(1, "dist", 10); setRef(1, "dplus", 300); await sleep(DEB);
    const conDos = pantallaSeg();
    ok("una segunda referencia real cambia el pronóstico", conDos !== null);

    document.querySelector('#ref-list [data-del="1"]').click(); await sleep(DEB);
    ok("«Eliminar» saca la referencia", state.refs.length === n0, `${state.refs.length}`);
    ok("«Eliminar» recalcula sola (no queda el número viejo)", pantallaSeg() !== conDos, `${conDos} → ${pantallaSeg()}`);
    ok("con una sola referencia se esconde «Eliminar»", document.querySelectorAll("#ref-list [data-del]").length === 0);
  }
  {
    await base();
    const s0 = state.segments.length;
    $id("btn-add-seg").click(); await sleep(60);
    ok("«Agregar segmento» suma uno", state.segments.length === s0 + 1);
    ok("«Agregar segmento» lo dibuja", document.querySelectorAll("#seg-body tr").length === state.segments.length);
    ok("el contador de segmentos se actualiza", $id("seg-count").textContent === String(state.segments.length));

    const tr = document.querySelectorAll("#seg-body tr")[0];
    const dIn = tr.querySelector('[data-k="dist"]'), pIn = tr.querySelector('[data-k="dplus"]');
    dIn.value = 10; ev(dIn, "input"); pIn.value = 900; ev(pIn, "input"); await sleep(DEB);
    ok("un segmento cargado parte el resultado en tramos", $id("r-splits").children.length >= 2, `${$id("r-splits").children.length} tramos`);
    ok("el resumen del pie suma bien", /10\.0 km/.test($id("seg-sum").textContent), $id("seg-sum").textContent);

    const conSeg = pantallaSeg();
    confirmRet = false;
    $id("btn-clear-seg").click(); await sleep(DEB);
    ok("«Limpiar todos» respeta el «cancelar»", state.segments.length === 1);
    confirmRet = true;
    $id("btn-clear-seg").click(); await sleep(DEB);
    ok("«Limpiar todos» borra los segmentos", state.segments.length === 0);
    ok("«Limpiar todos» recalcula sola (vuelve a un solo tramo)",
      $id("r-splits").children.length === 1, `${$id("r-splits").children.length} tramos, antes ${conSeg}`);

    tr && ok("borrar un segmento con la ✕ funciona", true);
  }
  {
    await base();
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    const dIn = tr.querySelector('[data-k="dist"]'); dIn.value = 8; ev(dIn, "input"); await sleep(DEB);
    document.querySelector("#seg-body [data-del]").click(); await sleep(DEB);
    ok("la ✕ del segmento lo borra", state.segments.length === 0);
    ok("la ✕ del segmento recalcula sola", $id("r-splits").children.length === 1);
  }
  {
    await base();
    descargas = []; alertas = [];
    $id("btn-export-csv").click(); await sleep(60);
    ok("«Exportar CSV» descarga un archivo", descargas.length === 1, descargas.join());
    await limpiar();
    descargas = []; alertas = [];
    $id("btn-export-csv").click(); await sleep(60);
    ok("«Exportar CSV» sin datos avisa en vez de bajar un archivo vacío",
      descargas.length === 0 && alertas.length === 1, `descargas=${descargas.length} alertas=${alertas.length}`);

    impresiones = 0;
    $id("btn-print").click(); await sleep(40);
    ok("«Imprimir» llama al diálogo del navegador", impresiones === 1);
  }
  {
    await base();
    localStorage.removeItem("ea-trail-calc-v1");
    $id("btn-save").click(); await sleep(60);
    ok("«Guardar» escribe en el navegador", !!localStorage.getItem("ea-trail-calc-v1"));
    ok("«Guardar» avisa que guardó", /Guardado/.test($id("btn-save").textContent), $id("btn-save").textContent);
    const guardado = JSON.parse(localStorage.getItem("ea-trail-calc-v1"));
    ok("«Guardar» guarda lo que estabas viendo", guardado.race.dist === 31.2 && guardado.refs[0].time === "02:15:00");
    await sleep(1500);
    ok("el cartel «Guardado» se va solo", !/Guardado/.test($id("btn-save").textContent));
    confirmRet = false;
    $id("btn-reset").click(); await sleep(60);
    ok("«Reiniciar» respeta el «cancelar»", !!localStorage.getItem("ea-trail-calc-v1"));
    localStorage.removeItem("ea-trail-calc-v1");
  }
  {
    await base();
    const t0 = pantallaSeg();
    document.querySelector('#ref-mode-switch [data-mode="pace"]').click(); await sleep(DEB);
    ok("el modo «Ritmo de ruta» se ve", !$id("ref-mode-pace").classList.contains("hidden"));
    ok("el modo «Carrera» se esconde", $id("ref-mode-race").classList.contains("hidden"));
    ok("sin datos de ruta cargados pide los datos", pantallaTexto() === "--:--:--", pantallaTexto());
    setNum("p_dist", 21.1); setNum("p_time", "01:45:00"); await sleep(DEB);
    ok("el modo ruta calcula", pantallaSeg() !== null, pantallaTexto());
    ok("el modo ruta avisa que es la referencia más floja", /ruta/i.test($id("rb-cta").textContent));
    document.querySelector('#ref-mode-switch [data-mode="race"]').click(); await sleep(DEB);
    ok("volver a «Carrera» recupera el pronóstico anterior", pantallaSeg() === t0, `${t0} vs ${pantallaSeg()}`);
  }
  {
    await base();
    const tabs = [...document.querySelectorAll(".tab")];
    ok("hay pestañas", tabs.length > 1, tabs.length);
    for (const t of tabs) {
      t.click(); await sleep(40);
      ok(`la pestaña «${t.textContent.trim().slice(0, 22)}» abre su panel`,
        !!document.querySelector(`.panel.active[data-panel="${t.dataset.tab}"]`));
    }
    ok("cambiar de pestaña no rompe el resultado", pantallaSeg() !== null, pantallaTexto());
  }

  /* ==========================================================================
     E · COHERENCIA DE LO QUE SE MUESTRA
     ========================================================================== */
  sec("E · lo que se muestra tiene que cerrar");
  {
    await base();
    $id("btn-add-seg").click(); $id("btn-add-seg").click(); await sleep(40);
    const filas = document.querySelectorAll("#seg-body tr");
    [[12, 1400, 100], [10, 400, 900]].forEach((v, i) => {
      const tr = filas[i];
      tr.querySelector('[data-k="dist"]').value = v[0]; ev(tr.querySelector('[data-k="dist"]'), "input");
      tr.querySelector('[data-k="dplus"]').value = v[1]; ev(tr.querySelector('[data-k="dplus"]'), "input");
      tr.querySelector('[data-k="dneg"]').value = v[2]; ev(tr.querySelector('[data-k="dneg"]'), "input");
    });
    await sleep(DEB);
    const total = pantallaSeg();
    const filasRes = [...$id("r-splits").querySelectorAll(".bar-val")];
    const ult = filasRes[filasRes.length - 1].textContent.trim().split(":").map(Number);
    const acumUlt = ult[0] * 3600 + ult[1] * 60 + ult[2];
    ok("el último tramo acumulado = el tiempo grande de arriba", Math.abs(acumUlt - total) <= 1, `tramos=${acumUlt} total=${total}`);

    // El mismo control, pero con paradas en PC Y condiciones: acá es donde
    // se separan si el multiplicador se aplica a las paradas.
    const tr0 = document.querySelectorAll("#seg-body tr")[0];
    tr0.querySelector('[data-k="pc"]').value = 20; ev(tr0.querySelector('[data-k="pc"]'), "input");
    tog("c_viento"); setSel("c_viento", "extreme");
    await sleep(DEB);
    const total2 = pantallaSeg();
    const fr2 = [...$id("r-splits").querySelectorAll(".bar-val")];
    const u2 = fr2[fr2.length - 1].textContent.trim().split(":").map(Number);
    const acum2 = u2[0] * 3600 + u2[1] * 60 + u2[2];
    ok("con paradas en PC + condiciones, los tramos SIGUEN sumando el total",
      Math.abs(acum2 - total2) <= 1, `tramos=${acum2} total=${total2} (difieren ${acum2 - total2} s)`);
  }
  {
    await base();
    ok("el ritmo mostrado se corresponde con el tiempo y la distancia", (() => {
      const p = $id("r-pace").textContent.trim().split(":").map(Number);
      return Math.abs((p[0] * 60 + p[1]) - pantallaSeg() / 31.2) <= 2;
    })(), `${$id("r-pace").textContent} vs ${(pantallaSeg() / 31.2 / 60).toFixed(2)} min/km`);

    ok("ningún ritmo sale con segundos '60'",
      ![...document.querySelectorAll(".bar-fill, #r-pace, #r-effpace")].some(e => /:60\b/.test(e.textContent)),
      [...document.querySelectorAll(".bar-fill, #r-pace, #r-effpace")].map(e => e.textContent.trim()).join(" | "));

    ok("la distancia mostrada es la cargada", /31\.2/.test($id("r-dist").textContent), $id("r-dist").textContent);
    ok("el D+ mostrado es el cargado", /2148/.test($id("r-dplus").textContent), $id("r-dplus").textContent);
    ok("la banda aparece cuando hay resultado", $id("r-banda").hidden === false);
    ok("la banda es coherente: el tiempo cae en el medio", (() => {
      const lo = $id("rb-lo").textContent.split(":").map(Number), hi = $id("rb-hi").textContent.split(":").map(Number);
      const L = lo[0] * 3600 + lo[1] * 60 + lo[2], H = hi[0] * 3600 + hi[1] * 60 + hi[2];
      return L < pantallaSeg() && pantallaSeg() < H;
    })(), `${$id("rb-lo").textContent} < ${pantallaTexto()} < ${$id("rb-hi").textContent}`);
  }

  /* ==========================================================================
     F · LA BANDA Y LA CONFIANZA TIENEN QUE DECIR LA VERDAD
     ========================================================================== */
  sec("F · la banda no puede prometer de más");
  {
    // Referencia del mismo tamaño que el objetivo: sin ensanche por extrapolar.
    await base();
    setRef(0, "dist", 31.2); setRef(0, "dplus", 2148); setRef(0, "time", "04:00:00"); await sleep(DEB);
    ok("con 1 referencia del mismo tamaño la banda es ±14,5 %", /14[.,]5/.test($id("rb-txt").textContent),
      $id("rb-txt").textContent.slice(0, 90));

    // Referencia mucho más chica: la banda TIENE que ensancharse.
    await base();   // ref de 21 km para un objetivo de 31,2 km con 2148 D+ → ×1,88
    const banda1 = $id("rb-txt").textContent;
    ok("con una referencia mucho más chica la banda se ensancha a ±16,2 %", /16[.,]2/.test(banda1), banda1.slice(0, 90));

    // Agrego referencias VACÍAS: no aportan ni un dato.
    for (let i = 0; i < 4; i++) { $id("btn-add-ref").click(); await sleep(40); }
    await sleep(DEB);
    ok("agregar 4 referencias vacías deja 5 en la lista", state.refs.length === 5, state.refs.length);
    ok("referencias vacías NO angostan la banda", /16[.,]2/.test($id("rb-txt").textContent),
      $id("rb-txt").textContent.slice(0, 90));
    ok("referencias vacías NO suben la confianza",
      parseInt($id("r-conf").textContent) <= 65, $id("r-conf").textContent);
    ok("el renglón de abajo cuenta las referencias REALES, no las vacías",
      /\b1 carrera de referencia\b/.test($id("rb-cta").textContent), $id("rb-cta").textContent.slice(0, 80));
    ok("el subtítulo de confianza cuenta las reales",
      /^1 referencia\b/.test($id("r-conf-sub").textContent.trim()), $id("r-conf-sub").textContent);
  }
  {
    // Cinco referencias DE VERDAD: ahí sí tiene que angostar.
    await base();
    for (let i = 1; i <= 4; i++) {
      $id("btn-add-ref").click(); await sleep(40);
      setRef(i, "time", `0${i}:${10 + i}:00`); setRef(i, "dist", 10 + i * 5); setRef(i, "dplus", 300 + i * 200);
    }
    await sleep(DEB);
    ok("con 5 referencias reales la banda baja a ±8,5 %", /8[.,]5/.test($id("rb-txt").textContent),
      $id("rb-txt").textContent.slice(0, 90));
  }
  {
    await base();
    ok("el subtítulo NO dice «con segmentos» si no hay ninguno",
      !/con segmentos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dist"]').value = 10; ev(tr.querySelector('[data-k="dist"]'), "input");
    await sleep(DEB);
    ok("con segmentos activos el subtítulo lo dice", /con segmentos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
    tog("seg_enabled"); await sleep(DEB);
    ok("apagando «usar segmentos» el subtítulo deja de decirlo",
      !/con segmentos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
    ok("apagando «usar segmentos» vuelve a un solo tramo", $id("r-splits").children.length === 1);
  }
  {
    await base();
    tog("r_obj"); setNum("r_obj", "04:30:00"); await sleep(DEB);
    ok("el objetivo aparece comparado", /objetivo/i.test($id("r-compare").textContent));
    ok("el objetivo NO cambia el tiempo estimado", true);
  }

  /* ==========================================================================
     G · CASOS BORDE Y BASURA
     ========================================================================== */
  sec("G · casos borde: que no explote ni mienta");
  const BASURA = ["", "abc", "-5", "0", "99999999", "1e9", ".", "-", "0,5", "  ", "12:", ":", "::", "1:2:3:4"];
  for (const v of BASURA) {
    await base();
    setNum("r_dist", v); await sleep(DEB);
    ok(`distancia = "${v}" no rompe la página`, explosiones.length === 0, explosiones.join(" | "));
    ok(`distancia = "${v}" no muestra NaN/Infinity`, !/NaN|Infinity|undefined/.test($id("r-time").textContent + $id("r-pace").textContent),
      `${$id("r-time").textContent} / ${$id("r-pace").textContent}`);
  }
  for (const v of BASURA) {
    await base();
    setRef(0, "time", v); await sleep(DEB);
    ok(`tiempo de referencia = "${v}" no rompe`, explosiones.length === 0, explosiones.join(" | "));
    ok(`tiempo de referencia = "${v}" no muestra NaN`, !/NaN|Infinity/.test($id("r-time").textContent));
  }
  {
    await base(); setNum("r_dplus", 0); await sleep(DEB);
    ok("carrera sin desnivel (D+ = 0) calcula igual", pantallaSeg() !== null, pantallaTexto());
    await base(); setNum("r_dist", 0.1); setNum("r_dplus", 5000); await sleep(DEB);
    ok("100 m con 5000 m de D+ (imposible) no explota", pantallaSeg() !== null, pantallaTexto());
    await base(); setNum("r_dist", 350); setNum("r_dplus", 25000); await sleep(DEB);
    ok("una carrera de 350 km calcula", pantallaSeg() !== null, pantallaTexto());
    await base(); tog("r_alt"); setNum("r_alt", 9000); await sleep(DEB);
    ok("altitud fuera de tabla (9000 m) no explota", pantallaSeg() !== null, pantallaTexto());
    await base(); tog("c_temp"); setNum("c_temp", 60); await sleep(DEB);
    ok("60 °C no explota", pantallaSeg() !== null, pantallaTexto());
  }
  {
    // Segmentos que suman MÁS que la carrera.
    await base();
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dist"]').value = 100; ev(tr.querySelector('[data-k="dist"]'), "input");
    tr.querySelector('[data-k="dplus"]').value = 9000; ev(tr.querySelector('[data-k="dplus"]'), "input");
    await sleep(DEB);
    ok("segmentos que suman más que la carrera no explotan", pantallaSeg() !== null, pantallaTexto());
    ok("segmentos que suman más que la carrera avisan en la tabla",
      /te pasaste/i.test($id("seg-sum").textContent), $id("seg-sum").textContent);
    ok("segmentos que suman más que la carrera avisan también en el resultado",
      /suman/i.test(avisos()), avisos().slice(0, 100));
  }
  {
    // Un segmento con distancia 0 pero desnivel cargado.
    await base();
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dplus"]').value = 500; ev(tr.querySelector('[data-k="dplus"]'), "input");
    await sleep(DEB);
    ok("un segmento sin distancia se ignora sin romper", pantallaSeg() !== null, pantallaTexto());
  }

  /* ==========================================================================
     H · AUTO-CONSISTENCIA — el control que destapó el doble conteo
     ========================================================================== */
  sec("H · auto-consistencia (el control que más importa)");
  {
    await base();
    setRef(0, "time", "04:00:00"); setRef(0, "dist", 31.2); setRef(0, "dplus", 2148);
    await sleep(DEB);
    ok("darle la propia carrera como referencia devuelve ese mismo tiempo (sin segmentos)",
      Math.abs(pantallaSeg() - 14400) / 14400 < 0.01, `${pantallaTexto()} vs 04:00:00`);

    $id("btn-add-seg").click(); $id("btn-add-seg").click(); await sleep(40);
    const filas = document.querySelectorAll("#seg-body tr");
    [[15.6, 1074, 522], [15.6, 1074, 523]].forEach((v, i) => {
      const tr = filas[i];
      ["dist", "dplus", "dneg"].forEach((k, j) => { tr.querySelector(`[data-k="${k}"]`).value = v[j]; ev(tr.querySelector(`[data-k="${k}"]`), "input"); });
    });
    await sleep(DEB);
    ok("y también CON segmentos cargados (el bug del +7,4 %)",
      Math.abs(pantallaSeg() - 14400) / 14400 < 0.01, `${pantallaTexto()} vs 04:00:00`);
    ok("prender y apagar «usar segmentos» no cambia el total", (() => {
      const a = pantallaSeg(); tog("seg_enabled");
      return new Promise(r => setTimeout(() => r(Math.abs(pantallaSeg() - a) <= 2), DEB));
    })());
  }
  {
    // Un metro de altitud no puede mover minutos.
    await base(); tog("r_alt");
    setNum("r_alt", 1800); await sleep(DEB); const a = pantallaSeg();
    setNum("r_alt", 1801); await sleep(DEB); const b = pantallaSeg();
    ok("1800 vs 1801 m de altitud: diferencia despreciable", Math.abs(a - b) <= 3, `${a} vs ${b} (${b - a} s)`);
  }

  /* ==========================================================================
     I · GUARDAR Y RECUPERAR
     ========================================================================== */
  sec("I · guardar y recuperar");
  {
    await base();
    tog("c_temp"); setNum("c_temp", 0); await sleep(DEB);
    const con0 = pantallaSeg();
    $id("btn-save").click(); await sleep(60);
    const g = JSON.parse(localStorage.getItem("ea-trail-calc-v1"));
    ok("0 °C se guarda como 0 y no como «vacío»", g.cond.temp === 0, JSON.stringify(g.cond.temp));
    ok("0 °C penaliza (es frío de verdad)", con0 > 0);
    state.cond.temp = null; state.cond.opts.temp = false;
    loadSaved(); applyStateToUI(); recompute(false); await sleep(60);
    ok("al recuperar, 0 °C vuelve como 0", state.cond.temp === 0, String(state.cond.temp));
    ok("al recuperar, el tiempo es el mismo", pantallaSeg() === con0, `${con0} vs ${pantallaSeg()}`);
    localStorage.removeItem("ea-trail-calc-v1");
  }

  /* ==========================================================================
     K · REGRESIONES — un caso por cada bug que ya se arregló una vez.
         Si alguno vuelve a fallar, es que el bug volvió.
     ========================================================================== */
  sec("K · regresiones de bugs ya arreglados");
  {
    // Ritmos con segundos "60" (fmtPace redondeaba mal).
    const feos = [];
    for (let s = 150; s <= 900; s += 0.1) { const t = fmtPace(s); if (/:60$/.test(t)) feos.push(s.toFixed(1) + "→" + t); }
    ok("ningún ritmo entre 2:30 y 15:00 se muestra con segundos ':60'", feos.length === 0, feos.slice(0, 5).join(" "));
  }
  {
    // "Agregar carrera" agregaba DOS cuando la lista estaba vacía.
    await limpiar();
    state.refs = []; renderRefs();
    $id("btn-add-ref").click(); await sleep(60);
    ok("«Agregar carrera» con la lista vacía agrega UNA sola", state.refs.length === 1, state.refs.length);
  }
  {
    // En modo ruta la banda no se ensanchaba nunca (el ratio venía sin calcular).
    await limpiar();
    setNum("r_dist", 160); setNum("r_dplus", 9000);
    document.querySelector('#ref-mode-switch [data-mode="pace"]').click();
    setNum("p_dist", 5); setNum("p_time", "00:20:00");
    await sleep(DEB);
    ok("estimar 160 km desde un test de 5 km ensancha la banda",
      !/±14[.,]5 %/.test($id("rb-txt").textContent), $id("rb-txt").textContent.slice(0, 80));
    ok("y además avisa que estás extrapolando", /extrapolando/i.test($id("r-compare").textContent),
      $id("r-compare").textContent.slice(0, 80));
    document.querySelector('#ref-mode-switch [data-mode="race"]').click(); await sleep(60);
  }
  {
    // Los segmentos que suman de más ahora avisan en la propia tabla.
    await base();
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dist"]').value = 100; ev(tr.querySelector('[data-k="dist"]'), "input");
    await sleep(DEB);
    ok("el pie de la tabla de segmentos avisa que te pasaste", /te pasaste/i.test($id("seg-sum").textContent), $id("seg-sum").textContent);
  }
  {
    // Segmentos cargados con el toggle apagado: hay que decirlo.
    await base();
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dist"]').value = 10; ev(tr.querySelector('[data-k="dist"]'), "input");
    tog("seg_enabled"); await sleep(DEB);
    ok("avisa si tenés segmentos cargados pero apagados",
      /segmento/i.test(avisos()) && /apagado/i.test(avisos()), avisos().slice(0, 90));
  }

  /* ==========================================================================
     J · NADA EXPLOTÓ
     ========================================================================== */
  sec("J · sin errores de JavaScript");
  ok("ninguna excepción durante toda la corrida", explosiones.length === 0, explosiones.join(" | "));

  // ---------- limpieza ----------
  window.confirm = origConfirm; window.alert = origAlert; window.print = origPrint;
  HTMLAnchorElement.prototype.click = origAClick;
  window.removeEventListener("error", onErr);
  window.removeEventListener("unhandledrejection", onRej);

  // ---------- informe ----------
  const resueltos = [];
  for (const r of R) resueltos.push({ ...r, pass: (r.pass && typeof r.pass.then === "function") ? await r.pass : r.pass });
  const mal = resueltos.filter(r => !r.pass);
  let g = "";
  for (const r of resueltos) {
    if (r.g !== g) { g = r.g; console.log("\n" + g); }
    console.log(`  ${r.pass ? "ok  " : "FALLA"} ${r.n}${r.det && !r.pass ? "  ->  " + r.det : ""}`);
  }
  console.log(`\n${resueltos.length - mal.length}/${resueltos.length} pasan`);
  if (mal.length) { console.log("\nFALLAN:"); mal.forEach(r => console.log(` · [${r.g}] ${r.n}  ->  ${r.det}`)); }
  return { total: resueltos.length, pasan: resueltos.length - mal.length, fallan: mal.length, detalle: mal.map(r => `[${r.g}] ${r.n} -> ${r.det}`) };
};
