-- 0067 — Escritura activa sin perder Google ni el tenant del superadministrador
--
-- 0066 reforzó las policies de escritura, pero reemplazó current_cliente_id()
-- por una variante que miraba únicamente auth.jwt()->>'email'. Esta migración
-- restaura el fallback robusto de current_user_email() para OAuth Google y el
-- scope estricto del cliente seleccionado por un superadministrador.
--
-- No borra ni modifica eventos. Es idempotente.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS text
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
      WHERE lower(btrim(u.email)) = lower(btrim(public.current_user_email()))
      LIMIT 1
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.current_cliente_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_cliente_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_cliente_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clientes AS c
    WHERE c.id = public.current_cliente_id()
      AND lower(btrim(c.subscription_status::text)) IN ('active', 'past_due')
  );
$$;

REVOKE ALL ON FUNCTION public.current_cliente_can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_cliente_can_write() TO authenticated;

DROP POLICY IF EXISTS pariciones_write ON public.pariciones;
CREATE POLICY pariciones_write
  ON public.pariciones
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id = public.current_cliente_id()
    AND public.current_cliente_can_write()
  );

DROP POLICY IF EXISTS fotos_eventos_insert_policy ON storage.objects;
CREATE POLICY fotos_eventos_insert_policy
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = public.current_cliente_id()
    AND public.current_cliente_can_write()
  );

DROP POLICY IF EXISTS fotos_eventos_update_policy ON storage.objects;
CREATE POLICY fotos_eventos_update_policy
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = public.current_cliente_id()
    AND public.current_cliente_can_write()
  )
  WITH CHECK (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = public.current_cliente_id()
    AND public.current_cliente_can_write()
  );

DROP POLICY IF EXISTS fotos_eventos_delete_policy ON storage.objects;
CREATE POLICY fotos_eventos_delete_policy
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = public.current_cliente_id()
    AND public.current_cliente_can_write()
  );

COMMIT;

SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies AS p
WHERE (p.schemaname = 'public' AND p.tablename = 'pariciones' AND p.cmd = 'INSERT')
   OR (p.schemaname = 'storage' AND p.tablename = 'objects'
       AND p.policyname LIKE 'fotos_eventos_%_policy')
ORDER BY p.schemaname, p.tablename, p.policyname;
