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
    /* Imagen de portada, subida desde el panel a public/uploads/.
       Se ve arriba de la nota, en la tarjeta del listado, y es la imagen
       que aparece al compartir el link. Si la nota lleva video, esta misma
       imagen es la miniatura con el botón de play. */
    cover: textoOpcional,
    /* Link de YouTube, pegado tal cual se copia (cualquier formato sirve).
       No se sube ningún archivo de video al sitio: el video vive en YouTube
       y acá se muestra una portada con botón de play que recién lo carga
       cuando el visitante lo toca. Ver src/components/VideoYouTube.astro.
       Va como texto libre a propósito: si el link viene mal, la nota se
       publica igual sin video en vez de tirar abajo el build. */
    video: textoOpcional,
    draft: z.boolean().default(false),
  }),
});

/* Colección RECURSOS: fichas de descargables (PDF, planillas, guías).
   El archivo real va en public/uploads/ (que es donde el panel /admin sube
   todo) y acá se guarda solo la ruta pública, ej: "/uploads/plan.pdf". */
const recursos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/recursos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tipo: z.enum(['pdf', 'planilla', 'guia', 'video']).default('pdf'),
    /* Ruta pública del archivo, ej: "/uploads/plan-base-8-semanas.pdf".
       Es opcional a propósito: si está vacío o apunta a algo que no existe,
       la ficha se publica sin botón de descarga en vez de romper el build. */
    archivo: textoOpcional,
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, recursos };
