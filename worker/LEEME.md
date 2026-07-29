# Los contadores de "me gusta" y de descargas

Esta carpeta **no es parte de la web**. La web se sigue publicando igual que
siempre (nginx sirviendo archivos estáticos). Esto de acá es un programita
aparte que vive en Cloudflare y se ocupa de lo único que un sitio estático no
puede hacer: **guardar un número y acordarse**.

## Por qué en Cloudflare y no en otro lado

Tu dominio ya pasa por Cloudflare. Un Worker se cuelga de **tu propio dominio**,
en `emilianosalasporta.cloud/api/*`. Para el que visita la web no hay ningún
servidor ajeno: le habla a tu dominio y a nadie más. Eso mantiene intacta la
regla del proyecto —la misma por la que las tipografías son propias y el video
de YouTube no carga hasta que alguien lo toca— y por eso **el sitio sigue sin
necesitar cartel de cookies**. Acá no se pone ninguna cookie ni se guarda
ninguna IP.

Con el plan gratuito de Cloudflare tenés 100.000 pedidos por día y 100.000
escrituras diarias en la base. Para tu escala eso es enorme: no lo vas a rozar,
y no hay tarjeta de por medio.

## YA ESTA PUESTO EN MARCHA (29 de julio de 2026)

Esto quedo configurado y funcionando. No hay que volver a hacerlo. Asi quedo:

| Cosa | Valor |
|---|---|
| Base D1 | `esp-contadores` — id `0a3ca92f-3357-4d5c-b00f-afc083eb4e49` |
| Tablas | `contadores`, `limites`, indice `limites_por_hora` |
| Worker | `contadores` |
| Binding | `DB` -> `esp-contadores` |
| Secreto | `SAL` (guardado, no se puede volver a ver) |
| Ruta | `emilianosalasporta.cloud/api/*` |
| Limpieza | cron `0 4 * * *`, todos los dias a las 4 UTC |

Probado en vivo: el boton suma, el numero queda guardado en la base y
sobrevive a recargar. La prueba se borro despues, asi que los contadores
arrancan en cero.

**Si algun dia hay que tocar el codigo del Worker**: se edita
`worker/src/index.js`, se sube al repositorio, y despues en el panel de
Cloudflare (Workers -> contadores -> Edit code) se pega la version nueva y
se le da Deploy. El Worker NO se actualiza solo con el deploy de la web:
son dos cosas separadas.

---

## Puesta en marcha desde cero (por si alguna vez hay que rehacerlo)

Todo se hace con clics en `dash.cloudflare.com`. **No hace falta instalar nada.**

### 1. Crear la base de datos

1. Entrá a `dash.cloudflare.com`.
2. En el menú de la izquierda: **Storage & Databases → D1 SQL Database**.
3. Botón **Create** (o *Create database*). Ponele de nombre `esp-contadores`.
4. Ya creada, entrá a la pestaña **Console**.
5. Abrí el archivo `schema.sql` de esta carpeta, copiá **todo** el contenido,
   pegalo ahí y dale a ejecutar.

Si te dice que creó las tablas, listo. Este paso no se repite nunca más.

### 2. Crear el Worker

1. Menú de la izquierda: **Compute (Workers) → Workers & Pages**.
2. **Create → Start with Hello World! → Deploy** (sí, se publica el ejemplo;
   lo reemplazamos en el paso siguiente). Ponele de nombre `contadores`.
3. Una vez creado, entrá y tocá **Edit code**.
4. Borrá todo lo que haya en el editor.
5. Abrí `src/index.js` de esta carpeta, copiá **todo** y pegalo ahí.
6. **Deploy**.

### 3. Conectarle la base

En el Worker: **Settings → Bindings → Add → D1 database**.

- **Variable name**: `DB` — tiene que decir exactamente eso, en mayúsculas.
- **D1 database**: `esp-contadores`.

Guardá. (Si te pide volver a publicar, publicá.)

### 4. La sal secreta (opcional pero recomendado)

En el Worker: **Settings → Variables and Secrets → Add → tipo Secret**.

- **Name**: `SAL`
- **Value**: cualquier frase larga inventada, cuanto más rara mejor. Por
  ejemplo algo del estilo `cerro-champaqui-1954-tortuga-violeta-88`.

Sirve para que las huellas anti-abuso no se puedan revertir a una IP ni
siquiera sabiendo cómo funciona el código. Si no lo ponés, todo anda igual;
sólo queda un poco menos protegido ese detalle.

> **No pongas esa frase en el repositorio.** Vive sólo en Cloudflare.

### 5. Decirle en qué dirección responde

En el Worker: **Settings → Domains & Routes → Add → Route**.

- **Route**: `emilianosalasporta.cloud/api/*`
- **Zone**: `emilianosalasporta.cloud`

Este es el paso que enchufa todo. Hasta acá el Worker existía pero nadie lo
llamaba.

### 6. La limpieza automática (opcional)

En el Worker: **Settings → Trigger Events → Add → Cron Trigger**, y poné
`0 4 * * *`. Una vez por día borra las huellas viejas de la tabla de límites,
que son descartables. Sin esto tampoco pasa nada grave: la tabla crece muy de
a poco.

### 7. Probar que quedó

Abrí en el navegador:

```
https://emilianosalasporta.cloud/api/contadores?ids=blog:2026-07-hidratacion-y-sales
```

Tiene que contestar algo así:

```json
{"blog:2026-07-hidratacion-y-sales":{"megusta":0,"descargas":0}}
```

Si contesta eso, ya está: entrá a cualquier nota y el botón va a aparecer solo.

## Y si algo sale mal

**El botón no aparece en ninguna nota.** Es el comportamiento a propósito
cuando la API no contesta: el sitio prefiere no mostrar nada antes que mostrar
algo roto. Probá la dirección del paso 7. Si da error, casi siempre es la ruta
(paso 5) o el nombre del binding (paso 3, tiene que ser `DB`).

**Dice "no such table".** Faltó el paso 1, o se creó el esquema en otra base
distinta de la que quedó atada al Worker.

**Quiero ver los números todos juntos.** En D1 → tu base → **Console**:

```sql
SELECT id, megusta, descargas FROM contadores ORDER BY megusta DESC;
```

## Publicar desde la computadora (alternativa)

Si algún día preferís no usar el panel, esta carpeta ya viene con
`wrangler.toml`. Con Node instalado:

```bash
cd worker
npx wrangler d1 create esp-contadores      # pegá el id que te da en wrangler.toml
npx wrangler d1 execute esp-contadores --remote --file=schema.sql
npx wrangler secret put SAL
npx wrangler deploy
```

Hace exactamente lo mismo que los pasos de arriba.
