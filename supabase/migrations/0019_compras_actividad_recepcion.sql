-- =============================================================================
-- 0019 — Agregar "Recepción" como actividad de Compras
-- =============================================================================
--
-- Contexto: el cliente pidió que la app móvil ofrezca "Recepción" como
-- actividad en el formulario de carga de Compras — para el momento en que
-- llega el camión y se pesa la hacienda antes de definir destino productivo
-- (Destete Precoz / Engorde / Invernada).
--
-- Por qué tocar la tabla `clientes` y no solo el código:
-- A partir del rewrite multi-cliente (mig 0014), la app móvil lee
-- `catalogos.compras.actividades` de la tabla `clientes` en runtime. Sin
-- este UPDATE el dropdown sigue mostrando solo las 3 originales aunque el
-- código tenga 4.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Verificar:
--        SELECT catalogos -> 'compras' -> 'actividades' AS actividades
--        FROM clientes WHERE id = 'ganaderas';
--      Esperado: ["Recepción", "Destete Precoz", "Engorde", "Invernada"]
-- =============================================================================

UPDATE clientes
SET catalogos = jsonb_set(
  catalogos,
  '{compras,actividades}',
  jsonb_build_array('Recepción', 'Destete Precoz', 'Engorde', 'Invernada')
)
WHERE id = 'ganaderas';

-- Aplicar también a cualquier otro cliente que ya tenga el catálogo de
-- compras definido (futureproofing — si mañana se agregan más tenants la
-- migración no los rompe, solo refresca a los que tengan la key).
UPDATE clientes
SET catalogos = jsonb_set(
  catalogos,
  '{compras,actividades}',
  jsonb_build_array('Recepción', 'Destete Precoz', 'Engorde', 'Invernada')
)
WHERE catalogos -> 'compras' -> 'actividades' IS NOT NULL
  AND id <> 'ganaderas';
