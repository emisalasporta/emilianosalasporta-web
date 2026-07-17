// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Configuración del sitio — https://astro.build/config
export default defineConfig({
  // Dominio final (lo usa el sitemap y los enlaces canónicos para SEO).
  site: 'https://emilianosalasporta.cloud',

  // Salida 100% estática (es el modo por defecto de Astro; lo dejamos explícito).
  output: 'static',

  integrations: [mdx(), sitemap()],
});
