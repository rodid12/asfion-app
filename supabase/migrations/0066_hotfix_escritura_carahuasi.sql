-- 0066 — Hotfix de escritura para clientes activos (Carahuasi)
--
-- Refuerza la resolución de tenant de forma case-insensitive y recrea las
-- policies de alta de Pariciones y Storage. Es idempotente y aplica la misma
-- regla comercial existente: active/past_due escriben; el resto no.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.cliente_id
  FROM public.usuarios AS u
  WHERE lower(btrim(u.email)) = lower(btrim(auth.jwt() ->> 'email'))
  LIMIT 1;
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
      AND c.subscription_status IN ('active', 'past_due')
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

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE (schemaname = 'public' AND tablename = 'pariciones' AND cmd = 'INSERT')
   OR (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'fotos_eventos_%_policy')
ORDER BY schemaname, tablename, policyname;

