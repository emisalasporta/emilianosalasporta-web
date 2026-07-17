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
