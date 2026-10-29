-- =============================================================================
-- 0058 — Pariciones: corrección por autor sin habilitar borrado
-- =============================================================================
-- Un operario puede corregir únicamente una parición creada con su propio
-- email. Administradores, moderadores y superadministradores pueden corregir
-- cualquier parición del cliente efectivo. DELETE queda bloqueado para todos
-- los usuarios autenticados; una corrección extraordinaria solo puede hacerse
-- por soporte con service_role y trazabilidad.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_events()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.usuarios AS u
    WHERE lower(btrim(u.email)) = public.current_user_email()
      AND u.cliente_id = public.current_cliente_id()
      AND u.rol IN ('administrador', 'moderador')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_edit_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_events() TO authenticated;

DROP POLICY IF EXISTS pariciones_update ON public.pariciones;
CREATE POLICY pariciones_update
  ON public.pariciones
  FOR UPDATE TO authenticated
  USING (
    cliente_id = public.current_cliente_id()
    AND public.current_cliente_can_write()
    AND (
      public.current_user_can_edit_events()
      OR lower(btrim(usuario_email)) = public.current_user_email()
    )
  )
  WITH CHECK (
    cliente_id = public.current_cliente_id()
    AND public.current_cliente_can_write()
    AND (
      public.current_user_can_edit_events()
      OR lower(btrim(usuario_email)) = public.current_user_email()
    )
  );

-- Defensa explícita: ningún usuario de la app puede borrar por API aunque
-- intente evitar la interfaz. La policy FALSE documenta el bloqueo y hace que
-- no dependa de que el cliente oculte correctamente un botón.
DROP POLICY IF EXISTS pariciones_delete ON public.pariciones;
CREATE POLICY pariciones_delete
  ON public.pariciones
  FOR DELETE TO authenticated
  USING (false);

COMMIT;

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'pariciones'
  AND cmd IN ('UPDATE', 'DELETE')
ORDER BY cmd;
