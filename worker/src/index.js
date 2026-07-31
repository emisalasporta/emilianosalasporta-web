/**
 * ============================================================
 *  Contadores, y el buzón de preguntas
 *  emilianosalasporta.cloud
 * ============================================================
 *
 * Por qué esto vive acá y no en el sitio: la web es 100% estática (nginx
 * sirviendo archivos), y un contador --o un formulario-- necesita algo que
 * ESCRIBA y RECUERDE. Este Worker corre en el borde de Cloudflare, sobre el
 * mismo dominio, en la ruta /api/*. Para el visitante no hay ningún servidor
 * ajeno: le habla a emilianosalasporta.cloud y a nadie más. Esa es la regla
 * del proyecto (la misma por la que las tipografías son propias y el video de
 * YouTube no carga hasta que alguien lo toca), y es lo que evita el cartel de
 * cookies. Acá no se pone ninguna cookie ni se guarda ninguna IP.
 *
 * El aviso por mail sale de acá para afuera, de servidor a servidor, cuando
 * el visitante ya cerró la página. Él nunca habla con el servicio de mails.
 *
 * Endpoints:
 *   GET  /api/contadores?ids=blog:x,recurso:y   -> los números, para pintar
 *   POST /api/megusta    {"id":"blog:x"}        -> suma uno y devuelve el total
 *   POST /api/megusta-sacar {"id":"blog:x"}      -> resta uno (nunca baja de 0)
 *   POST /api/descarga   {"id":"recurso:y"}     -> suma una descarga (204)
 *   POST /api/pregunta   {nombre,mail,tema,...} -> guarda el mensaje y avisa
 *   GET  /api/preguntas?clave=…                 -> la bandeja, sólo para Emiliano
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

/* Mensajes por hora desde la misma conexión. Cinco es generoso para una
   persona (¿quién escribe cinco preguntas distintas en una hora?) y ridículo
   para un script, que es de lo que se trata. */
const TOPE_MENSAJES_POR_HORA = 5;

/* Cuánto tiene que haber estado abierta la página antes de mandar. Escribir
   una pregunta de verdad lleva bastante más que esto; un robot completa y
   dispara en menos de un segundo. */
const DEMORA_MINIMA_MS = 2500;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/api/contadores') {
        return await leerContadores(url, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/megusta') {
        return await sumarMeGusta(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/megusta-sacar') {
        return await sacarMeGusta(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/descarga') {
        return await sumarDescarga(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/pregunta') {
        return await recibirPregunta(request, env, ctx);
      }
      if (request.method === 'GET' && url.pathname === '/api/preguntas') {
        return await verBandeja(url, env);
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

/**
 * Sacar un "me gusta". Si alguien se arrepiente tiene que poder deshacerlo:
 * un boton que no se puede desmarcar se siente una trampa.
 *
 * El `MAX(0, ...)` es importante: sin el, alguien que llame a esto muchas veces
 * deja el contador en negativo. Con el, lo peor que puede pasar es que quede
 * en cero, que es donde empezo.
 */
async function sacarMeGusta(request, env) {
  if (!origenValido(request)) return json({ error: 'origen no permitido' }, 403);

  const id = await leerId(request);
  if (!id) return json({ error: 'id invalido' }, 400);

  if (!(await dentroDelLimite(request, env))) return json({ error: 'demasiados' }, 429);

  /* Sin INSERT: si la fila no existe es que nadie lo marco nunca, y no hay
     nada que restar. Devolvemos cero y listo. */
  const fila = await env.DB.prepare(
    `UPDATE contadores SET megusta = MAX(0, megusta - 1)
     WHERE id = ?
     RETURNING megusta`
  )
    .bind(id)
    .first();

  return json({ megusta: fila?.megusta ?? 0 }, 200);
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

/* ================================================================ */
/*  El buzón de preguntas                                            */
/* ================================================================ */

/**
 * Recibe un mensaje del formulario de /contacto.
 *
 * Hace dos cosas, en este orden y a propósito: primero lo GUARDA en la base,
 * después manda el aviso por mail. Si el mail falla --se venció la cuenta, se
 * cayó el servicio, lo que sea-- el mensaje ya está a salvo y se puede leer en
 * /api/preguntas. Al revés, un mail que no salió sería un mensaje perdido y
 * nadie se enteraría, ni la persona que lo escribió.
 */
async function recibirPregunta(request, env, ctx) {
  if (!origenValido(request)) return json({ error: 'origen no permitido' }, 403);

  let cuerpo;
  try {
    cuerpo = JSON.parse(await request.text());
  } catch {
    return json({ error: 'cuerpo invalido' }, 400);
  }

  /* La trampa del formulario: un campo que no se ve y que ninguna persona
     llena. Si viene con algo, es un robot. Contestamos 200 igual, sin guardar
     nada: si le devolvemos un error, el que escribió el programa lo corrige y
     vuelve. Que crea que anduvo y siga de largo es mejor negocio. */
  if (texto(cuerpo.sitio)) return json({ ok: true }, 200);

  /* Lo mismo con el que completó todo en menos de dos segundos y medio. */
  const demora = Number(cuerpo.demora);
  if (Number.isFinite(demora) && demora < DEMORA_MINIMA_MS) return json({ ok: true }, 200);

  const nombre = texto(cuerpo.nombre, 80);
  const mail = texto(cuerpo.mail, 120);
  const tema = texto(cuerpo.tema, 60);
  const mensaje = texto(cuerpo.mensaje, 2000);
  const referencia = texto(cuerpo.referencia, 140);

  if (!nombre || !mensaje || mensaje.length < 10) return json({ error: 'faltan datos' }, 400);
  /* Mail: alcanza con que tenga forma de mail. Validar direcciones a fondo es
     imposible y termina rebotando direcciones legítimas y raras. */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return json({ error: 'mail invalido' }, 400);

  if (!(await dentroDelLimite(request, env, TOPE_MENSAJES_POR_HORA, 'pregunta'))) {
    return json({ error: 'demasiados' }, 429);
  }

  await guardarPregunta(env, { nombre, mail, tema, mensaje, referencia });

  /* El aviso por mail va en segundo plano: la persona ve el "listo, me llegó"
     enseguida y no espera a que otro servidor conteste. `waitUntil` mantiene
     vivo al Worker hasta que termine, aunque la respuesta ya haya salido. */
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(avisarPorMail(env, { nombre, mail, tema, mensaje, referencia }));
  } else {
    await avisarPorMail(env, { nombre, mail, tema, mensaje, referencia });
  }

  return json({ ok: true }, 200);
}

/* La tabla del buzón, igual que en schema.sql. Está repetida acá a propósito:
   ver `guardarPregunta`. */
const TABLA_PREGUNTAS = `CREATE TABLE IF NOT EXISTS preguntas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  creado     INTEGER NOT NULL,
  nombre     TEXT    NOT NULL,
  mail       TEXT    NOT NULL,
  tema       TEXT,
  mensaje    TEXT    NOT NULL,
  referencia TEXT
)`;
const INDICE_PREGUNTAS = `CREATE INDEX IF NOT EXISTS preguntas_por_fecha ON preguntas (creado DESC)`;

/**
 * Guarda el mensaje. Si la tabla todavía no existe, la crea y vuelve a
 * intentar UNA vez.
 *
 * Ese rescate está por un motivo muy concreto: publicar este Worker y correr
 * el `schema.sql` en la base son dos pasos separados, hechos con clics en dos
 * pantallas distintas. El día que se haga el primero y se olvide el segundo,
 * sin esto, cada persona que escribiera vería "no pude enviarlo" y su mensaje
 * se perdería, sin que nadie se entere. Cuesta diez líneas y compra eso.
 */
async function guardarPregunta(env, m) {
  const insertar = () =>
    env.DB.prepare(
      `INSERT INTO preguntas (creado, nombre, mail, tema, mensaje, referencia)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(Math.floor(Date.now() / 1000), m.nombre, m.mail, m.tema, m.mensaje, m.referencia)
      .run();

  try {
    await insertar();
  } catch (error) {
    if (!/no such table/i.test((error && error.message) || '')) throw error;
    await env.DB.prepare(TABLA_PREGUNTAS).run();
    await env.DB.prepare(INDICE_PREGUNTAS).run();
    await insertar();
  }
}

/**
 * Manda el aviso a la casilla de Emiliano usando Resend.
 *
 * Es opcional: sin `RESEND_API_KEY` o sin `MAIL_DESTINO` esto no hace nada y
 * no se queja. El mensaje ya quedó guardado, así que el formulario sigue
 * funcionando aunque el mail no esté configurado todavía.
 *
 * El `reply_to` es el detalle que lo vuelve cómodo: Emiliano abre el aviso,
 * toca "Responder" y le está contestando a la persona, sin copiar direcciones
 * de ningún lado.
 */
async function avisarPorMail(env, m) {
  if (!env.RESEND_API_KEY || !env.MAIL_DESTINO) return;

  const asunto = `Web · ${m.tema || 'Mensaje nuevo'} · ${m.nombre}`;
  const lineas = [
    `De: ${m.nombre} <${m.mail}>`,
    m.tema ? `Sobre qué: ${m.tema}` : null,
    m.referencia ? `Escribió desde: ${m.referencia}` : null,
    '',
    m.mensaje,
    '',
    '—',
    'Contestá este mail y le llega directo a esa persona.',
    'Todos los mensajes quedan guardados en la bandeja de la web.',
  ].filter((l) => l !== null);

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        /* Sin dominio propio verificado, Resend deja mandar desde su
           dirección de prueba y sólo a la casilla del dueño de la cuenta.
           Para avisarse a uno mismo alcanza y sobra. */
        from: env.MAIL_DESDE || 'Web <onboarding@resend.dev>',
        to: [env.MAIL_DESTINO],
        reply_to: m.mail,
        subject: asunto,
        text: lineas.join('\n'),
      }),
    });
    if (!respuesta.ok) {
      console.error('mail:', respuesta.status, (await respuesta.text()).slice(0, 300));
    }
  } catch (error) {
    console.error('mail:', error && error.message);
  }
}

/**
 * La bandeja: todos los mensajes, en una página simple, para leer desde
 * cualquier lado sin entrar al panel de Cloudflare.
 *
 * La puerta es una clave larga en la dirección (`?clave=…`). No es un sistema
 * de usuarios y no pretende serlo: acá adentro no hay nada más sensible que lo
 * que la propia persona escribió, y la alternativa realista era que Emiliano
 * no pudiera leer los mensajes desde el celular. Si no hay clave configurada,
 * esta dirección directamente no existe.
 */
async function verBandeja(url, env) {
  if (!env.CLAVE_BANDEJA) return json({ error: 'no existe' }, 404);
  if (url.searchParams.get('clave') !== env.CLAVE_BANDEJA) {
    return json({ error: 'no existe' }, 404);
  }

  /* `id DESC` como segundo criterio: dos mensajes del mismo segundo (una
     prueba, dos personas a la vez) quedarían en orden azaroso y la lista
     parecería desordenada sin motivo. */
  let mensajes = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, creado, nombre, mail, tema, mensaje, referencia
       FROM preguntas ORDER BY creado DESC, id DESC LIMIT 200`
    ).all();
    mensajes = results || [];
  } catch (error) {
    /* Todavía no escribió nadie y la tabla no existe: bandeja vacía, que es
       exactamente lo que pasa. Cualquier otro error sí se avisa. */
    if (!/no such table/i.test((error && error.message) || '')) throw error;
  }

  if (url.searchParams.get('formato') === 'json') {
    return json({ mensajes }, 200, { 'X-Robots-Tag': 'noindex' });
  }

  const filas = mensajes
    .map(
      (m) => `<article>
  <p class="cuando">${escapar(fechaLarga(m.creado))}${m.tema ? ' · ' + escapar(m.tema) : ''}</p>
  <h2>${escapar(m.nombre)} <a href="mailto:${escapar(m.mail)}">${escapar(m.mail)}</a></h2>
  ${m.referencia ? `<p class="desde">Escribió desde: ${escapar(m.referencia)}</p>` : ''}
  <p class="texto">${escapar(m.mensaje)}</p>
</article>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Mensajes de la web</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0a0b10; color:#e7ecf3; font:16px/1.7 system-ui,sans-serif;
         margin:0; padding:1.25rem; }
  .caja { max-width: 46rem; margin-inline:auto; }
  h1 { font-size:1.4rem; margin:0 0 .35rem; }
  .total { color:#8a93a6; font-size:.9rem; margin:0 0 2rem; }
  article { background:#12141c; border:1px solid #262a38; border-left:2px solid #2fb8ff;
            border-radius:0 12px 12px 0; padding:1.1rem 1.25rem; margin-bottom:1rem; }
  h2 { font-size:1.02rem; margin:.15rem 0 .5rem; font-weight:600; }
  a { color:#2fb8ff; }
  .cuando { color:#8a93a6; font-size:.78rem; margin:0; text-transform:uppercase;
            letter-spacing:.06em; }
  .desde { color:#8a93a6; font-size:.85rem; margin:0 0 .5rem; }
  .texto { white-space:pre-wrap; margin:0; }
  .vacio { color:#8a93a6; }
</style></head>
<body><div class="caja">
<h1>Mensajes de la web</h1>
<p class="total">${mensajes.length === 0 ? 'Todavía no llegó ninguno.' : mensajes.length + (mensajes.length === 1 ? ' mensaje' : ' mensajes') + ' · del más nuevo al más viejo'}</p>
${filas || '<p class="vacio">Cuando alguien te escriba desde la web, va a aparecer acá.</p>'}
</div></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/** Recorta y limpia un campo de texto que llegó de afuera. */
function texto(valor, tope = 200) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, tope);
}

/** Escapa lo que se pinta en la bandeja: el texto lo escribió un desconocido. */
function escapar(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "31 de julio de 2026, 14:05", en hora de Argentina. */
function fechaLarga(segundos) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(segundos * 1000));
}

/* ---------------------------------------------------------------- */
/*  Límite por IP, sin guardar ninguna IP                            */
/* ---------------------------------------------------------------- */

/**
 * Guardamos el SHA-256 de (etiqueta + IP + sal secreta + hora), nunca la IP.
 * Del hash no se vuelve a la IP, y como la hora entra en la cuenta, el rastro
 * se vence solo cada 60 minutos. Es lo mínimo para frenar un script y lo
 * máximo que podemos no saber del visitante.
 *
 * La `etiqueta` separa las cuentas: los "me gusta" y los mensajes del
 * formulario llevan cada uno su propio contador, porque treinta corazones por
 * hora es normal y treinta mensajes no lo es. Al entrar en el hash, dos
 * etiquetas distintas dan huellas distintas y no se pisan.
 */
async function dentroDelLimite(request, env, tope = TOPE_POR_HORA, etiqueta = 'megusta') {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const hora = Math.floor(Date.now() / 3600000);
  const huella = await sha256(`${etiqueta}|${ip}|${env.SAL || 'sin-sal'}|${hora}`);

  const fila = await env.DB.prepare(
    `INSERT INTO limites (huella, n, hora) VALUES (?, 1, ?)
     ON CONFLICT(huella) DO UPDATE SET n = n + 1
     RETURNING n`
  )
    .bind(huella, hora)
    .first();

  return (fila?.n || 1) <= tope;
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
