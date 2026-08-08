/* ============================================================================
   BANCO DE PRUEBAS DE INTERFAZ · calculadora-calle.html
   ----------------------------------------------------------------------------
   Hermano de test-ui-calculadora-trail.js. Misma idea y mismo motivo: corre
   DENTRO del navegador, sobre la página de verdad, dispara eventos reales y
   lee EL TEXTO QUE SE VE EN PANTALLA, no las variables internas.

   El motor de esta calculadora es distinto al de trail: en vez de km-esfuerzo
   y Riegel usa VDOT (Daniels) y el costo energético de Minetti para la
   pendiente. Pero los BOTONES son casi los mismos, y los bugs de interfaz que
   aparecieron en trail son de la clase que no depende del motor: campos vacíos
   que valen 0, toggles que no hacen nada y no lo dicen, botones que no
   recalculan, y tramos que no suman el total.

   CÓMO SE CORRE
     1. npm run dev
     2. abrir http://localhost:4321/tools/calculadora-calle.html
     3. pegar este archivo entero en la consola (F12)
     4. await __test()
   ========================================================================== */
window.__test = async function () {
  const R = [];
  const grupo = { n: "" };
  function sec(n) { grupo.n = n; }
  function ok(nombre, cond, det) { R.push({ g: grupo.n, n: nombre, pass: !!cond, det: det == null ? "" : String(det) }); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DEB = 260;

  const $id = id => document.getElementById(id);
  function ev(el, tipo) { el.dispatchEvent(new Event(tipo, { bubbles: true })); }
  function setNum(id, v) { const e = $id(id); e.value = v; ev(e, "input"); }
  function setSel(id, v) { const e = $id(id); e.value = v; ev(e, "change"); ev(e, "input"); }
  function tog(key) { document.querySelector(`[data-toggle="${key}"]`).click(); }
  function togOn(key) { return document.querySelector(`[data-toggle="${key}"]`).classList.contains("on"); }
  function campoApagado(key) { const f = document.querySelector(`[data-optional="${key}"]`); return f ? f.classList.contains("disabled") : null; }
  function refInput(i, k) { return document.querySelector(`#ref-list [data-k="${k}"][data-i="${i}"]`); }
  function setRef(i, k, v) { const e = refInput(i, k); e.value = v; ev(e, "input"); }

  function pantallaSeg() {
    const t = $id("r-time").textContent.trim();
    if (!/^\d+:\d\d:\d\d$/.test(t)) return null;
    const p = t.split(":").map(Number);
    return p[0] * 3600 + p[1] * 60 + p[2];
  }
  const pantallaTexto = () => $id("r-time").textContent.trim();
  const avisos = () => {
    const n = [...$id("r-compare").querySelectorAll(".notice.warn")].find(x => /Ojo con esto/.test(x.textContent));
    return n ? n.textContent : "";
  };

  const explosiones = [];
  const onErr = e => explosiones.push(e.message || String(e.error));
  const onRej = e => explosiones.push("promesa: " + e.reason);
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onRej);

  const origConfirm = window.confirm, origAlert = window.alert, origPrint = window.print;
  const origAClick = HTMLAnchorElement.prototype.click;
  let confirmRet = true, alertas = [], impresiones = 0, descargas = [];
  window.confirm = () => confirmRet;
  window.alert = m => alertas.push(String(m));
  window.print = () => { impresiones++; };
  HTMLAnchorElement.prototype.click = function () { if (this.download) { descargas.push(this.download); return; } return origAClick.apply(this, arguments); };

  async function limpiar() {
    state.refMode = "race";
    state.refs = [{ name: "", dist: 0, time: "", opts: { dplus: false, alt: false }, dplus: 0, alt: 0 }];
    state.vam = { speed: 0 };
    state.pace = { dist: 0, time: "" };
    state.race = { name: "", date: "", dist: 0, opts: { dplus: false, dneg: false, alt: false, sup: false, obj: false }, dplus: null, dneg: null, alt: 0, sup: "asfalto", obj: "" };
    state.segEnabled = false;
    state.segments = [];
    state.cond = {
      opts: { temp: false, hum: false, cielo: false, viento: false, sol: false, exp: false, grupo: false, strategy: false, stops: false },
      temp: null, hum: null, cielo: "cloud", viento: "mod", sol: 1, exp: "experimentado", grupo: "solo", strategy: "even", stops: 0,
    };
    applyStateToUI(); recompute(false); await sleep(30);
  }

  // Media maratón desde un 10K en 45 min. Escenario realista y comprobable.
  async function base() {
    await limpiar();
    setNum("r_dist", 21.097);
    setRef(0, "time", "00:45:00"); setRef(0, "dist", 10);
    await sleep(DEB);
  }

  /* ====================== A · ARRANQUE ====================== */
  sec("A · arranque limpio");
  await limpiar();
  {
    const vacios = ["r_name", "r_dist", "r_dplus", "r_dneg", "r_alt", "r_obj", "c_temp", "c_hum", "c_stops", "p_dist", "p_time", "v_speed", "v_pace"];
    vacios.forEach(id => ok(`${id} arranca vacío`, $id(id).value === "", `valor="${$id(id).value}"`));
    vacios.forEach(id => ok(`${id} muestra un ejemplo en gris`, !!$id(id).getAttribute("placeholder"), $id(id).getAttribute("placeholder")));
    ["name", "time", "dist"].forEach(k => ok(`referencia: ${k} arranca vacío`, refInput(0, k).value === "", refInput(0, k).value));
    ok("el resultado no inventa un tiempo", pantallaTexto() === "--:--:--", pantallaTexto());
  }

  /* ====================== B · TOGGLES ====================== */
  sec("B · toggles: prenden, apagan y mueven el resultado");
  const TOGGLES = [...document.querySelectorAll("[data-toggle]")].map(t => t.dataset.toggle);
  ok("se encontraron todos los toggles", TOGGLES.length >= 14, `${TOGGLES.length}: ${TOGGLES.join(",")}`);
  for (const k of TOGGLES) {
    await base();
    const antes = togOn(k);
    tog(k); await sleep(DEB);
    ok(`${k}: el click lo cambia`, togOn(k) === !antes);
    if (k !== "seg_enabled") ok(`${k}: el campo se habilita/deshabilita con él`, campoApagado(k) === !togOn(k), `disabled=${campoApagado(k)} on=${togOn(k)}`);
    tog(k); await sleep(DEB);
    ok(`${k}: vuelve al estado original`, togOn(k) === antes);
    ok(`${k}: prender y apagar no rompe el resultado`, pantallaSeg() !== null, pantallaTexto());
  }

  sec("B2 · cada toggle mueve el tiempo para el lado correcto");
  async function efecto(prep) { await base(); const t0 = pantallaSeg(); await prep(); await sleep(DEB); return { t0, t1: pantallaSeg() }; }
  {
    let e = await efecto(async () => { tog("r_dplus"); setNum("r_dplus", 400); });
    ok("400 m de D+ → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("r_alt"); setNum("r_alt", 2500); });
    ok("carrera en altura → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    // Ojo: es una calculadora de RUTA. No hay arena ni barro; la superficie más
    // dura que ofrece es ripio, y la más rápida es el tartán de la pista.
    e = await efecto(async () => { tog("r_sup"); setSel("r_sup", "ripio"); });
    ok("ripio → más lento que asfalto", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("r_sup"); setSel("r_sup", "tartan"); });
    ok("tartán → más rápido que asfalto", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    {
      // Y que ninguna opción del desplegable quede muda por no estar en la tabla.
      await base();
      const t0 = pantallaSeg();
      tog("r_sup");
      const mudas = [];
      for (const o of [...$id("r_sup").options]) {
        setSel("r_sup", o.value); await sleep(DEB);
        if (o.value !== "asfalto" && pantallaSeg() === t0) mudas.push(o.value);
      }
      ok("todas las superficies del desplegable mueven el tiempo", mudas.length === 0, "mudas: " + mudas.join(", "));
    }

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 33); });
    ok("33 °C → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_cielo"); setSel("c_cielo", "storm"); });
    ok("tormenta → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_viento"); setSel("c_viento", "extreme"); });
    ok("viento extremo → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_viento"); setSel("c_viento", "favor"); });
    ok("viento a favor → más rápido", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_exp"); setSel("c_exp", "debut"); });
    ok("debutante → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_exp"); setSel("c_exp", "veterano"); });
    ok("veterano → más rápido", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_grupo"); setSel("c_grupo", "large"); });
    ok("correr en pelotón grande → más rápido", e.t1 < e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_grupo"); setSel("c_grupo", "solo"); });
    ok("correr solo → no regala nada", e.t1 === e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_stops"); setNum("c_stops", 90); });
    ok("90 s de paradas → exactamente +90 s", e.t1 - e.t0 === 90, `+${e.t1 - e.t0} s`);
  }

  sec("B3 · toggles que dependen de otro");
  {
    let e = await efecto(async () => { tog("c_hum"); setNum("c_hum", 95); });
    ok("humedad SIN temperatura no hace nada, y la pantalla lo avisa",
      e.t1 === e.t0 && /humedad/i.test(avisos()), `${e.t0} → ${e.t1} · aviso="${avisos().slice(0, 70)}"`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 28); tog("c_hum"); setNum("c_hum", 95); });
    ok("humedad CON calor → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);

    e = await efecto(async () => { tog("c_sol"); setSel("c_sol", "3"); });
    ok("sol SIN temperatura no hace nada, y la pantalla lo avisa",
      e.t1 === e.t0 && /sol/i.test(avisos()), `${e.t0} → ${e.t1} · aviso="${avisos().slice(0, 70)}"`);

    e = await efecto(async () => { tog("c_temp"); setNum("c_temp", 28); tog("c_sol"); setSel("c_sol", "3"); });
    ok("sol CON calor → más lento", e.t1 > e.t0, `${e.t0} → ${e.t1}`);
  }

  sec("B4 · toggle prendido con el campo vacío");
  for (const k of ["c_temp", "c_hum", "c_stops", "r_dplus", "r_dneg", "r_alt"]) {
    await base();
    const t0 = pantallaSeg();
    tog(k); $id(k).value = ""; ev($id(k), "input"); await sleep(DEB);
    ok(`${k} prendido y vacío no mueve el tiempo`, pantallaSeg() === t0, `${t0} → ${pantallaSeg()}`);
    ok(`${k} prendido y vacío no escribe basura en pantalla`,
      !/null|undefined|NaN/.test($id("r-compare").textContent + $id("r-splits").textContent),
      ($id("r-compare").textContent.match(/.{0,25}(null|undefined|NaN).{0,15}/) || [""])[0]);
  }

  /* ====================== C · MODOS DE REFERENCIA ====================== */
  sec("C · los tres modos de referencia");
  {
    await base();
    const tRef = pantallaSeg();
    ok("modo «carrera previa» calcula", tRef !== null, pantallaTexto());

    document.querySelector('#ref-mode-switch [data-mode="vam"]').click(); await sleep(DEB);
    ok("el panel de VAM se ve", !$id("ref-mode-vam").classList.contains("hidden"));
    ok("VAM vacía no inventa un tiempo", pantallaTexto() === "--:--:--", pantallaTexto());
    setNum("v_speed", 16); await sleep(DEB);
    ok("cargando la VAM calcula", pantallaSeg() !== null, pantallaTexto());
    ok("al escribir la velocidad se completa el ritmo", $id("v_pace").value === "3:45", $id("v_pace").value);
    setNum("v_pace", "4:00"); await sleep(DEB);
    ok("al escribir el ritmo se completa la velocidad", Math.abs(+$id("v_speed").value - 15) < 0.02, $id("v_speed").value);

    document.querySelector('#ref-mode-switch [data-mode="pace"]').click(); await sleep(DEB);
    ok("el panel de ritmo test se ve", !$id("ref-mode-pace").classList.contains("hidden"));
    setNum("p_dist", 5); setNum("p_time", "00:21:00"); await sleep(DEB);
    ok("el modo ritmo test calcula", pantallaSeg() !== null, pantallaTexto());

    document.querySelector('#ref-mode-switch [data-mode="race"]').click(); await sleep(DEB);
    ok("volver a «carrera previa» recupera el resultado", pantallaSeg() === tRef, `${tRef} vs ${pantallaSeg()}`);
  }

  /* ====================== D · BOTONES ====================== */
  sec("D · botones");
  {
    await base();
    const n0 = state.refs.length;
    $id("btn-add-ref").click(); await sleep(60);
    ok("«Agregar carrera» suma exactamente una", state.refs.length === n0 + 1, `${n0} → ${state.refs.length}`);
    setRef(1, "time", "01:40:00"); setRef(1, "dist", 21.097); await sleep(DEB);
    ok("una segunda referencia real cambia el pronóstico", pantallaSeg() !== null);
    document.querySelector('#ref-list [data-del="1"]').click(); await sleep(DEB);
    ok("«Eliminar» saca la referencia", state.refs.length === n0);
    ok("«Eliminar» recalcula sola", pantallaSeg() !== null);
  }
  {
    await limpiar();
    state.refs = []; renderRefs();
    $id("btn-add-ref").click(); await sleep(60);
    ok("«Agregar carrera» con la lista vacía agrega UNA sola", state.refs.length === 1, state.refs.length);
  }
  {
    await base();
    $id("btn-auto-split").click(); await sleep(DEB);
    ok("«Autocompletar por km» crea tramos", state.segments.length > 1, state.segments.length);
    ok("«Autocompletar por km» prende el toggle de tramos", togOn("seg_enabled"));
    const suma = state.segments.reduce((a, s) => a + s.dist, 0);
    ok("los tramos autocompletados suman la distancia de la carrera", Math.abs(suma - 21.097) < 0.01, suma.toFixed(3));
    ok("«Autocompletar por km» recalcula sola", pantallaSeg() !== null, pantallaTexto());
    ok("y el resultado se parte en tramos", $id("r-splits").children.length === state.segments.length, `${$id("r-splits").children.length} vs ${state.segments.length}`);

    confirmRet = false; $id("btn-clear-seg").click(); await sleep(DEB);
    ok("«Limpiar todos» respeta el «cancelar»", state.segments.length > 1);
    confirmRet = true; $id("btn-clear-seg").click(); await sleep(DEB);
    ok("«Limpiar todos» borra los tramos", state.segments.length === 0);
    ok("«Limpiar todos» recalcula sola (vuelve a un solo tramo)", $id("r-splits").children.length === 1, `${$id("r-splits").children.length} tramos`);
  }
  {
    await limpiar();
    alertas = [];
    $id("btn-auto-split").click(); await sleep(60);
    ok("«Autocompletar por km» sin distancia avisa en vez de romper", alertas.length === 1 && state.segments.length === 0, `alertas=${alertas.length} segs=${state.segments.length}`);
  }
  {
    await base();
    $id("btn-add-seg").click(); await sleep(60);
    ok("«Agregar tramo» suma uno", state.segments.length === 1);
    document.querySelector("#seg-body [data-del]").click(); await sleep(DEB);
    ok("la ✕ del tramo lo borra", state.segments.length === 0);
  }
  {
    await base();
    descargas = []; alertas = [];
    $id("btn-export-csv").click(); await sleep(60);
    ok("«Exportar CSV» descarga un archivo", descargas.length === 1, descargas.join());
    await limpiar();
    descargas = []; alertas = [];
    $id("btn-export-csv").click(); await sleep(60);
    ok("«Exportar CSV» sin datos avisa", descargas.length === 0 && alertas.length === 1, `d=${descargas.length} a=${alertas.length}`);
    impresiones = 0; $id("btn-print").click(); await sleep(40);
    ok("«Imprimir» llama al diálogo", impresiones === 1);
  }
  {
    await base();
    localStorage.removeItem("ea-ruta-calc-v1");
    $id("btn-save").click(); await sleep(60);
    ok("«Guardar» escribe en el navegador", !!localStorage.getItem("ea-ruta-calc-v1"));
    const g = JSON.parse(localStorage.getItem("ea-ruta-calc-v1"));
    ok("«Guardar» guarda lo que estabas viendo", Math.abs(g.race.dist - 21.097) < 0.001 && g.refs[0].time === "00:45:00");
    confirmRet = false; $id("btn-reset").click(); await sleep(60);
    ok("«Reiniciar» respeta el «cancelar»", !!localStorage.getItem("ea-ruta-calc-v1"));
    localStorage.removeItem("ea-ruta-calc-v1");
  }
  {
    await base();
    const pills = [...document.querySelectorAll(".dist-pills button")];
    ok("hay atajos de distancia", pills.length > 0, pills.length);
    for (const p of pills) {
      p.click(); await sleep(DEB);
      ok(`el atajo «${p.textContent.trim()}» carga su distancia y recalcula`,
        Math.abs(state.race.dist - parseFloat(p.dataset.dist)) < 1e-9 && $id("r_dist").value !== "" && pantallaSeg() !== null,
        `dist=${state.race.dist} campo="${$id("r_dist").value}" t=${pantallaTexto()}`);
    }
  }
  {
    await base();
    const tabs = [...document.querySelectorAll(".tab")];
    for (const t of tabs) {
      t.click(); await sleep(40);
      ok(`la pestaña «${t.textContent.trim().slice(0, 22)}» abre su panel`, !!document.querySelector(`.panel.active[data-panel="${t.dataset.tab}"]`));
    }
    ok("cambiar de pestaña no rompe el resultado", pantallaSeg() !== null, pantallaTexto());
  }

  /* ====================== E · COHERENCIA ====================== */
  sec("E · lo que se muestra tiene que cerrar");
  {
    await base();
    $id("btn-auto-split").click(); await sleep(DEB);
    const total = pantallaSeg();
    const fr = [...$id("r-splits").querySelectorAll(".bar-val")];
    const u = fr[fr.length - 1].textContent.trim().split(":").map(Number);
    ok("el último tramo acumulado = el tiempo grande de arriba",
      Math.abs((u[0] * 3600 + u[1] * 60 + u[2]) - total) <= 1, `tramos=${u.join(":")} total=${$id("r-time").textContent}`);

    // Con paradas en tramos Y condiciones: acá se separaban.
    const tr0 = document.querySelectorAll("#seg-body tr")[0];
    const st = tr0.querySelector('[data-k="stop"]');
    st.value = 3; ev(st, "input");
    tog("c_viento"); setSel("c_viento", "extreme");
    await sleep(DEB);
    const total2 = pantallaSeg();
    const fr2 = [...$id("r-splits").querySelectorAll(".bar-val")];
    const u2 = fr2[fr2.length - 1].textContent.trim().split(":").map(Number);
    const acum2 = u2[0] * 3600 + u2[1] * 60 + u2[2];
    ok("con paradas + condiciones, los tramos SIGUEN sumando el total",
      Math.abs(acum2 - total2) <= 1, `tramos=${acum2} total=${total2} (difieren ${acum2 - total2} s)`);
  }
  {
    await base();
    ok("el ritmo mostrado se corresponde con el tiempo y la distancia", (() => {
      const p = $id("r-pace").textContent.trim().split(":").map(Number);
      return Math.abs((p[0] * 60 + p[1]) - pantallaSeg() / 21.097) <= 2;
    })(), `${$id("r-pace").textContent}`);
    ok("la velocidad mostrada se corresponde con el ritmo", (() => {
      const kmh = parseFloat($id("r-speed").textContent);
      return Math.abs(kmh - 21.097 / (pantallaSeg() / 3600)) < 0.05;
    })(), $id("r-speed").textContent);
    ok("ningún ritmo sale con segundos ':60'",
      ![...document.querySelectorAll(".bar-fill, #r-pace, #r-sub, #r-zones")].some(e => /:60\b/.test(e.textContent)),
      [...document.querySelectorAll("#r-pace, #r-sub")].map(e => e.textContent.trim()).join(" | "));
    ok("el VDOT es un número razonable", (() => { const v = parseFloat($id("r-vdot").textContent); return v > 20 && v < 90; })(), $id("r-vdot").textContent);
    ok("el % de VAM es razonable", (() => { const v = parseFloat($id("r-pctvam").textContent); return v > 50 && v < 105; })(), $id("r-pctvam").textContent);
    ok("las zonas de entrenamiento se dibujan", $id("r-zones").children.length > 0);
    ok("la estrategia de pacing se dibuja", $id("r-strategy").textContent.trim().length > 0);
  }
  {
    await base();
    ok("el subtítulo NO dice «con tramos» si no hay ninguno", !/con tramos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
    $id("btn-add-seg").click(); await sleep(DEB);   // tramo con distancia 0
    ok("un tramo vacío no cuenta como «con tramos»", !/con tramos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dist"]').value = 5; ev(tr.querySelector('[data-k="dist"]'), "input");
    tog("seg_enabled"); await sleep(DEB);
    ok("con tramos activos el subtítulo lo dice", /con tramos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
    tog("seg_enabled"); await sleep(DEB);
    ok("apagando el toggle deja de decirlo", !/con tramos/.test($id("r-conf-sub").textContent), $id("r-conf-sub").textContent);
  }

  /* ====================== F · SENSATEZ DEL MOTOR ====================== */
  sec("F · el motor tiene que dar números creíbles");
  {
    // Auto-consistencia: la propia carrera como referencia.
    await base();
    setRef(0, "dist", 21.097); setRef(0, "time", "01:40:00"); await sleep(DEB);
    ok("darle la propia carrera como referencia devuelve ese mismo tiempo",
      Math.abs(pantallaSeg() - 6000) / 6000 < 0.01, `${pantallaTexto()} vs 01:40:00`);
  }
  {
    /* Contraste contra la TABLA PUBLICADA de Daniels. Los tres anclajes:
         10K 40:00  -> tabla: VDOT 52 (10K 40:03)
         5K  20:00  -> tabla: VDOT 50 (5K 19:57)
         media 1:30 -> tabla: VDOT 51 (media 1:30:28)
       El maratón NO se contrasta contra la tabla a propósito: desde un 10K de
       40:00 esta calculadora proyecta 3:04, y la tabla de Daniels diría 2:56.
       La diferencia es sabida y va en el sentido correcto: la columna de
       maratón de Daniels es optimista para el corredor popular, y es el mismo
       criterio que ya está escrito para la calculadora de trail. Si algún día
       alguien "corrige" el maratón hacia Daniels, este comentario es el motivo
       por el que no hay que hacerlo. */
    const anclajes = [[10, "00:40:00", 52], [5, "00:20:00", 50], [21.097, "01:30:00", 51]];
    for (const [d, t, esperado] of anclajes) {
      await limpiar();
      setNum("r_dist", 42.195); setRef(0, "dist", d); setRef(0, "time", t); await sleep(DEB);
      const v = parseFloat($id("r-vdot").textContent);
      ok(`${d}K en ${t} da VDOT ${esperado} (tabla de Daniels)`, Math.abs(v - esperado) < 1.2, `VDOT ${v}`);
    }
    await limpiar();
    setNum("r_dist", 42.195); setRef(0, "dist", 10); setRef(0, "time", "00:40:00"); await sleep(DEB);
    ok("desde un 10K de 40:00 proyecta un maratón entre 3:00 y 3:10 (algo más conservador que Daniels)",
      pantallaSeg() > 10800 && pantallaSeg() < 11400, pantallaTexto());
  }
  {
    // Más distancia siempre tiene que dar más tiempo.
    await limpiar();
    setRef(0, "dist", 10); setRef(0, "time", "00:45:00");
    const t = [];
    for (const d of [5, 10, 21.097, 42.195]) { setNum("r_dist", d); await sleep(DEB); t.push(pantallaSeg()); }
    let creciente = true;
    for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) creciente = false;
    ok("más distancia siempre da más tiempo", creciente, t.join(" → "));
    let ritmoBaja = true;
    const ritmos = [5, 10, 21.097, 42.195].map((d, i) => t[i] / d);
    for (let i = 1; i < ritmos.length; i++) if (ritmos[i] <= ritmos[i - 1]) ritmoBaja = false;
    ok("y el ritmo por km empeora con la distancia (Riegel)", ritmoBaja, ritmos.map(r => r.toFixed(1)).join(" → "));
  }
  {
    // Subir y bajar lo mismo tiene que costar algo, nunca regalar.
    await base();
    const llano = pantallaSeg();
    tog("r_dplus"); setNum("r_dplus", 300); await sleep(DEB);
    ok("un circuito con 300 m de D+ y D- no puede ser más rápido que el llano", pantallaSeg() >= llano, `${llano} → ${pantallaSeg()}`);
  }

  /* ====================== G · CASOS BORDE ====================== */
  sec("G · casos borde: que no explote ni mienta");
  const BASURA = ["", "abc", "-5", "0", "99999999", "1e9", ".", "-", "0,5", "  ", "12:", ":", "::"];
  for (const v of BASURA) {
    await base();
    setNum("r_dist", v); await sleep(DEB);
    ok(`distancia = "${v}" no rompe`, explosiones.length === 0, explosiones.join(" | "));
    ok(`distancia = "${v}" no muestra NaN`, !/NaN|Infinity|undefined/.test($id("r-time").textContent + $id("r-pace").textContent + $id("r-vdot").textContent),
      `${$id("r-time").textContent} / ${$id("r-pace").textContent} / ${$id("r-vdot").textContent}`);
  }
  for (const v of BASURA) {
    await base();
    setRef(0, "time", v); await sleep(DEB);
    ok(`tiempo de referencia = "${v}" no rompe`, explosiones.length === 0, explosiones.join(" | "));
    ok(`tiempo de referencia = "${v}" no muestra NaN`, !/NaN|Infinity/.test($id("r-time").textContent + $id("r-vdot").textContent));
  }
  {
    await base(); setNum("r_dist", 0.4); await sleep(DEB);
    ok("400 m no explota", explosiones.length === 0 && !/NaN/.test($id("r-time").textContent), pantallaTexto());
    await base(); setNum("r_dist", 250); await sleep(DEB);
    ok("250 km no explota", explosiones.length === 0 && !/NaN/.test($id("r-time").textContent), pantallaTexto());
    await base(); setRef(0, "dist", 100); setRef(0, "time", "24:00:00"); await sleep(DEB);
    ok("una referencia lentísima no explota", !/NaN/.test($id("r-time").textContent + $id("r-vdot").textContent), `${pantallaTexto()} VDOT ${$id("r-vdot").textContent}`);
    await base(); setRef(0, "dist", 10); setRef(0, "time", "00:20:00"); await sleep(DEB);
    ok("una referencia de récord mundial no explota", !/NaN/.test($id("r-time").textContent + $id("r-vdot").textContent), `${pantallaTexto()} VDOT ${$id("r-vdot").textContent}`);
    await base(); tog("c_temp"); setNum("c_temp", -20); await sleep(DEB);
    ok("−20 °C no explota", pantallaSeg() !== null, pantallaTexto());
  }
  {
    await base();
    $id("btn-add-seg").click(); await sleep(40);
    const tr = document.querySelectorAll("#seg-body tr")[0];
    tr.querySelector('[data-k="dist"]').value = 100; ev(tr.querySelector('[data-k="dist"]'), "input");
    tog("seg_enabled"); await sleep(DEB);
    ok("tramos que suman más que la carrera no explotan", pantallaSeg() !== null, pantallaTexto());
    ok("tramos que suman más que la carrera avisan", /te pasaste/i.test($id("seg-sum").textContent), $id("seg-sum").textContent);
  }

  sec("H · sin errores de JavaScript");
  ok("ninguna excepción durante toda la corrida", explosiones.length === 0, explosiones.join(" | "));

  window.confirm = origConfirm; window.alert = origAlert; window.print = origPrint;
  HTMLAnchorElement.prototype.click = origAClick;
  window.removeEventListener("error", onErr);
  window.removeEventListener("unhandledrejection", onRej);

  const mal = R.filter(r => !r.pass);
  let g = "";
  for (const r of R) { if (r.g !== g) { g = r.g; console.log("\n" + g); } console.log(`  ${r.pass ? "ok  " : "FALLA"} ${r.n}${r.det && !r.pass ? "  ->  " + r.det : ""}`); }
  console.log(`\n${R.length - mal.length}/${R.length} pasan`);
  if (mal.length) { console.log("\nFALLAN:"); mal.forEach(r => console.log(` · [${r.g}] ${r.n}  ->  ${r.det}`)); }
  return { total: R.length, pasan: R.length - mal.length, fallan: mal.length, detalle: mal.map(r => `[${r.g}] ${r.n} -> ${r.det}`) };
};
