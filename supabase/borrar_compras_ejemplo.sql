-- =============================================================================
-- Borrar compras de EJEMPLO que no son operaciones reales
-- =============================================================================
--
-- Contexto: en el listado del dashboard aparecen rows como "CUR_1", "ICO_1",
-- "QUI_1", "Pic 83 machos · Ejemplo" — son cargas de testing que quedaron
-- en la DB y no corresponden a operaciones reales del cliente.
--
-- Las operaciones REALES siguen el formato `NN_YY` (correlativo del año):
--   1_26, 2_26, ..., 13_26, 14_26, ..., 16_26
-- Cualquier otro formato (con letras como prefijo, "Ejemplo" en obs, etc.)
-- es testing y se puede borrar.
--
-- ⚠️ NO ES IDEMPOTENTE en el sentido de que borra data — corré primero el
-- SELECT de preview para revisar qué se va a eliminar antes del DELETE.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 (PREVIEW) — listar lo que se va a borrar
-- ─────────────────────────────────────────────────────────────────────────────
-- Corré primero esto solo. Si la lista te parece OK, después corré el DELETE.

SELECT
  id,
  numero_operacion,
  fecha,
  consignado,
  cant_cab_y_cat,
  observaciones,
  CASE
    -- "CUR_1" / "ICO_1" / "QUI_1" / "COR_28" / "GVA_X" — formato viejo
    -- con letras de prefijo (3 letras = código del campo).
    WHEN numero_operacion ~ '^[A-Z]+_\d+$' THEN 'formato_viejo_letras'
    -- "Ejemplo" en cantCabYCat / observaciones — marca explícita de testing
    WHEN cant_cab_y_cat ILIKE '%ejemplo%'
      OR observaciones   ILIKE '%ejemplo%' THEN 'marca_ejemplo'
    -- Sin numero_operacion (NULL o vacío) y cargado por algún seed/test
    WHEN (numero_operacion IS NULL OR numero_operacion = '')
      AND id NOT LIKE 'compra-2026-%'      THEN 'sin_numero_operacion'
    ELSE 'desconocido'
  END AS motivo
FROM compras
WHERE cliente_id = 'ganaderas'
  AND (
    numero_operacion ~ '^[A-Z]+_\d+$'
    OR cant_cab_y_cat ILIKE '%ejemplo%'
    OR observaciones   ILIKE '%ejemplo%'
    OR (
      (numero_operacion IS NULL OR numero_operacion = '')
      AND id NOT LIKE 'compra-2026-%'
    )
  )
ORDER BY fecha DESC, numero_operacion;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 (DELETE) — si la lista de arriba está OK, ejecutar esto
-- ─────────────────────────────────────────────────────────────────────────────
-- Misma condición que el SELECT preview. La cláusula `cliente_id = 'ganaderas'`
-- limita el blast radius a un solo tenant — multi-tenant safety.
--
-- IMPORTANTE: descomentar las 14 líneas siguientes para ejecutar el DELETE
-- (las dejo comentadas para que no se borre nada accidentalmente al copiar
-- el archivo entero al SQL Editor).

-- DELETE FROM compras
-- WHERE cliente_id = 'ganaderas'
--   AND (
--     numero_operacion ~ '^[A-Z]+_\d+$'
--     OR cant_cab_y_cat ILIKE '%ejemplo%'
--     OR observaciones   ILIKE '%ejemplo%'
--     OR (
--       (numero_operacion IS NULL OR numero_operacion = '')
--       AND id NOT LIKE 'compra-2026-%'
--     )
--   );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3 (VERIFICACIÓN) — confirmar que solo quedan las 17 reales del Excel
-- ─────────────────────────────────────────────────────────────────────────────
-- Tras el DELETE deberías ver 17 rows (16 ops únicas: 1_26..16_26, donde
-- la 13_26 está partida en 2 jaulas → 13_26-a + 13_26-b).

SELECT
  COUNT(*)                            AS total,
  COUNT(DISTINCT numero_operacion)    AS ops_unicas,
  STRING_AGG(DISTINCT numero_operacion, ', ' ORDER BY numero_operacion) AS lista_ops
FROM compras
WHERE cliente_id = 'ganaderas';

-- Esperado:
--   total       = 17  (las 16 ops únicas del Excel + 13_26 partida)
--   ops_unicas  = 16
--   lista_ops   = "10_26, 11_26, 12_26, 13_26, 14_26, 15_26, 16_26, 1_26, 2_26, ..."
