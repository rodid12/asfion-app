-- =============================================================================
-- 0044 — App móvil: escritura aislada por cliente para superadministradores
-- =============================================================================
--
-- 0041 ya exige el header `asfion-tenant=<cliente_id>` para LECTURA global.
-- La app móvil ahora permite seleccionar un cliente y necesita la misma regla
-- para INSERT/UPDATE/DELETE. Sin estas policies, el superadmin podría mirar La
-- Hoyada pero cualquier formulario fallaría porque su perfil base pertenece a
-- Ganaderas.
--
-- Seguridad:
--   1. La sesión debe pertenecer a `super_admins`.
--   2. La fila debe coincidir con el tenant explícito del request.
--   3. El cliente seleccionado debe permitir escritura por estado de cobro.
--
-- No modifica ni borra datos. Es idempotente.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.requested_admin_cliente_can_write()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_super_admin()
    AND public.requested_admin_cliente_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id = public.requested_admin_cliente_id()
        AND c.subscription_status IN ('active', 'past_due')
    );
$$;

REVOKE ALL ON FUNCTION public.requested_admin_cliente_can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requested_admin_cliente_can_write() TO authenticated;

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'pariciones',
    'lluvias',
    'mortandad',
    'pastoreo',
    'compras',
    'ventas'
  ]
  LOOP
    IF to_regclass(format('public.%I', tabla)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tabla || '_superadmin_insert', tabla);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tabla || '_superadmin_update', tabla);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tabla || '_superadmin_delete', tabla);

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated ' ||
        'WITH CHECK (' ||
          'public.requested_admin_cliente_can_write() ' ||
          'AND cliente_id = public.requested_admin_cliente_id()' ||
        ')',
        tabla || '_superadmin_insert', tabla
      );

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated ' ||
        'USING (' ||
          'public.requested_admin_cliente_can_write() ' ||
          'AND cliente_id = public.requested_admin_cliente_id()' ||
        ') WITH CHECK (' ||
          'public.requested_admin_cliente_can_write() ' ||
          'AND cliente_id = public.requested_admin_cliente_id()' ||
        ')',
        tabla || '_superadmin_update', tabla
      );

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated ' ||
        'USING (' ||
          'public.requested_admin_cliente_can_write() ' ||
          'AND cliente_id = public.requested_admin_cliente_id()' ||
        ')',
        tabla || '_superadmin_delete', tabla
      );
    END IF;
  END LOOP;
END
$$;

-- Fotos: misma convención de path que la app normal:
-- <cliente_id>/<tabla>/<evento_id>/<archivo>.jpg
DROP POLICY IF EXISTS fotos_eventos_superadmin_insert ON storage.objects;
CREATE POLICY fotos_eventos_superadmin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-eventos'
    AND public.requested_admin_cliente_can_write()
    AND (storage.foldername(name))[1] = public.requested_admin_cliente_id()
  );

DROP POLICY IF EXISTS fotos_eventos_superadmin_update ON storage.objects;
CREATE POLICY fotos_eventos_superadmin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND public.requested_admin_cliente_can_write()
    AND (storage.foldername(name))[1] = public.requested_admin_cliente_id()
  )
  WITH CHECK (
    bucket_id = 'fotos-eventos'
    AND public.requested_admin_cliente_can_write()
    AND (storage.foldername(name))[1] = public.requested_admin_cliente_id()
  );

DROP POLICY IF EXISTS fotos_eventos_superadmin_delete ON storage.objects;
CREATE POLICY fotos_eventos_superadmin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND public.requested_admin_cliente_can_write()
    AND (storage.foldername(name))[1] = public.requested_admin_cliente_id()
  );

COMMIT;

-- Verificación opcional:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND policyname LIKE '%superadmin%'
ORDER BY schemaname, tablename, policyname;
