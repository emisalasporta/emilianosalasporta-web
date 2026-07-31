/* ---------------------------------------------------------------------------
   Paginado de los listados (/blog y /recursos).

   Por qué a mano y no con el `paginate()` que trae Astro: `paginate()` quiere
   quedarse con toda la ruta (`/blog/[...page]`), y en este sitio `/blog/<algo>`
   ya es la dirección de una nota (`[...slug].astro`). Las dos reglas chocan y
   Astro no sabe cuál aplicar.

   Entonces el reparto quedó así, que además es el que mejor le viene a Google:

     /blog            -> página 1  (la dirección de siempre, no cambia nunca)
     /blog/pagina/2   -> página 2
     /recursos        -> página 1
     /recursos/pagina/2 -> página 2

   `/blog/pagina/1` NO existe a propósito: sería la misma lista en dos
   direcciones distintas, que es justo lo que a un buscador le molesta.
   --------------------------------------------------------------------------- */

/* Doce entra parejo en las tres anchos de la grilla (1, 2 y 3 columnas), así
   la última fila nunca queda coja. Si algún día se cambia, que sea múltiplo
   de 6 por el mismo motivo. */
export const POR_PAGINA = 12;

export interface Pagina<T> {
  /** Lo que hay que dibujar en esta página. */
  items: T[];
  /** En cuál estamos, empezando de 1. */
  numero: number;
  /** Cuántas hay en total (mínimo 1, aunque la lista esté vacía). */
  total: number;
}

/** Corta una lista ya ordenada en la porción que le toca a una página. */
export function paginar<T>(items: T[], numero: number, porPagina = POR_PAGINA): Pagina<T> {
  const total = Math.max(1, Math.ceil(items.length / porPagina));
  /* Si alguien pide una página que no existe le damos la última en vez de una
     lista vacía. En la práctica no puede pasar (las direcciones se generan de
     esta misma cuenta), pero una lista vacía sería un callejón sin salida. */
  const actual = Math.min(Math.max(1, numero), total);
  const desde = (actual - 1) * porPagina;
  return { items: items.slice(desde, desde + porPagina), numero: actual, total };
}

/**
 * Las direcciones de las páginas 2 en adelante, para el `getStaticPaths` de
 * `pagina/[page].astro`. Con una sola página devuelve una lista vacía y no se
 * genera ninguna dirección extra: el sitio queda exactamente como antes.
 */
export function numerosDePaginaExtra(cantidad: number, porPagina = POR_PAGINA): number[] {
  const total = Math.max(1, Math.ceil(cantidad / porPagina));
  return Array.from({ length: total - 1 }, (_, i) => i + 2);
}

/** La dirección de una página: la 1 es la raíz del listado, el resto llevan /pagina/N. */
export function direccionDePagina(base: string, numero: number): string {
  return numero <= 1 ? base : `${base}/pagina/${numero}`;
}
