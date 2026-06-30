-- =============================================================================
-- 0025 — Eliminar índices muertos en pastoreo_ciclos
-- =============================================================================
--
-- Audit del 29-jun-2026 item N10: la migración 0018 creó 4 índices sobre
-- pastoreo_ciclos:
--   1. idx_pastoreo_ciclos_cliente   (cliente_id)
--   2. idx_pastoreo_ciclos_campo     (cliente_id, campo_nombre)
--   3. idx_pastoreo_ciclos_cat       (cliente_id, categoria)
--   4. idx_pastoreo_ciclos_ingreso   (cliente_id, fecha_ingreso DESC)
--
-- Pero el dashboard hace `select * order by fecha_ingreso` (en `fetchPastoreoCiclos`)
-- y después filtra TODO client-side. Los 3 primeros nunca se usan en queries
-- — solo agregan costo de write (cada INSERT actualiza 4 índices en vez de 1).
--
-- Mantenemos `idx_pastoreo_ciclos_ingreso` porque el ORDER BY lo aprovecha
-- para no hacer sort en memoria. Borramos los otros 3.
--
-- Impacto esperado: ~25% menos latencia de write sobre la tabla. Read es
-- idéntico (los índices borrados no se usaban).
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Verificar con `\di pastoreo_ciclos_*` o
--        SELECT indexname FROM pg_indexes WHERE tablename='pastoreo_ciclos';
-- =============================================================================

DROP INDEX IF EXISTS idx_pastoreo_ciclos_cliente;
DROP INDEX IF EXISTS idx_pastoreo_ciclos_campo;
DROP INDEX IF EXISTS idx_pastoreo_ciclos_cat;

-- idx_pastoreo_ciclos_ingreso se mantiene — lo usa el ORDER BY del fetcher.

-- =============================================================================
-- Verificación:
--   SELECT indexname FROM pg_indexes WHERE tablename='pastoreo_ciclos';
--   → Debería listar solo: pastoreo_ciclos_pkey, idx_pastoreo_ciclos_ingreso
-- =============================================================================
