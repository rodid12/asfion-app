-- ASFION — Bucket de Storage para fotos de eventos.
--
-- Bug que motivó esto: las fotos que el operario sacaba con la cámara
-- se guardaban como URIs `file:///var/mobile/...` directamente en el
-- array `fotos` de pariciones/mortandad/etc. Resultado: solo el celular
-- que sacó la foto podía verlas; el dashboard web y los demás operarios
-- veían URIs rotas. Si el operario borraba la app, perdía las fotos.
--
-- Fix: bucket dedicado `fotos-eventos`, organizado por cliente/tabla/ID,
-- con RLS para que cada cliente vea solo sus archivos. La app móvil
-- sube cada foto antes de guardar el evento y reemplaza la URI local
-- por la URL pública del bucket.

-- ============================================================================
-- 1) Crear bucket (idempotente)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-eventos',
  'fotos-eventos',
  true,            -- public read (las URLs son shareables sin auth)
  10 * 1024 * 1024, -- 10 MB max por archivo (sobra para JPEG de cámara móvil)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2) RLS sobre storage.objects
--
-- Convención de path: `<cliente_id>/<tabla>/<evento_id>/<archivo>.jpg`
-- ej: `ganaderas/pariciones/abc-123/foto-0.jpg`
--
-- Lectura: pública (bucket es public).
-- Escritura: solo usuarios autenticados que pertenezcan al cliente_id
-- del primer segmento del path. RLS lo valida con current_cliente_id().
-- ============================================================================

DROP POLICY IF EXISTS fotos_eventos_insert_policy ON storage.objects;
CREATE POLICY fotos_eventos_insert_policy ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = current_cliente_id()
  );

DROP POLICY IF EXISTS fotos_eventos_update_policy ON storage.objects;
CREATE POLICY fotos_eventos_update_policy ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = current_cliente_id()
  );

DROP POLICY IF EXISTS fotos_eventos_delete_policy ON storage.objects;
CREATE POLICY fotos_eventos_delete_policy ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = current_cliente_id()
  );
