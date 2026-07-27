/* Utilidades chicas y reutilizables. */

/** Fecha larga en español rioplatense: "20 de junio de 2026". */
export function formatFecha(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC', // la fecha del frontmatter no lleva hora: la mostramos tal cual (sin corrimiento)
  }).format(date);
}

/** Fecha en formato ISO corto (YYYY-MM-DD), para el atributo datetime. */
export function isoFecha(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
   YouTube: sacar el identificador del video de cualquier link.

   Emiliano pega en el panel el link tal cual lo copia de YouTube, y ese link
   viene de muchas formas distintas según de dónde lo copie (la barra del
   navegador, el botón Compartir, la app del celular, un Short). Todas traen
   el mismo identificador de 11 caracteres adentro; esto lo pesca sin que él
   tenga que limpiar nada.

   Si no encuentra un identificador válido devuelve null a propósito, en vez
   de romper: así una nota con el campo mal cargado se publica igual (sin
   video) en lugar de tirar abajo el build entero y dejar la web vieja
   publicada en silencio.
   --------------------------------------------------------------------------- */
export function youtubeId(entrada?: string | null): string | null {
  if (!entrada) return null;
  const texto = String(entrada).trim();
  if (!texto) return null;

  // Por si alguna vez pega el identificador pelado, sin link alrededor.
  if (/^[\w-]{11}$/.test(texto)) return texto;

  const formas = [
    /[?&]v=([\w-]{11})/, // youtube.com/watch?v=XXXXXXXXXXX
    /youtu\.be\/([\w-]{11})/, // youtu.be/XXXXXXXXXXX  (botón Compartir)
    /\/embed\/([\w-]{11})/, // youtube.com/embed/XXXXXXXXXXX
    /\/shorts\/([\w-]{11})/, // youtube.com/shorts/XXXXXXXXXXX
    /\/live\/([\w-]{11})/, // youtube.com/live/XXXXXXXXXXX
  ];

  for (const forma of formas) {
    const encontrado = texto.match(forma);
    if (encontrado) return encontrado[1];
  }

  return null;
}
