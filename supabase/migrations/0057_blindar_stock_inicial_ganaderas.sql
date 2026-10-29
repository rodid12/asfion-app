-- =============================================================================
-- 0057 — Blindar stock inicial oficial de Ganaderas
-- =============================================================================
-- Evita que una actualización de tactos vuelva a reemplazar el stock oficial
-- de la campaña 2026/27 por la suma de Preñez (Carolina 826 en vez de 417).
-- Fuente oficial: GVA_F(10) (1).xlsx / hoja StockInicial.
-- Script idempotente.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.stock_inicial_campanias') IS NULL THEN
    RAISE EXCEPTION
      'Falta public.stock_inicial_campanias. Ejecutá primero la migración 0052.';
  END IF;
END;
$$;

-- Reafirmar la fuente de verdad para todos los campos de Ganaderas.
INSERT INTO public.stock_inicial_campanias (
  cliente_id, campania_id, campo_id, cantidad, fuente, observaciones
)
SELECT
  'ganaderas',
  'campania-ganaderas-2026-2027',
  c.id,
  CASE c.id
    WHEN 'campo-carolina'    THEN 417
    WHEN 'campo-picaflor'    THEN 1140
    WHEN 'campo-progreso'    THEN 455
    WHEN 'campo-quirquincho' THEN 698
    ELSE 0
  END,
  'GVA_F(10) (1).xlsx / StockInicial',
  'Stock oficial confirmado por Ganaderas; no recalcular desde tactos.'
FROM public.campos c
WHERE c.cliente_id = 'ganaderas'
ON CONFLICT (campania_id, campo_id) DO UPDATE SET
  cliente_id    = EXCLUDED.cliente_id,
  cantidad      = EXCLUDED.cantidad,
  fuente        = EXCLUDED.fuente,
  observaciones = EXCLUDED.observaciones,
  updated_at    = NOW();

-- Esta función es llamada por los triggers existentes de tactos y campañas.
-- Primero busca un stock oficial por campaña; solo usa tactos como fallback
-- para clientes/campañas que todavía no tengan esa fuente cargada.
CREATE OR REPLACE FUNCTION public._refrescar_stock_prenez_activa(p_cliente_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.campos c
  SET stock_inicial_vacas = COALESCE(
    (
      SELECT sic.cantidad
      FROM public.stock_inicial_campanias sic
      JOIN public.campanias_reproductivas cr
        ON cr.id = sic.campania_id
       AND cr.cliente_id = sic.cliente_id
      WHERE sic.cliente_id = p_cliente_id
        AND sic.campo_id = c.id
        AND cr.activa = TRUE
      ORDER BY cr.fecha_inicio DESC
      LIMIT 1
    ),
    (
      SELECT SUM(
        COALESCE(t.prenez_cabeza, 0) +
        COALESCE(t.prenez_cuerpo, 0) +
        COALESCE(t.prenez_cola, 0)
      )::INTEGER
      FROM public.tactos t
      JOIN public.campanias_reproductivas cr ON cr.id = t.campania_id
      WHERE t.cliente_id = p_cliente_id
        AND t.campo_id = c.id
        AND cr.activa = TRUE
    ),
    0
  )
  WHERE c.cliente_id = p_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public._refrescar_stock_prenez_activa(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._refrescar_stock_prenez_activa(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public._refrescar_stock_prenez_activa(TEXT) FROM authenticated;

-- Si en el futuro se corrige una fila oficial, refrescar automáticamente el
-- cache compatible que consumen la app y el dashboard.
CREATE OR REPLACE FUNCTION public.refrescar_stock_desde_fuente_oficial_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public._refrescar_stock_prenez_activa(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.cliente_id ELSE NEW.cliente_id END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS stock_inicial_campanias_refrescar_campos_trg
  ON public.stock_inicial_campanias;
CREATE TRIGGER stock_inicial_campanias_refrescar_campos_trg
  AFTER INSERT OR UPDATE OR DELETE
  ON public.stock_inicial_campanias
  FOR EACH ROW
  EXECUTE FUNCTION public.refrescar_stock_desde_fuente_oficial_trg();

-- Reparación inmediata del valor que hoy está mostrando 826 para Carolina.
SELECT public._refrescar_stock_prenez_activa('ganaderas');

DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(stock_inicial_vacas), 0)
  INTO v_total
  FROM public.campos
  WHERE cliente_id = 'ganaderas';

  IF v_total <> 2710 THEN
    RAISE EXCEPTION 'Stock total inesperado: %, se esperaba 2710.', v_total;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('campo-carolina', 417),
      ('campo-picaflor', 1140),
      ('campo-progreso', 455),
      ('campo-quirquincho', 698)
    ) AS esperado(campo_id, cantidad)
    LEFT JOIN public.campos c
      ON c.id = esperado.campo_id
     AND c.cliente_id = 'ganaderas'
    WHERE c.stock_inicial_vacas IS DISTINCT FROM esperado.cantidad
  ) THEN
    RAISE EXCEPTION 'El stock por campo no coincide con el Excel oficial.';
  END IF;
END;
$$;

COMMIT;

SELECT
  c.id,
  c.nombre,
  c.stock_inicial_vacas,
  sic.cantidad AS stock_oficial_campania
FROM public.campos c
LEFT JOIN public.stock_inicial_campanias sic
  ON sic.campo_id = c.id
 AND sic.campania_id = 'campania-ganaderas-2026-2027'
WHERE c.cliente_id = 'ganaderas'
ORDER BY c.nombre;
