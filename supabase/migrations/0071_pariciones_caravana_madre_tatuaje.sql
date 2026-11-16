-- =============================================================================
-- 0071 · Pariciones — identificación opcional de madre y tatuaje
-- =============================================================================
-- Ambos datos son opcionales. Se usan en nacimientos y no alteran registros
-- históricos ni métricas existentes.
-- =============================================================================

BEGIN;

ALTER TABLE public.pariciones
  ADD COLUMN IF NOT EXISTS caravana_madre text,
  ADD COLUMN IF NOT EXISTS tatuaje text;

COMMENT ON COLUMN public.pariciones.caravana_madre IS
  'Identificación opcional de la madre informada al registrar un nacimiento.';

COMMENT ON COLUMN public.pariciones.tatuaje IS
  'Tatuaje opcional de la cría; no todos los establecimientos lo utilizan.';

COMMIT;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pariciones'
  AND column_name IN ('caravana_madre', 'tatuaje')
ORDER BY column_name;
