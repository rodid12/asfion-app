-- =============================================================================
-- 0023 — Schema Integrity (renombrado de 0022 tras colisión 0021)
--   Resuelve items 9 + 15 + Q5/Q6/Q10 del audit del 27-jun-2026
-- =============================================================================
--
-- Resuelve:
--   1. FKs faltantes en pastoreo_ciclos, pariciones_resumen_servicio, tactos
--      y ndvi_pasturas — tenían `campo TEXT` denormalizado pero sin FK,
--      con riesgo de orphans si renombraban algún campo en la tabla `campos`.
--   2. Tipos numéricos sobredimensionados: `NUMERIC(12,2)` para kg totales
--      cuando entran en INTEGER. NUMERIC es 10× más lento que INTEGER en
--      Postgres.
--   3. Índices faltantes para `buscarCaravana` y `contarPariciones`.
--   4. Eliminar `clientes.stock_inicial JSONB` que duplica
--      `campos.stock_inicial_vacas`. Backfill antes de borrar.
--
-- Aplicación: idempotente. Si las tablas ya tienen campo_id (porque alguien
-- la corrió antes), no rompe.
-- =============================================================================

-- ============================================================================
-- 1) FK faltante en pastoreo_ciclos
-- ============================================================================
-- Ya tiene campo_id (declarado en 0018:42), pero falta NOT NULL constraint?
-- Lo dejamos opcional (nullable) porque algunos circuitos del Excel viejo
-- no matchean a ningún campo del seed.

-- Backfill desde campo_nombre cuando falte:
UPDATE pastoreo_ciclos pc
SET campo_id = c.id
FROM campos c
WHERE pc.campo_id IS NULL
  AND lower(trim(pc.campo_nombre)) = lower(trim(c.nombre))
  AND pc.cliente_id = c.cliente_id;

-- ============================================================================
-- 2) FK faltante en pariciones_resumen_servicio
-- ============================================================================
-- 0020 declaró `campo TEXT NOT NULL` pero sin FK. Agregamos campo_id
-- como columna nullable + backfill desde el TEXT.

ALTER TABLE pariciones_resumen_servicio
  ADD COLUMN IF NOT EXISTS campo_id TEXT REFERENCES campos(id) ON DELETE SET NULL;

UPDATE pariciones_resumen_servicio prs
SET campo_id = c.id
FROM campos c
WHERE prs.campo_id IS NULL
  AND lower(trim(prs.campo)) = lower(trim(c.nombre))
  AND prs.cliente_id = c.cliente_id;

-- ============================================================================
-- 3) FK faltante en tactos (preñez)
-- ============================================================================
-- 0012 declaró `campo TEXT` sin FK.

ALTER TABLE tactos
  ADD COLUMN IF NOT EXISTS campo_id TEXT REFERENCES campos(id) ON DELETE SET NULL;

UPDATE tactos t
SET campo_id = c.id
FROM campos c
WHERE t.campo_id IS NULL
  AND lower(trim(t.campo)) = lower(trim(c.nombre))
  AND t.cliente_id = c.cliente_id;

-- ============================================================================
-- 4) FK faltante en ndvi_pasturas
-- ============================================================================
-- 0009 declaró `campo TEXT`, `circuito TEXT` sin FKs.

ALTER TABLE ndvi_pasturas
  ADD COLUMN IF NOT EXISTS campo_id TEXT REFERENCES campos(id) ON DELETE SET NULL;

UPDATE ndvi_pasturas n
SET campo_id = c.id
FROM campos c
WHERE n.campo_id IS NULL
  AND lower(trim(n.campo)) = lower(trim(c.nombre))
  AND n.cliente_id = c.cliente_id;

-- ============================================================================
-- 5) Índices faltantes para queries frecuentes
-- ============================================================================
-- Q5: buscarCaravana (asfion-app/src/data/backends/supabase.ts:606-628)
-- hace SELECT … WHERE caravana_color = ? AND caravana_numero = ? AND
-- cliente_id = X (via RLS). Sin índice hace seq scan sobre toda pariciones.
CREATE INDEX IF NOT EXISTS pariciones_caravana_idx
  ON pariciones (cliente_id, caravana_color, caravana_numero)
  WHERE caravana_numero IS NOT NULL;

-- Q6: contarPariciones (supabase.ts:597-604) filtra por usuario_email + fecha
-- — útil para el badge HOY / SEMANA del HomeScreen mobile.
CREATE INDEX IF NOT EXISTS pariciones_usuario_fecha_idx
  ON pariciones (cliente_id, usuario_email, fecha DESC);

-- Bonus: pariciones_resumen_servicio queries siempre filtran por
-- (cliente_id, servicio_anio) — agregamos índice compuesto.
CREATE INDEX IF NOT EXISTS par_resumen_cliente_anio_idx
  ON pariciones_resumen_servicio (cliente_id, servicio_anio DESC);

-- ============================================================================
-- 6) Tipos numéricos: NUMERIC → INTEGER donde corresponde
-- ============================================================================
-- pastoreo_ciclos.kg_totales_carne_* declarados como NUMERIC(12,2) para
-- valores que en la práctica son ~170.000 enteros — entran en INTEGER
-- y son ~10× más rápidos en cómputo.
--
-- IMPORTANTE: usamos ALTER COLUMN … TYPE INTEGER USING ROUND(col)::INTEGER
-- para conservar el data existente, pero el cast PIERDE decimales — si
-- algún valor tiene precisión sub-kilo se redondea. Los datos actuales del
-- Excel ya vienen como enteros redondeados, así que no perdemos info real.

ALTER TABLE pastoreo_ciclos
  ALTER COLUMN kg_totales_carne_ingreso  TYPE INTEGER USING ROUND(kg_totales_carne_ingreso)::INTEGER,
  ALTER COLUMN kg_totales_carne_control  TYPE INTEGER USING ROUND(kg_totales_carne_control)::INTEGER,
  ALTER COLUMN kg_totales_carne_final    TYPE INTEGER USING ROUND(kg_totales_carne_final)::INTEGER;

-- Porcentajes en pariciones_resumen_servicio: NUMERIC(6,4) → REAL (float4)
-- baja el espacio de 8 bytes a 4 y elimina el costo de NUMERIC. La precisión
-- de float4 es ~7 dígitos significativos — más que suficiente para
-- mostrar "0.8881" como 88.81%.
ALTER TABLE pariciones_resumen_servicio
  ALTER COLUMN merma_tr_paricion          TYPE REAL USING merma_tr_paricion::REAL,
  ALTER COLUMN merma_tr_destete           TYPE REAL USING merma_tr_destete::REAL,
  ALTER COLUMN pct_abortos_npt            TYPE REAL USING pct_abortos_npt::REAL,
  ALTER COLUMN pct_mort_vientres          TYPE REAL USING pct_mort_vientres::REAL,
  ALTER COLUMN pct_mort_tern_senalados    TYPE REAL USING pct_mort_tern_senalados::REAL,
  ALTER COLUMN pct_mort_tern_sin_senal    TYPE REAL USING pct_mort_tern_sin_senal::REAL,
  ALTER COLUMN pct_destete_sobre_prenado  TYPE REAL USING pct_destete_sobre_prenado::REAL;

-- ============================================================================
-- 7) Eliminar clientes.stock_inicial JSONB (duplicado de campos.stock_inicial_vacas)
-- ============================================================================
-- 0001_init.sql:44 lo declaró cuando todavía no existía la columna en campos.
-- Después la lógica se movió a campos.stock_inicial_vacas (que sí tiene FK
-- al campo y se puede modificar desde el panel admin). El JSONB en clientes
-- quedó como dead column.
--
-- Backfill antes de borrar: si algún cliente tiene data en el JSONB que
-- NO está en campos.stock_inicial_vacas, la copiamos.
--
-- IMPORTANTE: el DO block solo corre si la columna `clientes.stock_inicial`
-- realmente existe — en algunas DBs nunca llegó a crearse (instalación
-- desde 0004+ sin la 0001 original, o ya se borró manualmente). Sin este
-- chequeo el SELECT fallaba con "column stock_inicial does not exist".
DO $$
DECLARE
  c RECORD;
  k TEXT;
  v INTEGER;
  col_existe BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'stock_inicial'
  ) INTO col_existe;

  IF NOT col_existe THEN
    RAISE NOTICE 'columna clientes.stock_inicial no existe — salto backfill y drop';
    RETURN;
  END IF;

  -- EXECUTE dinámico para que el parser no intente resolver `c.stock_inicial`
  -- hasta el runtime (cuando ya sabemos que la columna existe).
  FOR c IN EXECUTE 'SELECT id, stock_inicial FROM clientes WHERE stock_inicial IS NOT NULL AND stock_inicial::TEXT <> ''{}''' LOOP
    FOR k, v IN SELECT key, (value::TEXT)::INTEGER FROM jsonb_each(c.stock_inicial) LOOP
      UPDATE campos
      SET stock_inicial_vacas = v
      WHERE id = k
        AND cliente_id = c.id
        AND stock_inicial_vacas IS NULL;
    END LOOP;
  END LOOP;
END $$;

-- Y por fin la dropeamos (idempotente — si no existe, no falla).
ALTER TABLE clientes DROP COLUMN IF EXISTS stock_inicial;

-- =============================================================================
-- Sanity checks post-aplicación:
--
--   SELECT COUNT(*) AS huerfanos FROM pastoreo_ciclos
--   WHERE campo_id IS NULL;  -- Esperado: 0 o bajo (los que no matchean)
--
--   \d pastoreo_ciclos    -- verificar kg_totales_carne_* es INTEGER
--   \d clientes           -- verificar que stock_inicial ya no está
--   \di pariciones*       -- verificar 2 índices nuevos
-- =============================================================================
