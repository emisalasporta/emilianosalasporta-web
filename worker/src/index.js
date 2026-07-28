/**
 * ============================================================
 *  Contadores de "me gusta" y de descargas
 *  emilianosalasporta.cloud
 * ============================================================
 *
 * Por qué esto vive acá y no en el sitio: la web es 100% estática (nginx
 * sirviendo archivos), y un contador necesita algo que ESCRIBA y RECUERDE.
 * Este Worker corre en el borde de Cloudflare, sobre el mismo dominio, en
 * la ruta /api/*. Para el visitante no hay ningún servidor ajeno: le habla
 * a emilianosalasporta.cloud y a nadie más. Esa es la regla del proyecto
 * (la misma por la que las tipografías son propias y el video de YouTube
 * no carga hasta que alguien lo toca), y es lo que evita el cartel de
 * cookies. Acá no se pone ninguna cookie ni se guarda ninguna IP.
 *
 * Endpoints:
 *   GET  /api/contadores?ids=blog:x,recurso:y   -> los números, para pintar
 *   POST /api/megusta    {"id":"blog:x"}        -> suma uno y devuelve el total
 *   POST /api/descarga   {"id":"recurso:y"}     -> suma una descarga (204)
 */

/* Sólo aceptamos pedidos que vengan de la web. No es seguridad de verdad
   --el header se puede falsificar-- pero corta de una el caso tonto de que
   otro sitio embeba nuestros botones. El abuso en serio lo frena el límite
   por IP de más abajo. */
const ORIGENES = [
  'https://emilianosalasporta.cloud',
  'https://www.emilianosalasporta.cloud',
];

/* Formato de los identificadores: "blog:mi-nota" o "recurso:plan-5k".
   Lista blanca estricta: sin esto, cualquiera nos llena la tabla de basura
   con ids inventados.
   La barra está permitida porque las notas podrían vivir en subcarpetas
   (`blog/2026/mi-nota`); hoy no pasa, pero si algún día pasa esto no se rompe. */
const ID_VALIDO = /^(blog|recurso):[a-z0-9][a-z0-9/-]{0,119}$/;

/* Cuántos "me gusta" tolera una misma IP por hora. Alto para que una familia
   o una oficina detrás del mismo router no se pisen, bajo para que un script
   no infle un número en un minuto. */
const TOPE_POR_HORA = 30;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/api/contadores') {
        return await leerContadores(url, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/megusta') {
        return await sumarMeGusta(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/descarga') {
        return await sumarDescarga(request, env);
      }
    } catch (error) {
      /* Que un error acá NUNCA rompa la página: el componente del sitio
         esconde el botón si esto no contesta bien, así que la nota se lee
         igual. Por eso devolvemos un error limpio y no dejamos que explote. */
      console.error('contadores:', error && error.message);
      return json({ error: 'error interno' }, 500);
    }

    return json({ error: 'no existe' }, 404);
  },

  /**
   * Limpieza diaria. La tabla `limites` es descartable: cada huella sirve una
   * hora y después es basura. Sin esto crece para siempre y un día alguien se
   * pregunta por qué la base pesa. Se dispara sola con el cron de wrangler.toml.
   */
  async scheduled(evento, env) {
    const hace48Horas = Math.floor(Date.now() / 3600000) - 48;
    await env.DB.prepare('DELETE FROM limites WHERE hora < ?').bind(hace48Horas).run();
  },
};

/* ---------------------------------------------------------------- */
/*  Lectura: los números para pintar la página                       */
/* ---------------------------------------------------------------- */

async function leerContadores(url, env) {
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ID_VALIDO.test(s))
    .slice(0, 50); // tope: nadie necesita más, y evita una consulta gigante

  if (ids.length === 0) return json({}, 200);

  const huecos = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, megusta, descargas FROM contadores WHERE id IN (${huecos})`
  )
    .bind(...ids)
    .all();

  /* Devolvemos también los que no están todavía en la tabla, en cero: así el
     sitio no tiene que distinguir entre "no existe" y "nadie lo toco aún". */
  const salida = {};
  for (const id of ids) salida[id] = { megusta: 0, descargas: 0 };
  for (const fila of results || []) {
    salida[fila.id] = { megusta: fila.megusta || 0, descargas: fila.descargas || 0 };
  }

  return json(salida, 200, {
    /* Medio minuto de caché en el borde. Alcanza para aguantar una nota que
       se comparte y se llena de visitas, y el número igual se siente al día. */
    'Cache-Control': 'public, max-age=30',
  });
}

/* ---------------------------------------------------------------- */
/*  Escritura                                                        */
/* ---------------------------------------------------------------- */

async function sumarMeGusta(request, env) {
  if (!origenValido(request)) return json({ error: 'origen no permitido' }, 403);

  const id = await leerId(request);
  if (!id) return json({ error: 'id invalido' }, 400);

  if (!(await dentroDelLimite(request, env))) {
    /* 429 = "pará un poco". El sitio lo trata como un no-pasa-nada: deja el
       botón marcado igual, porque quien llega acá casi siempre es alguien
       haciendo clic como loco, no un visitante de verdad. */
    return json({ error: 'demasiados' }, 429);
  }

  const total = await sumarUno(env, id, 'megusta');
  return json({ megusta: total }, 200);
}

async function sumarDescarga(request, env) {
  if (!origenValido(request)) return json({ error: 'origen no permitido' }, 403);

  const id = await leerId(request);
  if (!id) return json({ error: 'id invalido' }, 400);

  await sumarUno(env, id, 'descargas');
  /* 204 sin cuerpo: esto lo manda navigator.sendBeacon mientras el navegador
     ya está bajando el PDF. A nadie le importa la respuesta. */
  return new Response(null, { status: 204 });
}

/**
 * Suma uno a una columna, creando la fila si es la primera vez.
 * Es una sola sentencia (UPSERT) a propósito: si dos personas tocan el botón
 * en el mismo instante, SQLite resuelve las dos y no se pierde ninguna. Con
 * un SELECT y después un UPDATE, una de las dos se perdía.
 */
async function sumarUno(env, id, columna) {
  const fila = await env.DB.prepare(
    `INSERT INTO contadores (id, megusta, descargas)
     VALUES (?, ${columna === 'megusta' ? '1, 0' : '0, 1'})
     ON CONFLICT(id) DO UPDATE SET ${columna} = ${columna} + 1
     RETURNING megusta, descargas`
  )
    .bind(id)
    .first();

  return (fila && fila[columna]) || 1;
}

/* ---------------------------------------------------------------- */
/*  Límite por IP, sin guardar ninguna IP                            */
/* ---------------------------------------------------------------- */

/**
 * Guardamos el SHA-256 de (IP + sal secreta + hora), nunca la IP.
 * Del hash no se vuelve a la IP, y como la hora entra en la cuenta, el rastro
 * se vence solo cada 60 minutos. Es lo mínimo para frenar un script y lo
 * máximo que podemos no saber del visitante.
 */
async function dentroDelLimite(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const hora = Math.floor(Date.now() / 3600000);
  const huella = await sha256(`${ip}|${env.SAL || 'sin-sal'}|${hora}`);

  const fila = await env.DB.prepare(
    `INSERT INTO limites (huella, n, hora) VALUES (?, 1, ?)
     ON CONFLICT(huella) DO UPDATE SET n = n + 1
     RETURNING n`
  )
    .bind(huella, hora)
    .first();

  return (fila?.n || 1) <= TOPE_POR_HORA;
}

/* ---------------------------------------------------------------- */
/*  Ayudas                                                           */
/* ---------------------------------------------------------------- */

function origenValido(request) {
  const origen = request.headers.get('Origin');
  /* sendBeacon a veces no manda Origin. Si no viene, lo dejamos pasar: el
     tope por IP ya cubre el abuso, y rechazar acá romperia el contador de
     descargas en algunos navegadores. */
  return !origen || ORIGENES.includes(origen);
}

async function leerId(request) {
  let cuerpo = null;
  try {
    /* sendBeacon manda text/plain, fetch manda application/json. Leemos el
       texto crudo y lo parseamos nosotros: así los dos entran por la misma
       puerta. */
    cuerpo = JSON.parse(await request.text());
  } catch {
    return null;
  }
  const id = cuerpo && typeof cuerpo.id === 'string' ? cuerpo.id : '';
  return ID_VALIDO.test(id) ? id : null;
}

async function sha256(texto) {
  const datos = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(objeto, status = 200, extra = {}) {
  return new Response(JSON.stringify(objeto), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}
