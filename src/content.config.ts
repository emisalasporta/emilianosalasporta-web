import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* Colección BLOG: cada entrada es un archivo .md (o .mdx si lleva video)
   en src/content/blog/ con este bloque de datos arriba (frontmatter). */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(['entrenamiento', 'nutricion', 'carreras', 'mentalidad', 'equipamiento']),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

/* Colección RECURSOS: fichas de descargables (PDF, planillas, guías).
   El archivo real va en public/descargas/ y acá se guarda solo la ruta. */
const recursos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/recursos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tipo: z.enum(['pdf', 'planilla', 'guia', 'video']).default('pdf'),
    archivo: z.string().optional(), // ej: "/descargas/plan-base-8-semanas.pdf"
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, recursos };
