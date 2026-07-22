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
   MEDICIÓN DE VISITAS — Cloudflare Web Analytics
   ---------------------------------------------------------------------------
   Acá va el token que da Cloudflare. Mientras esté vacío, el sitio no carga
   NINGÚN script de medición: queda exactamente como está hoy.

   Cómo se consigue (se puede desde el celular, son cuatro toques):
     1. Entrar a dash.cloudflare.com con la cuenta de siempre.
     2. Menú de la izquierda: Analytics & Logs → Web Analytics.
     3. "Add a site" y escribir  emilianosalasporta.cloud
     4. Cloudflare devuelve un bloque de código. Adentro dice
        data-cf-beacon='{"token": "abc123..."}'. Ese "abc123..." es lo único
        que hace falta: se pega acá abajo entre las comillas.

   Se eligió esta y no Google Analytics por un motivo concreto: no usa cookies,
   así que el sitio no necesita el cartel de consentimiento. A cambio da menos
   detalle (visitas, páginas, de dónde vienen y país; nada de embudos).

   Ojo con dos cosas, para que los números no sorprendan:
     - Es el único pedido a un servidor ajeno que hace el sitio. Todo lo demás
       (tipografías incluidas) viaja con la página.
     - Como cualquier medición por JavaScript, los bloqueadores de publicidad
       la frenan. El número real de visitas siempre es algo mayor que el que
       muestra el panel.
   =========================================================================== */
export const CF_ANALYTICS_TOKEN = '';

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
