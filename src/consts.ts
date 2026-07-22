/* Constantes del sitio: datos generales y categorías del blog.
   Para agregar una categoría nueva, sumala acá Y en el `z.enum([...])`
   de src/content.config.ts (deben coincidir). */

export const SITE = {
  name: 'Emiliano Salas Porta',
  title: 'Emiliano Salas Porta — Entrenador de trail y ultradistancia',
  description:
    'Recursos, herramientas y consejos de running, trail y ultradistancia por Emiliano Salas Porta, entrenador de deportes de resistencia.',
  domain: 'https://emilianosalasporta.cloud',
};

/* ===========================================================================
   MEDICIÓN DE VISITAS — ya está hecha, y NO va en el código
   ---------------------------------------------------------------------------
   El sitio se mide con Cloudflare Web Analytics desde mayo de 2026, y funciona
   sin que el repo tenga una sola línea al respecto: el dominio pasa por
   Cloudflare (la nube naranja), así que Cloudflare le inyecta el medidor a
   cada página desde su propio servidor. En el panel esa ficha figura como
   "Automatic setup".

   POR ESO NO HAY QUE AGREGAR EL SNIPPET DE JAVASCRIPT. Ya se probó (2026-07-21)
   y el resultado fue el sitio contándose DOS VECES, repartido entre dos fichas
   distintas del mismo dominio. Si algún día parece que "falta configurar la
   analítica", antes de tocar nada: dash.cloudflare.com → Analytics & Logs →
   Web Analytics, y mirar si ya hay una ficha con datos.

   Ventaja de que sea así: el sitio no pide NADA a ningún servidor ajeno, ni
   siquiera las tipografías. Y al no usar cookies, tampoco necesita el cartel
   de consentimiento.

   Lo único que Cloudflare no puede ver son las visitas de quien usa bloqueador
   de publicidad: el número real siempre es algo mayor que el del panel.
   =========================================================================== */

export const CATEGORIAS = {
  entrenamiento: 'Entrenamiento',
  nutricion: 'Nutrición',
  carreras: 'Carreras',
  mentalidad: 'Mentalidad',
  equipamiento: 'Equipamiento',
} as const;

export type CategoriaSlug = keyof typeof CATEGORIAS;

/* Tipos de recurso descargable. El tipo es lo primero que alguien mira para
   saber si le sirve ("¿es un PDF o una planilla de Excel?"), así que va como
   etiqueta en la tarjeta. Para agregar uno nuevo, sumalo acá Y en el
   `z.enum([...])` de src/content.config.ts (deben coincidir). */
export const TIPOS_RECURSOS = {
  pdf: 'PDF',
  planilla: 'Planilla',
  guia: 'Guía',
  video: 'Video',
} as const;

export type TipoRecurso = keyof typeof TIPOS_RECURSOS;
