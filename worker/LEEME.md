# Los contadores, y el buzón de preguntas

Esta carpeta **no es parte de la web**. La web se sigue publicando igual que
siempre (nginx sirviendo archivos estáticos). Esto de acá es un programita
aparte que vive en Cloudflare y se ocupa de lo único que un sitio estático no
puede hacer: **guardar algo y acordarse**. Hoy hace dos cosas: lleva los
contadores de "me gusta" y de descargas, y **recibe los mensajes del
formulario de `/contacto`**.

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

# EL FORMULARIO DE CONTACTO — lo que falta hacer (agosto de 2026)

El formulario ya está en la web (`/contacto`, y un enlace al final de cada nota
y de cada recurso). Para que empiece a funcionar de verdad **hay que hacer una
sola cosa sí o sí**, y dos que son opcionales pero convienen. Todo con clics,
nada de instalar programas.

## 1. Poner al día el Worker (obligatorio)

1. Entrá a `dash.cloudflare.com` → **Compute (Workers) → Workers & Pages →
   contadores → Edit code**.
2. Borrá todo lo que haya en el editor.
3. Abrí `worker/src/index.js` de esta carpeta, copiá **todo** y pegalo ahí.
4. **Deploy**.

Con esto solo, el formulario **ya guarda los mensajes**. La tabla nueva de la
base se crea sola con el primer mensaje que llegue: no hace falta correr nada
en la consola de D1. (Si igual querés correrlo, `schema.sql` la tiene, y está
escrito para que se pueda ejecutar de nuevo sin romper lo que ya existe.)

Lo que todavía no pasa sin los pasos que siguen: **el aviso por mail**, y
**poder leer los mensajes desde el celular**.

## 2. El aviso por mail (recomendado)

Sin esto los mensajes se guardan igual, pero nadie te avisa que llegaron.

1. Creá una cuenta gratis en **resend.com** (el plan gratis da 3.000 mails por
   mes; vas a usar unos pocos). Registrate **con tu Gmail de siempre**, porque
   sin dominio propio verificado Resend solo deja mandarse mails **a la casilla
   del dueño de la cuenta** — que es justo lo que necesitamos acá.
2. En Resend: **API Keys → Create API Key**. Copiá la clave que te da (empieza
   con `re_`). **Se ve una sola vez.**
3. En Cloudflare, en el Worker `contadores`: **Settings → Variables and
   Secrets → Add**, y cargá estos dos, los dos de tipo **Secret**:

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | la clave que copiaste (`re_...`) |
   | `MAIL_DESTINO` | `emilianosalas85@gmail.com` |

4. Deploy si te lo pide.

Desde ese momento, cada mensaje te llega al Gmail. **Le podés dar Responder
directamente**: el mail viene preparado para que la respuesta le llegue a la
persona que escribió, sin copiar direcciones de ningún lado.

> Si algún día querés que los avisos salgan desde una dirección tuya
> (`web@emilianosalasporta.cloud`) en vez de la de prueba de Resend, hay que
> verificar el dominio en Resend (te pide agregar unos registros en Cloudflare)
> y después sumar una tercera variable, `MAIL_DESDE`, con esa dirección. No
> hace falta para que ande.

## 3. La bandeja para leer los mensajes (recomendado)

Es una página simple con todos los mensajes, para abrir desde el celular sin
entrar al panel de Cloudflare. Sirve además de respaldo el día que el mail
falle.

1. En el Worker: **Settings → Variables and Secrets → Add → tipo Secret**.
   - **Name**: `CLAVE_BANDEJA`
   - **Value**: una frase larga inventada, sin espacios ni tildes. Por ejemplo
     `mis-mensajes-cerro-champaqui-7741`.
2. Deploy si te lo pide.
3. Guardate en favoritos esta dirección, con tu frase al final:

   ```
   https://emilianosalasporta.cloud/api/preguntas?clave=TU-FRASE-ACA
   ```

**Esa dirección es la llave: quien la tenga entra.** No la pegues en ningún
lado público. Si se te escapa, cambiá el secreto en Cloudflare y listo: la
dirección vieja deja de funcionar al instante. Mientras no cargues
`CLAVE_BANDEJA`, esa página directamente no existe (contesta 404 a todo el
mundo, con clave o sin ella).

## Cómo está frenado el spam

Sin cuentas, sin CAPTCHA y sin cargarle nada al que escribe:

- **Un campo invisible** que ninguna persona ve ni completa. Si viene lleno, es
  un robot: el mensaje se descarta y al robot se le contesta que salió todo
  bien, para que no vuelva a probar de otra forma.
- **El reloj**: si el formulario se completó y se mandó en menos de dos
  segundos y medio, es un programa. Mismo trato.
- **Cinco mensajes por hora** desde la misma conexión. El sexto rebota con un
  cartel que dice que pruebe más tarde.
- **Solo se aceptan pedidos que vengan de tu web**, no de otro sitio.

Si alguna vez pasa spam igual, lo primero que se toca es el tope de cinco
(`TOPE_MENSAJES_POR_HORA`, arriba de todo en `src/index.js`).

## Y si algo del formulario sale mal

**Alguien dice que escribió y no me llegó nada.** Mirá primero la bandeja
(paso 3): si el mensaje está ahí, lo que falló es el mail (paso 2), no el
formulario. Los mensajes se guardan **antes** de mandarse justamente para que
esto no sea una pérdida.

**El formulario dice "no pude enviarlo".** El Worker está caído o no se subió
la versión nueva (paso 1). Probá abrir
`https://emilianosalasporta.cloud/api/contadores?ids=blog:x`: si eso tampoco
contesta, es el Worker entero, no el formulario.

**Quiero ver los mensajes en la base.** En D1 → `esp-contadores` → **Console**:

```sql
SELECT creado, nombre, mail, tema, mensaje FROM preguntas ORDER BY creado DESC;
```

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
