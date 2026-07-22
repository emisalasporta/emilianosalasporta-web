/* Registro de herramientas: única fuente de verdad.
   Para sumar una calculadora nueva: dejá el .html en public/tools/ y agregá
   una línea acá. El índice y las páginas /herramientas/<slug> salen solos.

   `file` es la ruta REAL dentro de public/, relativa a la raíz del proyecto.
   Las páginas la usan para leer el tamaño del archivo en build (node:fs). */

export const CATEGORIAS_HERRAMIENTAS = {
  calculadoras: 'Calculadoras',
} as const;

export type CategoriaHerramienta = keyof typeof CATEGORIAS_HERRAMIENTAS;

export interface Herramienta {
  /** Slug de la URL: /herramientas/<slug>. Coincide con public/tools/<slug>.html */
  slug: string;
  title: string;
  /** Una línea, para la tarjeta del índice. Corto a propósito: que se lea de un vistazo. */
  summary: string;
  /** Completa: va en la página de la herramienta y en el SEO. */
  description: string;
  /** Ruta al archivo servido, relativa a la raíz del proyecto. */
  file: string;
  category: CategoriaHerramienta;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    slug: 'calculadora-zonas',
    title: 'Calculadora de Zonas de Entrenamiento',
    summary:
      'Un test de campo o una carrera reciente, cargados acá, y salen las cinco zonas de entrenamiento con su ritmo, su pulso y su esfuerzo percibido, más los tiempos estimados de 800 metros a maratón.',
    /* Texto de Emiliano. Va en varios párrafos: la página los separa sola. */
    description: `La VAM (velocidad aeróbica máxima) es la velocidad mínima a la que se alcanza el máximo consumo de oxígeno que el cuerpo puede procesar.

Esta calculadora traduce tu VAM a zonas de entrenamiento: el ritmo, el pulso, el esfuerzo percibido y para qué sirve cada una, ordenadas utilizando de base un modelo trifásico.

Podés utilizarla en base a cualquier esfuerzo máximo (el test de 5 minutos, un 1500 o un 3000 metros, o una carrera reciente), porque el porcentaje de VAM se ajusta según cuánto duró el esfuerzo y no según la distancia, que es donde fallan las tablas de siempre.

Incluye la estimación de la frecuencia cardíaca máxima con cinco fórmulas, las zonas de pulso calculadas sobre la FC máxima o sobre la FC de reserva, la comparación del VO2 máx con las tablas de referencia por edad y sexo, los tiempos estimados de 800 metros a maratón con su rango probable, y las cuentas de todos los días: ritmo, tiempo y distancia, kilómetros a millas, cuánto falta para la carrera y desnivel equivalente.

También se incluyen los protocolos explicados paso a paso para realizar cualquiera de los tests.`,
    file: 'public/tools/calculadora-zonas.html',
    category: 'calculadoras',
  },
  {
    slug: 'calculadora-trail',
    title: 'Calculadora de Trail',
    summary:
      'Estimá tu tiempo en una carrera de trail usando una carrera que ya corriste como referencia, con el desnivel y las condiciones del día.',
    description:
      'Estima tu tiempo en una carrera de trail a partir de una carrera que ya corriste (o un ritmo de ruta) como referencia de tu nivel. Sólo la distancia y el desnivel positivo son obligatorios: si cargás los segmentos del recorrido te devuelve el pacing por puesto de control, y podés sumar terreno, superficie y clima para afinar la estimación. Muestra las fórmulas que usa y exporta el plan a CSV.',
    file: 'public/tools/calculadora-trail.html',
    category: 'calculadoras',
  },
  {
    slug: 'calculadora-calle',
    title: 'Calculadora de Ruta',
    summary:
      'Proyectá tu tiempo en 5K, 10K, 21K o 42K a partir de tu VDOT, y sacá de ahí tus zonas de entrenamiento.',
    description:
      'Proyecta el tiempo en carreras de calle (5K, 10K, 15K, 21K, 42K o la distancia que toque) calculando el VDOT de Daniels desde una carrera previa, un test de VAM o cualquier ritmo sostenido. Ajusta por perfil, altitud, superficie y clima, arma el pacing por tramo y deriva las zonas de entrenamiento. Sólo la distancia es obligatoria; el resto afina el resultado. Incluye las ecuaciones y las referencias detrás de cada ajuste.',
    file: 'public/tools/calculadora-calle.html',
    category: 'calculadoras',
  },
];

export const getHerramienta = (slug: string): Herramienta | undefined =>
  HERRAMIENTAS.find((h) => h.slug === slug);
