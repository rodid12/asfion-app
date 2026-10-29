-- =============================================================================
-- 0059 — Bloqueo absoluto de DELETE en Pariciones para usuarios autenticados
-- =============================================================================
-- PostgreSQL combina policies permisivas con OR. La policy histórica
-- pariciones_superadmin_delete seguía habilitando DELETE al superadministrador
-- aunque pariciones_delete tuviera USING (false). Eliminamos ambas y dejamos
-- una única policy explícitamente denegatoria. service_role conserva la
-- posibilidad de realizar una corrección extraordinaria desde soporte.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS pariciones_superadmin_delete ON public.pariciones;
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
ORDER BY cmd, policyname;
