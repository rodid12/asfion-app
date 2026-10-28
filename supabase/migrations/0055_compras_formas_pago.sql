-- =============================================================================
-- 0055 — Formas de pago de Compras
-- =============================================================================
-- Reemplaza los plazos individuales por las condiciones comerciales solicitadas
-- por el cliente. Se aplica a todos los tenants que tengan módulo Compras.
-- Los registros históricos conservan el texto con el que fueron cargados.
-- Script idempotente.
-- =============================================================================

BEGIN;

UPDATE public.clientes
SET catalogos = COALESCE(catalogos, '{}'::jsonb)
      || jsonb_build_object(
        'compras',
        COALESCE(catalogos -> 'compras', '{}'::jsonb)
        || jsonb_build_object(
          'plazos',
          '["Contado","30","30/60","30/60/90"]'::jsonb
        )
      ),
    updated_at = NOW()
WHERE modulos_habilitados @> ARRAY['compras']::text[]
   OR catalogos ? 'compras';

COMMIT;

SELECT
  id,
  nombre,
  catalogos #> '{compras,plazos}' AS formas_pago
FROM public.clientes
WHERE modulos_habilitados @> ARRAY['compras']::text[]
   OR catalogos ? 'compras'
ORDER BY nombre;
