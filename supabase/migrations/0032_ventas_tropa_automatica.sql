-- =============================================================================
-- 0032 — Tropa automática y correlativa en Ventas
-- =============================================================================
--
-- La tropa deja de ser un dato manual. La app muestra una estimación para
-- poder trabajar offline, pero la base asigna el valor definitivo al insertar.
-- El contador es independiente por cliente y no se reinicia por año.
--
-- La tabla de contadores + ON CONFLICT evita que dos administradores reciban
-- la misma tropa aunque guarden al mismo tiempo. Una edición conserva siempre
-- la tropa original.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ventas_tropa_correlativos (
  cliente_id TEXT PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  ultimo BIGINT NOT NULL CHECK (ultimo > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La tabla es infraestructura interna: ningún cliente la modifica por API.
REVOKE ALL ON TABLE public.ventas_tropa_correlativos FROM anon, authenticated;

-- Iniciar cada contador con la tropa numérica más alta ya almacenada.
INSERT INTO public.ventas_tropa_correlativos (cliente_id, ultimo, updated_at)
SELECT
  cliente_id,
  MAX(btrim(tropa)::BIGINT) AS ultimo,
  NOW()
FROM public.ventas
WHERE btrim(tropa) ~ '^[1-9][0-9]{0,17}$'
GROUP BY cliente_id
ON CONFLICT (cliente_id) DO UPDATE
SET ultimo = GREATEST(
      public.ventas_tropa_correlativos.ultimo,
      EXCLUDED.ultimo
    ),
    updated_at = NOW();

-- Antes de exigir unicidad, detener la migración con un mensaje claro si hay
-- datos históricos duplicados. No se corrigen silenciosamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ventas
    GROUP BY cliente_id, btrim(tropa)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'No se puede automatizar tropa: existen valores duplicados dentro de un cliente';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ventas_tropa_unica_idx
  ON public.ventas(cliente_id, btrim(tropa));

CREATE OR REPLACE FUNCTION public.asignar_tropa_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tropa_existente TEXT;
  v_siguiente BIGINT;
BEGIN
  -- La tropa es inmutable una vez creada.
  IF TG_OP = 'UPDATE' THEN
    NEW.tropa := OLD.tropa;
    RETURN NEW;
  END IF;

  -- Supabase usa UPSERT para sincronizar y también entra por BEFORE INSERT.
  -- Si el id ya existe, conservar la tropa sin consumir otro correlativo.
  SELECT v.tropa
    INTO v_tropa_existente
  FROM public.ventas v
  WHERE v.id = NEW.id;

  IF FOUND THEN
    NEW.tropa := v_tropa_existente;
    RETURN NEW;
  END IF;

  INSERT INTO public.ventas_tropa_correlativos AS c
    (cliente_id, ultimo, updated_at)
  VALUES
    (NEW.cliente_id, 1, NOW())
  ON CONFLICT (cliente_id) DO UPDATE
  SET ultimo = c.ultimo + 1,
      updated_at = NOW()
  RETURNING ultimo INTO v_siguiente;

  NEW.tropa := v_siguiente::TEXT;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.asignar_tropa_venta() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.asignar_tropa_venta() FROM anon, authenticated;

DROP TRIGGER IF EXISTS ventas_00_asignar_tropa_trg ON public.ventas;
CREATE TRIGGER ventas_00_asignar_tropa_trg
  BEFORE INSERT OR UPDATE ON public.ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_tropa_venta();

COMMENT ON COLUMN public.ventas.tropa IS
  'Correlativo numérico automático por cliente. Inmutable después del alta.';

COMMENT ON TABLE public.ventas_tropa_correlativos IS
  'Contador interno y transaccional para asignar tropas únicas en ventas.';

COMMIT;
