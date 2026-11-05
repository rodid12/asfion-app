-- 0068 — Permitir el upsert seguro de fotos de eventos
--
-- Supabase Storage requiere SELECT además de INSERT/UPDATE cuando upload()
-- usa upsert=true. El bucket es público para descargar por URL, pero eso no
-- crea una policy SELECT sobre storage.objects para la operación autenticada.
-- Esta policy mantiene el aislamiento por cliente y habilita crear/reemplazar
-- fotos desde la app.

BEGIN;

DROP POLICY IF EXISTS fotos_eventos_select_policy ON storage.objects;
CREATE POLICY fotos_eventos_select_policy
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = public.current_cliente_id()
  );

-- Reafirmamos las policies de escritura para que esta migración también sea
-- suficiente si una instalación quedó con una versión anterior de Storage.
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

COMMIT;

SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'fotos_eventos_%_policy'
ORDER BY policyname;
