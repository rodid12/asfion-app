-- Campo libre para identificar la empresa, transportista o referencia del
-- flete asociado a una compra.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS flete TEXT;

COMMENT ON COLUMN public.compras.flete IS
  'Empresa, transportista o referencia del flete asociado a la compra.';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'compras'
  AND column_name = 'flete';
