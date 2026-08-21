-- =============================================================================
-- 0033 — Ganaderas: actualización del resumen parcial de tactos 2026
-- =============================================================================
-- Fuente: captura del Excel "RESUMEN PARCIAL DE TACTOS 2026" recibida
-- el 20/08/2026 y contrastada contra el estado real de Supabase.
--
-- Diferencias confirmadas:
--   • Vaquillas 15M Ag: origen_total 529 -> 531.
--   • Vacas Picaflor Toro: prenez_cuerpo 161 -> 166 y vacias 57 -> 58.
--   • Las siete filas no tenían fecha.
--
-- Totales esperados luego de aplicar:
--   origen 3.074; preñadas 2.720; vacías 334; evaluadas 3.054;
--   faltan tactar 20; preñez general 89,06 %.
--
-- Es idempotente: fija las siete filas a los valores de la fuente validada.
-- No modifica campo_id ni campania_id. El trigger de la migración 0030 y el
-- refresco explícito actualizan campos.stock_inicial_vacas para Pariciones.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_filas INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO v_filas
  FROM public.tactos
  WHERE cliente_id = 'ganaderas'
    AND id IN (
      'tacto-gva-001', 'tacto-gva-002', 'tacto-gva-003',
      'tacto-gva-004', 'tacto-gva-005', 'tacto-gva-006',
      'tacto-gva-007'
    );

  IF v_filas <> 7 THEN
    RAISE EXCEPTION
      'Se esperaban los 7 tactos de Ganaderas y se encontraron %; no se modificó nada',
      v_filas;
  END IF;

  IF to_regprocedure('public._refrescar_stock_prenez_activa(text)') IS NULL THEN
    RAISE EXCEPTION
      'Falta la migración 0030_vincular_prenez_pariciones_campania.sql';
  END IF;
END;
$$;

WITH fuente (
  id, fecha, origen_total, prenez_cabeza, prenez_cuerpo, prenez_cola,
  vacias, perdon, descarte, feed_lot
) AS (
  VALUES
    ('tacto-gva-001', DATE '2026-04-18', 254, 123,  86, 26, 19, 0, 0, 0),
    ('tacto-gva-002', DATE '2026-05-07', 531, 336,  96, 31, 65, 0, 0, 0),
    ('tacto-gva-003', DATE '2026-05-18', 540, 235, 153, 71, 73, 0, 0, 0),
    ('tacto-gva-004', DATE '2026-05-08', 416, 141, 140, 86, 48, 0, 0, 0),
    ('tacto-gva-005', DATE '2026-05-08', 418, 192, 138, 58, 30, 0, 0, 0),
    ('tacto-gva-006', DATE '2026-05-26', 557, 299, 171, 45, 41, 0, 0, 0),
    ('tacto-gva-007', DATE '2026-05-27', 358,  84, 166, 43, 58, 0, 0, 0)
)
UPDATE public.tactos AS t
SET fecha          = f.fecha,
    origen_total   = f.origen_total,
    prenez_cabeza  = f.prenez_cabeza,
    prenez_cuerpo  = f.prenez_cuerpo,
    prenez_cola    = f.prenez_cola,
    vacias         = f.vacias,
    perdon         = f.perdon,
    descarte       = f.descarte,
    feed_lot       = f.feed_lot,
    updated_at     = NOW()
FROM fuente AS f
WHERE t.id = f.id
  AND t.cliente_id = 'ganaderas';

-- Actualización explícita del cache consumido por Pariciones. El trigger de
-- tactos ya lo hace fila por fila; esta llamada final deja el estado inequívoco.
SELECT public._refrescar_stock_prenez_activa('ganaderas');

DO $$
DECLARE
  v_origen BIGINT;
  v_cabeza BIGINT;
  v_cuerpo BIGINT;
  v_cola BIGINT;
  v_prenadas BIGINT;
  v_vacias BIGINT;
  v_evaluadas BIGINT;
  v_faltan BIGINT;
  v_sin_fecha BIGINT;
  v_stock BIGINT;
BEGIN
  SELECT
    SUM(origen_total),
    SUM(prenez_cabeza),
    SUM(prenez_cuerpo),
    SUM(prenez_cola),
    SUM(prenez_cabeza + prenez_cuerpo + prenez_cola),
    SUM(vacias),
    SUM(
      prenez_cabeza + prenez_cuerpo + prenez_cola +
      vacias + perdon + descarte + feed_lot
    ),
    SUM(
      origen_total - (
        prenez_cabeza + prenez_cuerpo + prenez_cola +
        vacias + perdon + descarte + feed_lot
      )
    ),
    COUNT(*) FILTER (WHERE fecha IS NULL)
  INTO
    v_origen, v_cabeza, v_cuerpo, v_cola, v_prenadas,
    v_vacias, v_evaluadas, v_faltan, v_sin_fecha
  FROM public.tactos
  WHERE cliente_id = 'ganaderas'
    AND id IN (
      'tacto-gva-001', 'tacto-gva-002', 'tacto-gva-003',
      'tacto-gva-004', 'tacto-gva-005', 'tacto-gva-006',
      'tacto-gva-007'
    );

  SELECT COALESCE(SUM(stock_inicial_vacas), 0)
    INTO v_stock
  FROM public.campos
  WHERE cliente_id = 'ganaderas';

  IF v_origen <> 3074
     OR v_cabeza <> 1410
     OR v_cuerpo <> 950
     OR v_cola <> 360
     OR v_prenadas <> 2720
     OR v_vacias <> 334
     OR v_evaluadas <> 3054
     OR v_faltan <> 20
     OR v_sin_fecha <> 0
     OR v_stock <> 2720 THEN
    RAISE EXCEPTION
      'Validación fallida: origen %, preñadas %, vacías %, evaluadas %, faltan %, sin fecha %, stock %',
      v_origen, v_prenadas, v_vacias, v_evaluadas, v_faltan,
      v_sin_fecha, v_stock;
  END IF;
END;
$$;

COMMIT;

-- Resultado visible en el SQL Editor.
WITH resumen AS (
  SELECT
    SUM(origen_total) AS origen_total,
    SUM(prenez_cabeza) AS prenez_cabeza,
    SUM(prenez_cuerpo) AS prenez_cuerpo,
    SUM(prenez_cola) AS prenez_cola,
    SUM(prenez_cabeza + prenez_cuerpo + prenez_cola) AS total_prenadas,
    SUM(vacias) AS vacias,
    SUM(
      prenez_cabeza + prenez_cuerpo + prenez_cola +
      vacias + perdon + descarte + feed_lot
    ) AS total_evaluado
  FROM public.tactos
  WHERE cliente_id = 'ganaderas'
    AND id IN (
      'tacto-gva-001', 'tacto-gva-002', 'tacto-gva-003',
      'tacto-gva-004', 'tacto-gva-005', 'tacto-gva-006',
      'tacto-gva-007'
    )
)
SELECT
  origen_total,
  prenez_cabeza,
  prenez_cuerpo,
  prenez_cola,
  total_prenadas,
  vacias,
  total_evaluado,
  origen_total - total_evaluado AS faltan_tactar,
  ROUND(100.0 * total_prenadas / NULLIF(total_evaluado, 0), 2)
    AS porcentaje_prenez,
  (
    SELECT JSONB_OBJECT_AGG(c.nombre, c.stock_inicial_vacas ORDER BY c.nombre)
    FROM public.campos c
    WHERE c.cliente_id = 'ganaderas'
      AND c.stock_inicial_vacas > 0
  ) AS stock_inicial_por_campo
FROM resumen;
