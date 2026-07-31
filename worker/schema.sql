-- ============================================================
--  Las dos tablas de los contadores.
--  Se corre UNA sola vez, al crear la base. Ver LEEME.md.
-- ============================================================

-- Una fila por nota o por recurso. El id es "blog:mi-nota" o "recurso:plan-5k".
-- Las dos cuentas viven juntas para que pintar una pagina sea una sola consulta.
CREATE TABLE IF NOT EXISTS contadores (
  id        TEXT    PRIMARY KEY,
  megusta   INTEGER NOT NULL DEFAULT 0,
  descargas INTEGER NOT NULL DEFAULT 0
);

-- Freno anti-abuso. NO guarda IPs: guarda el SHA-256 de (IP + sal + hora).
-- Del hash no se vuelve a la IP, y como la hora entra en la cuenta, cada
-- huella deja de servir sola a los 60 minutos.
CREATE TABLE IF NOT EXISTS limites (
  huella TEXT    PRIMARY KEY,
  n      INTEGER NOT NULL DEFAULT 0,
  hora   INTEGER NOT NULL
);

-- Para poder barrer lo viejo rapido (ver la tarea de limpieza en LEEME.md).
CREATE INDEX IF NOT EXISTS limites_por_hora ON limites (hora);

-- ============================================================
--  El buzon del formulario de /contacto (agosto de 2026).
--
--  Los mensajes se guardan ACA ADEMAS de mandarse por mail. Es a
--  proposito: si algun dia el mail falla --se vencio la cuenta, se
--  cayo el servicio-- el mensaje ya esta a salvo y se puede leer.
--  Un mail que no salio seria un mensaje perdido para siempre, y
--  encima la persona que escribio creeria que llego.
--
--  Esta tabla NO se limpia sola. Son pocas filas y son lo unico
--  irrecuperable que hay en esta base.
-- ============================================================
CREATE TABLE IF NOT EXISTS preguntas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  creado     INTEGER NOT NULL,          -- segundos desde 1970 (UTC)
  nombre     TEXT    NOT NULL,
  mail       TEXT    NOT NULL,
  tema       TEXT,
  mensaje    TEXT    NOT NULL,
  referencia TEXT                       -- de que nota o recurso venia
);

-- La bandeja se lee siempre del mas nuevo al mas viejo.
CREATE INDEX IF NOT EXISTS preguntas_por_fecha ON preguntas (creado DESC);
