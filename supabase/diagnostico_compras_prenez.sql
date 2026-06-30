-- =============================================================================
-- Script de diagnóstico — Compras + Preñez
-- =============================================================================
-- Correr en Supabase Dashboard → SQL Editor.
-- NO modifica nada — solo lee. Sirve para entender qué falta cargado.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CUÁNTAS COMPRAS HAY EN LA DB
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado tras correr 0017 (versión actual, con fix dup 0013):
--   total = 17  (16 IDs únicos antes del fix, 17 después)
--   ops únicas en Excel = 16 (porque 0013-26 viene partida en 2 jaulas)

SELECT
  COUNT(*)                            AS total_compras,
  COUNT(DISTINCT numero_operacion)    AS ops_unicas,
  MIN(fecha)                          AS primera_compra,
  MAX(fecha)                          AS ultima_compra,
  SUM(COALESCE(total_machos,  0) + COALESCE(total_hembras, 0))  AS cabezas_total,
  ROUND(SUM(COALESCE(precio,0) * COALESCE(kg_netos_destino, kg_netos_origen, 0))) AS inversion_estimada
FROM compras
WHERE cliente_id = 'ganaderas';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LISTA DE TODAS LAS COMPRAS (para chequear visualmente con el Excel)
-- ─────────────────────────────────────────────────────────────────────────────
-- Compará con la Hoja 2 del Excel "cierre pastoreo 26(2).xlsx" — deberían
-- ser 17 filas: 0001-26 a 0016-26 + la 0013 partida en 2 (= 17 rows totales).

SELECT
  numero_operacion,
  fecha,
  consignado,
  cant_cab_y_cat,
  total_machos,
  total_hembras,
  ROUND(kg_netos_origen)  AS kg_origen,
  ROUND(kg_netos_destino) AS kg_destino,
  precio,
  plazo
FROM compras
WHERE cliente_id = 'ganaderas'
ORDER BY fecha, numero_operacion;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. QUÉ OPERACIONES FALTAN respecto al Excel
-- ─────────────────────────────────────────────────────────────────────────────
-- Si esta query devuelve filas, esas son las que el Excel tiene y la DB no.

WITH esperadas (op) AS (VALUES
  ('1_26'),  ('2_26'),  ('3_26'),  ('4_26'),  ('5_26'),
  ('6_26'),  ('7_26'),  ('8_26'),  ('9_26'),  ('10_26'),
  ('11_26'), ('12_26'), ('13_26'), ('14_26'), ('15_26'), ('16_26')
)
SELECT esperadas.op AS faltante_en_db
FROM esperadas
LEFT JOIN compras c
  ON c.cliente_id = 'ganaderas'
 AND c.numero_operacion = esperadas.op
WHERE c.id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PREÑEZ — tactos cargados
-- ─────────────────────────────────────────────────────────────────────────────
-- El módulo Preñez del dashboard usa la tabla `tactos`. Mig 0012 cargó 7
-- rodeos (de los datos de Agus en el Power BI).
--
-- Si la query devuelve 0, no corriste mig 0012.

SELECT
  rodeo,
  origen_total,
  prenez_cabeza + prenez_cuerpo + prenez_cola AS prenadas,
  vacias,
  ROUND((prenez_cabeza + prenez_cuerpo + prenez_cola)::NUMERIC
        / NULLIF(origen_total, 0) * 100, 1) AS pct_prenez
FROM tactos
WHERE cliente_id = 'ganaderas'
ORDER BY rodeo;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PREÑEZ — datos del Excel Hoja 3 que tampoco están en `tactos`
-- ─────────────────────────────────────────────────────────────────────────────
-- La Hoja 3 trae 6 tropas con preñadas, pero las cargamos en
-- `pariciones_resumen_servicio` (mig 0020) — esa tabla la lee la tab
-- Pariciones, NO la tab Preñez. Si querés ver esos datos también en la
-- tab Preñez, hay que cablear la PrenezPage al fetcher de resumen_servicio.

SELECT
  campo,
  tropa,
  prenadas,
  vacias_retacto,
  npt_abortos_retacto,
  mortandad_vientres,
  terneros_vivos
FROM pariciones_resumen_servicio
WHERE cliente_id = 'ganaderas'
ORDER BY campo, tropa;
