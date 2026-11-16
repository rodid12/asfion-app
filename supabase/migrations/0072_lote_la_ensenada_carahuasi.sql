-- =============================================================================
-- 0072 · Estancia Carahuasi — agregar lote La Ensenada
-- =============================================================================
-- Pedido informado por Zoe el 16/11/2026.
-- Es idempotente, no elimina lotes y no modifica eventos históricos.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.campos
    WHERE id = 'campo-estancia-carahuasi-carahuasi'
      AND cliente_id = 'estancia-carahuasi'
  ) THEN
    RAISE EXCEPTION 'No existe el campo Carahuasi del cliente estancia-carahuasi.';
  END IF;
END $$;

INSERT INTO public.lotes (id, cliente_id, campo_id, nombre)
VALUES (
  'lote-estancia-carahuasi-carahuasi-la-ensenada',
  'estancia-carahuasi',
  'campo-estancia-carahuasi-carahuasi',
  'La Ensenada'
)
ON CONFLICT (id) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id,
    campo_id = EXCLUDED.campo_id,
    nombre = EXCLUDED.nombre;

COMMIT;

SELECT
  c.nombre AS campo,
  l.id,
  l.nombre AS lote
FROM public.lotes l
JOIN public.campos c ON c.id = l.campo_id
WHERE l.id = 'lote-estancia-carahuasi-carahuasi-la-ensenada';
