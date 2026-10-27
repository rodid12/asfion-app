-- =============================================================================
-- 0054 — Aislamiento estricto del cliente seleccionado por superadministrador
-- =============================================================================
--
-- Corrige un efecto de las policies permisivas de PostgreSQL: al seleccionar
-- Carahuasi, la policy especial permitía Carahuasi, pero la policy normal del
-- usuario de Agustín seguía permitiendo Ganaderas. Al combinarse con OR, una
-- consulta sin filtro explícito podía devolver ambos clientes.
--
-- A partir de esta migración, current_cliente_id() toma como cliente efectivo
-- el indicado en x-client-info cuando el usuario es superadministrador. De ese
-- modo todas las policies normales y especiales convergen en el mismo tenant.
-- Sin scope explícito conserva el cliente base para no romper el inicio de
-- sesión ni la lectura del perfil previa al selector.
--
-- No borra, mueve ni modifica datos. Es idempotente.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN public.is_super_admin()
         AND public.requested_admin_cliente_id() IS NOT NULL
      THEN public.requested_admin_cliente_id()
    ELSE (
      SELECT u.cliente_id
      FROM public.usuarios AS u
      WHERE lower(trim(u.email)) = lower(trim(public.current_user_email()))
      LIMIT 1
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.current_cliente_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_cliente_id() TO authenticated;

-- 0052 creó esta tabla después del hotfix 0041 y volvió a incluir un
-- `OR is_super_admin()` global. La dejamos bajo el mismo alcance estricto.
DO $$
BEGIN
  IF to_regclass('public.stock_inicial_campanias') IS NOT NULL THEN
    DROP POLICY IF EXISTS stock_inicial_campanias_select
      ON public.stock_inicial_campanias;
    CREATE POLICY stock_inicial_campanias_select
      ON public.stock_inicial_campanias
      FOR SELECT TO authenticated
      USING (cliente_id = public.current_cliente_id());

    DROP POLICY IF EXISTS stock_inicial_campanias_modify
      ON public.stock_inicial_campanias;
    CREATE POLICY stock_inicial_campanias_modify
      ON public.stock_inicial_campanias
      FOR ALL TO authenticated
      USING (
        cliente_id = public.current_cliente_id()
        AND (
          public.current_user_can_manage_events()
          OR public.is_super_admin()
        )
      )
      WITH CHECK (
        cliente_id = public.current_cliente_id()
        AND (
          public.current_user_can_manage_events()
          OR public.is_super_admin()
        )
      );
  END IF;
END
$$;

COMMIT;

-- Verificación informativa. En el SQL Editor no existe el header de la app,
-- por lo que requested_admin_cliente_id() normalmente devuelve NULL.
SELECT
  public.current_cliente_id() AS cliente_efectivo,
  public.requested_admin_cliente_id() AS cliente_solicitado;
