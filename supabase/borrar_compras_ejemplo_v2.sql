-- =============================================================================
-- Borrar compras EXTRA — segunda pasada (v2)
-- =============================================================================
--
-- La primera pasada (borrar_compras_ejemplo.sql) borró los rows con formato
-- viejo "CUR_1" / "ICO_1" / "QUI_1", pero quedaron:
--   - 1 row con `numero_operacion='Pic'` (formato raro, no matchea ^[A-Z]+_\d+$)
--   - 3 rows con formato `NN_YY` correcto pero que NO son del seed real
--
-- Esta v2 hace whitelist explícita: solo conservamos los 17 IDs del seed
-- de la migración 0021_compras_kg_destino_nullable.sql. Cualquier otro
-- row de Ganaderas se borra.
--
-- ⚠️ NO ES IDEMPOTENTE — corré primero el PASO 1 para ver qué se va a borrar.
--    Si el operario cargó compras NUEVAS desde la app (con UUIDs random),
--    también caen — porque NO empiezan con `compra-2026-`. Si querés
--    conservar esas, ajustar la cláusula `id NOT LIKE ...` antes del DELETE.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 (PREVIEW) — qué rows están de más respecto a los 17 esperados
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  id,
  numero_operacion,
  fecha,
  consignado,
  cant_cab_y_cat,
  observaciones,
  CASE
    WHEN numero_operacion !~ '^\d+_\d{2}$'  THEN 'numero_operacion_invalido'
    WHEN id NOT LIKE 'compra-2026-%'        THEN 'id_no_es_del_seed'
    ELSE 'otro'
  END AS motivo
FROM compras
WHERE cliente_id = 'ganaderas'
  AND id NOT IN (
    'compra-2026-001','compra-2026-002','compra-2026-003','compra-2026-004',
    'compra-2026-005','compra-2026-006','compra-2026-007','compra-2026-008',
    'compra-2026-009','compra-2026-010','compra-2026-011','compra-2026-012',
    'compra-2026-013-a','compra-2026-013-b',
    'compra-2026-014','compra-2026-015','compra-2026-016'
  )
ORDER BY fecha DESC, numero_operacion;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 (DELETE) — borra TODO lo que no esté en la whitelist de 17
-- ─────────────────────────────────────────────────────────────────────────────
-- Descomentar las 9 líneas siguientes después de revisar el PREVIEW.
--
-- ⚠️ SI HAY COMPRAS REALES CARGADAS POR LA APP (UUIDs random tipo
-- '7f3c9a1d-...'), también se borran. Si querés conservarlas, agregá
-- otra cláusula al WHERE: `AND id NOT LIKE '________-____-____-____-____________'`

-- DELETE FROM compras
-- WHERE cliente_id = 'ganaderas'
--   AND id NOT IN (
--     'compra-2026-001','compra-2026-002','compra-2026-003','compra-2026-004',
--     'compra-2026-005','compra-2026-006','compra-2026-007','compra-2026-008',
--     'compra-2026-009','compra-2026-010','compra-2026-011','compra-2026-012',
--     'compra-2026-013-a','compra-2026-013-b',
--     'compra-2026-014','compra-2026-015','compra-2026-016'
--   );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3 (VERIFICACIÓN) — confirma 17 rows con 16 ops únicas
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  COUNT(*)                            AS total,
  COUNT(DISTINCT numero_operacion)    AS ops_unicas,
  STRING_AGG(DISTINCT numero_operacion, ', ' ORDER BY numero_operacion) AS lista_ops
FROM compras
WHERE cliente_id = 'ganaderas';

-- Esperado:
--   total       = 17
--   ops_unicas  = 16
--   lista_ops   = "10_26, 11_26, 12_26, 13_26, 14_26, 15_26, 16_26, 1_26, 2_26, 3_26, 4_26, 5_26, 6_26, 7_26, 8_26, 9_26"
