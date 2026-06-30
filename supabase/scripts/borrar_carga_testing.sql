-- ASFION — Script de borrado para datos de testing.
--
-- Uso: tu amigo y vos estuvieron probando la app ayer y cargaron eventos
-- de prueba. Queremos sacar esos rows y dejar solo data real.
--
-- IMPORTANTE: filtra por `created_at` (cuándo se cargó al server),
-- NO por `fecha` (cuándo ocurrió el evento). Razón: si el operario carga
-- HOY un evento de hace un mes, ese row NO es testing y no debe borrarse;
-- por el contrario, si cargó AYER un evento con fecha de hace un año,
-- SÍ es testing y se borra.
--
-- Tablas afectadas: pariciones, mortandad, pastoreo, lluvias, compras,
-- tactos. NO toca campos, lotes, circuitos, usuarios, clientes (catálogos).
--
-- =============================================================================
-- INSTRUCCIONES
-- =============================================================================
--
-- 1. Editá las fechas en el bloque PARAMETROS (línea ~30). Usá zona AR
--    (UTC-3) — el sufijo `-03` lo aplica solo.
-- 2. Corré PRIMERO el bloque PREVIEW (PASO 1). Te dice cuántos rows tocaría.
-- 3. Si los counts te cuadran, descomentá el BEGIN/COMMIT del PASO 2
--    y corré. Hasta que descomentes, el delete NO se ejecuta.
--
-- =============================================================================
-- PARAMETROS (editá acá)
-- =============================================================================

-- Ejemplo: borrar todo lo cargado el 25/06/2026 (zona AR).
--   desde = 2026-06-25 00:00 ART
--   hasta = 2026-06-26 00:00 ART (= inicio del día siguiente, exclusive)
--
-- Para "ayer" en general, cambiá las dos fechas a [ayer 00:00, hoy 00:00].

-- =============================================================================
-- PASO 1: PREVIEW — corré esto primero
-- =============================================================================

WITH params AS (
  SELECT
    '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
    '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
    'ganaderas'::TEXT AS cliente_id
)
SELECT 'pariciones' AS tabla, COUNT(*) AS rows_a_borrar
FROM pariciones, params
WHERE pariciones.cliente_id = params.cliente_id
  AND pariciones.created_at >= params.desde
  AND pariciones.created_at <  params.hasta
UNION ALL
SELECT 'mortandad', COUNT(*) FROM mortandad, params
WHERE mortandad.cliente_id = params.cliente_id
  AND mortandad.created_at >= params.desde
  AND mortandad.created_at <  params.hasta
UNION ALL
SELECT 'pastoreo', COUNT(*) FROM pastoreo, params
WHERE pastoreo.cliente_id = params.cliente_id
  AND pastoreo.created_at >= params.desde
  AND pastoreo.created_at <  params.hasta
UNION ALL
SELECT 'lluvias', COUNT(*) FROM lluvias, params
WHERE lluvias.cliente_id = params.cliente_id
  AND lluvias.created_at >= params.desde
  AND lluvias.created_at <  params.hasta
UNION ALL
SELECT 'compras', COUNT(*) FROM compras, params
WHERE compras.cliente_id = params.cliente_id
  AND compras.created_at >= params.desde
  AND compras.created_at <  params.hasta
UNION ALL
SELECT 'tactos', COUNT(*) FROM tactos, params
WHERE tactos.cliente_id = params.cliente_id
  AND tactos.created_at >= params.desde
  AND tactos.created_at <  params.hasta
ORDER BY tabla;

-- Si querés ver los rows individuales antes de borrar, descomentá
-- alguno de estos (por tabla) para inspeccionar:
--
-- SELECT id, fecha, campo_id, usuario_email, evento, created_at
-- FROM pariciones
-- WHERE cliente_id = 'ganaderas'
--   AND created_at >= '2026-06-25 00:00:00-03'::TIMESTAMPTZ
--   AND created_at <  '2026-06-26 00:00:00-03'::TIMESTAMPTZ
-- ORDER BY created_at;


-- =============================================================================
-- PASO 2: DELETE — DESCOMENTAR el bloque BEGIN/COMMIT abajo cuando los
-- counts del paso 1 estén OK.
-- =============================================================================
--
-- BEGIN;
--
-- WITH params AS (
--   SELECT
--     '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
--     '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
--     'ganaderas'::TEXT AS cliente_id
-- )
-- DELETE FROM pariciones USING params
-- WHERE pariciones.cliente_id = params.cliente_id
--   AND pariciones.created_at >= params.desde
--   AND pariciones.created_at <  params.hasta;
--
-- WITH params AS (
--   SELECT '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
--          '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
--          'ganaderas'::TEXT AS cliente_id
-- )
-- DELETE FROM mortandad USING params
-- WHERE mortandad.cliente_id = params.cliente_id
--   AND mortandad.created_at >= params.desde
--   AND mortandad.created_at <  params.hasta;
--
-- WITH params AS (
--   SELECT '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
--          '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
--          'ganaderas'::TEXT AS cliente_id
-- )
-- DELETE FROM pastoreo USING params
-- WHERE pastoreo.cliente_id = params.cliente_id
--   AND pastoreo.created_at >= params.desde
--   AND pastoreo.created_at <  params.hasta;
--
-- WITH params AS (
--   SELECT '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
--          '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
--          'ganaderas'::TEXT AS cliente_id
-- )
-- DELETE FROM lluvias USING params
-- WHERE lluvias.cliente_id = params.cliente_id
--   AND lluvias.created_at >= params.desde
--   AND lluvias.created_at <  params.hasta;
--
-- WITH params AS (
--   SELECT '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
--          '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
--          'ganaderas'::TEXT AS cliente_id
-- )
-- DELETE FROM compras USING params
-- WHERE compras.cliente_id = params.cliente_id
--   AND compras.created_at >= params.desde
--   AND compras.created_at <  params.hasta;
--
-- WITH params AS (
--   SELECT '2026-06-25 00:00:00-03'::TIMESTAMPTZ AS desde,
--          '2026-06-26 00:00:00-03'::TIMESTAMPTZ AS hasta,
--          'ganaderas'::TEXT AS cliente_id
-- )
-- DELETE FROM tactos USING params
-- WHERE tactos.cliente_id = params.cliente_id
--   AND tactos.created_at >= params.desde
--   AND tactos.created_at <  params.hasta;
--
-- -- Si los counts post-delete son los esperados → COMMIT.
-- -- Si te equivocaste de fecha → ROLLBACK (en lugar de COMMIT).
-- COMMIT;
--
-- =============================================================================
-- NOTAS
-- =============================================================================
--
-- - Los datos seedeados via migration 0002 (~2.500 pariciones del piloto
--   Ganaderas) tienen created_at del DÍA QUE SE APLICÓ la migración, NO
--   de la fecha real del evento. Si la migración corrió hace tiempo, las
--   fechas viejas NO se borran. Si la corriste hoy, ojo: están en este
--   rango y se borrarían. Mirá el preview antes de descomentar el DELETE.
--
-- - El DELETE es por cliente_id — si tenés más de un tenant en la DB,
--   los datos de otros NO se tocan. Ajustá `'ganaderas'` si sos otro.
--
-- - Los archivos en Storage (fotos de eventos) NO se borran con este
--   script. Si lo necesitás, hay que hacer un DELETE separado sobre
--   storage.objects (ojo: irreversible).
