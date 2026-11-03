-- =============================================================================
-- 0062 — Catálogo urgente de Recepción para Ganaderas
-- =============================================================================
-- Recepción en Corrales solo admite las cuatro categorías confirmadas por el
-- cliente. La app ya consume este JSONB en forma dinámica; mantener el dato en
-- Supabase evita depender del fallback compilado o de una configuración vieja.
-- Script idempotente.
-- =============================================================================

BEGIN;

UPDATE public.clientes
SET catalogos = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(catalogos, '{}'::jsonb),
          '{mortandad,categoriasPorActividad,Recepción}',
          '["Novillito","Vaq 1","TernH","TernM"]'::jsonb,
          true
        ),
        '{mortandad,actividadesPorCampo,Corrales}',
        '["Recepción","engorde","Invernada","Destete Precoz"]'::jsonb,
        true
      ),
      '{mortandad,causaLibre}',
      'true'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE id = 'ganaderas';

COMMIT;

SELECT
  id,
  catalogos #> '{mortandad,categoriasPorActividad,Recepción}' AS categorias_recepcion,
  catalogos #> '{mortandad,actividadesPorCampo,Corrales}' AS actividades_corrales,
  catalogos #> '{mortandad,causaLibre}' AS causa_libre
FROM public.clientes
WHERE id = 'ganaderas';
