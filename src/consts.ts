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
