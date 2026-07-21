import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* IMPORTANTE — por qué existen estos dos helpers:
   Cuando en el panel (/admin) dejás vacío un campo OPCIONAL, no lo omite: guarda
   una cadena vacía (`updated: ''`). Una cadena vacía NO es una fecha válida, así
   que el build fallaba y la nota nunca se publicaba. Estos helpers convierten ""
   (y null) en "sin valor" ANTES de validar. Traducción: podés dejar campos
   vacíos en el panel tranquilo, que no rompe nada. */
const vacioEsNada = (v: unknown) => (v === '' || v === null ? undefined : v);
const fechaOpcional = z.preprocess(vacioEsNada, z.coerce.date().optional());
const textoOpcional = z.preprocess(vacioEsNada, z.string().optional());

/* Colección BLOG: cada entrada es un archivo .md (o .mdx si lleva video)
   en src/content/blog/ con este bloque de datos arriba (frontmatter). */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: fechaOpcional,
    category: z.enum(['entrenamiento', 'nutricion', 'carreras', 'mentalidad', 'equipamiento']),
    tags: z.array(z.string()).default([]),
    cover: textoOpcional,
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
    archivo: textoOpcional, // ej: "/descargas/plan-base-8-semanas.pdf"
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, recursos };
