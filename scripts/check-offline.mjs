#!/usr/bin/env node
/**
 * check-offline.mjs
 *
 * Revisa los .html de public/tools/ (las calculadoras) y avisa si alguno
 * depende de internet para funcionar.
 *
 * La idea: las calculadoras tienen que abrirse y andar aunque el atleta
 * esté en el medio de la montaña sin señal. Si un archivo pide algo a un
 * servidor (una imagen, una tipografía, un script), ese pedazo se rompe.
 *
 * Sin dependencias externas: solo builtins de Node.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CARPETA = join(RAIZ, 'public', 'tools');

/** ¿Esta dirección apunta a internet? */
const esRemota = (v = '') => /^\s*(https?:)?\/\//i.test(v);

/**
 * Cada regla busca un patrón y, si la dirección es remota, explica el
 * problema en castellano llano y dice cómo se arregla.
 */
const REGLAS = [
  {
    nombre: 'hoja de estilos remota',
    // <link ... rel="stylesheet" ... href="...">  (en cualquier orden)
    patron: /<link\b[^>]*>/gi,
    revisar(etiqueta) {
      if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(etiqueta)) return null;
      const href = etiqueta.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!href || !esRemota(href)) return null;
      return {
        referencia: href,
        problema: 'El archivo pide los estilos (los colores y el diseño) a otra web.',
        arreglo:
          'Copiá ese CSS adentro del HTML, entre <style> y </style>, o bajá el archivo a public/ y apuntá al archivo local.',
      };
    },
  },
  {
    nombre: 'script remoto',
    patron: /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
    revisar(_etiqueta, src) {
      if (!esRemota(src)) return null;
      return {
        referencia: src,
        problema: 'El archivo baja un programa (JavaScript) de otra web para poder funcionar.',
        arreglo:
          'Pegá ese código adentro del HTML, entre <script> y </script>, o guardá el archivo en public/ y apuntá al archivo local.',
      };
    },
  },
  {
    nombre: 'imagen remota',
    patron: /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
    revisar(_etiqueta, src) {
      if (!esRemota(src)) return null;
      return {
        referencia: src,
        problema: 'La imagen se baja de otra web: sin internet aparece rota.',
        arreglo:
          'Guardá la imagen en la carpeta public/ y en el src poné la ruta local (por ejemplo src="/logo.png").',
      };
    },
  },
  {
    nombre: '@import de red',
    patron: /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi,
    revisar(_etiqueta, dir) {
      if (!esRemota(dir)) return null;
      return {
        referencia: dir,
        problema: 'El CSS importa otro CSS desde internet (normalmente tipografías de Google).',
        arreglo:
          'Bajá esa tipografía o ese CSS, dejalo en public/ y usá la ruta local; o directamente pegá el CSS acá adentro.',
      };
    },
  },
  {
    nombre: 'url() de red',
    patron: /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    revisar(_etiqueta, dir) {
      if (!esRemota(dir)) return null;
      return {
        referencia: dir,
        problema: 'Un estilo trae un recurso (imagen o tipografía) desde internet.',
        arreglo: 'Guardá el recurso en public/ y en el url() poné la ruta local.',
      };
    },
  },
  {
    nombre: 'fetch()',
    patron: /\bfetch\s*\(/gi,
    revisar() {
      return {
        referencia: 'fetch(',
        problema: 'El archivo le pide datos a un servidor mientras el usuario lo usa. Sin internet, falla.',
        arreglo:
          'La calculadora tiene que calcular sola, con los datos que ya están en el archivo. Sacá el pedido al servidor.',
      };
    },
  },
  {
    nombre: 'XMLHttpRequest',
    patron: /\bXMLHttpRequest\b/g,
    revisar() {
      return {
        referencia: 'XMLHttpRequest',
        problema: 'El archivo le pide datos a un servidor mientras el usuario lo usa. Sin internet, falla.',
        arreglo:
          'La calculadora tiene que calcular sola, con los datos que ya están en el archivo. Sacá el pedido al servidor.',
      };
    },
  },
];

/** Nº de línea (1-based) de una posición dentro del texto. */
const numeroDeLinea = (texto, pos) => texto.slice(0, pos).split('\n').length;

async function revisarArchivo(ruta) {
  const texto = await readFile(ruta, 'utf8');
  const lineas = texto.split('\n');
  const hallazgos = [];

  for (const regla of REGLAS) {
    regla.patron.lastIndex = 0;
    let m;
    while ((m = regla.patron.exec(texto)) !== null) {
      const detalle = regla.revisar(m[0], m[1]);
      if (!detalle) continue;
      const linea = numeroDeLinea(texto, m.index);
      hallazgos.push({
        linea,
        texto: (lineas[linea - 1] ?? '').trim(),
        regla: regla.nombre,
        ...detalle,
      });
    }
  }

  return hallazgos.sort((a, b) => a.linea - b.linea);
}

async function main() {
  let archivos;
  try {
    archivos = (await readdir(CARPETA))
      .filter((n) => n.toLowerCase().endsWith('.html'))
      .sort();
  } catch {
    console.error(`\n  No encontré la carpeta ${relative(RAIZ, CARPETA)}. ¿Se movió de lugar?\n`);
    process.exit(1);
  }

  if (archivos.length === 0) {
    console.log('\n  No hay archivos .html en public/tools/ para revisar.\n');
    return;
  }

  const problemas = [];
  for (const nombre of archivos) {
    const hallazgos = await revisarArchivo(join(CARPETA, nombre));
    if (hallazgos.length) problemas.push({ nombre, hallazgos });
  }

  if (problemas.length === 0) {
    console.log(
      `\n  OK — revisé ${archivos.length} archivo${archivos.length === 1 ? '' : 's'} en public/tools/ y ninguno necesita internet para funcionar.\n`
    );
    return;
  }

  const total = problemas.reduce((n, p) => n + p.hallazgos.length, 0);

  console.error('\n══════════════════════════════════════════════════════════════');
  console.error('  ATENCIÓN: hay cosas que no van a funcionar sin internet');
  console.error('══════════════════════════════════════════════════════════════\n');
  console.error(
    `  Revisé ${archivos.length} archivo${archivos.length === 1 ? '' : 's'} y encontré ${total} referencia${total === 1 ? '' : 's'} a internet.`
  );
  console.error('  Si un atleta abre la calculadora sin señal, esas partes se rompen.\n');

  for (const { nombre, hallazgos } of problemas) {
    console.error(`  ── ARCHIVO: public/tools/${nombre}`);
    console.error('');
    for (const h of hallazgos) {
      console.error(`     Línea ${h.linea} — ${h.regla}`);
      console.error(`     Dice:      ${h.texto}`);
      console.error(`     Apunta a:  ${h.referencia}`);
      console.error(`     Problema:  ${h.problema}`);
      console.error(`     Arreglo:   ${h.arreglo}`);
      console.error('');
    }
  }

  console.error('  ──────────────────────────────────────────────────────────────');
  console.error('  La regla es simple: todo lo que la calculadora necesita tiene');
  console.error('  que estar adentro del archivo o en la carpeta public/.');
  console.error('  (Los enlaces <a href="..."> a otras webs no son problema: solo');
  console.error('   fallan si el usuario los hace clic, no rompen la calculadora.)\n');

  process.exit(1);
}

main().catch((e) => {
  console.error('\n  El validador se rompió solo. Detalle técnico:\n');
  console.error(e);
  process.exit(1);
});
