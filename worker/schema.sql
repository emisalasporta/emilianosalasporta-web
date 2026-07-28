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
