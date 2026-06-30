-- =============================================================================
-- 0024 — Compras: coherencia kg_destino ↔ merma + kg_corregidos
-- =============================================================================
--
-- Audit del 29-jun-2026 item N5: después de que `0021_compras_kg_destino_nullable`
-- hizo `kg_netos_destino` NULLABLE, no quedó constraint que asegure consistencia.
-- Es posible (vía API directa o bug de form) guardar filas como:
--    kg_netos_destino IS NULL  AND  merma_porcentaje = 5.0   ← INCOHERENTE
-- "Sin pesaje destino" pero "con merma calculada" — una negando a la otra.
--
-- Esta constraint declara la regla de negocio: si NO hay peso destino,
-- merma_porcentaje y kg_corregidos también tienen que ser NULL (porque
-- ambos se derivan de tener un destino). Si SÍ hay destino, ambos pueden
-- estar seteados o no, sin restricción adicional.
--
-- Defense in depth — el form ya valida esto, pero un cliente HTTP custom
-- (curl, python) podría saltarse el form. Constraint a nivel DB es la
-- última línea.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Si la constraint falla porque hay rows incoherentes existentes,
--      revisarlas con la query del paso 4 antes de re-correr.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Paso 0 — Defensivo: si ya existe una constraint con el mismo nombre la
-- tiramos para que la migración sea idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_destino_merma_coherente;

-- ─────────────────────────────────────────────────────────────────────────────
-- Paso 1 — Limpiar rows existentes con merma_porcentaje o kg_corregidos
-- seteados pero kg_destino NULL (data inconsistente que vendría a romper
-- el ADD CONSTRAINT). Las 2 jaulas del 0013-26 ya tienen merma=NULL (mig
-- 0021 las cargó así), pero por defensa hacemos un UPDATE no-op.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE compras
SET merma_porcentaje = NULL,
    kg_corregidos    = NULL
WHERE kg_netos_destino IS NULL
  AND (merma_porcentaje IS NOT NULL OR kg_corregidos IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- Paso 2 — Constraint nueva
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE compras
  ADD CONSTRAINT compras_destino_merma_coherente
  CHECK (
    -- Sin destino → ni merma ni kg_corregidos
    (kg_netos_destino IS NULL
       AND merma_porcentaje IS NULL
       AND kg_corregidos IS NULL)
    OR
    -- Con destino → todo el resto puede o no estar (lógica del form)
    (kg_netos_destino IS NOT NULL)
  );

COMMENT ON CONSTRAINT compras_destino_merma_coherente ON compras IS
  'Si kg_netos_destino es NULL (jaula en tránsito sin pesaje destino), '
  'merma_porcentaje y kg_corregidos también tienen que ser NULL — no se '
  'puede derivar merma sin tener kg destino real. Agregada por audit N5.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación esperada tras correr:
--   SELECT COUNT(*) FROM compras
--     WHERE kg_netos_destino IS NULL
--       AND (merma_porcentaje IS NOT NULL OR kg_corregidos IS NOT NULL);
--   → 0   (la constraint lo impide a futuro)
-- =============================================================================
