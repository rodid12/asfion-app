-- =============================================================================
-- 0043 — La Hoyada: habilitar únicamente el módulo Pariciones
-- =============================================================================
-- Esta configuración es reversible y no elimina información de ningún módulo.
-- La app y el dashboard leen `modulos_habilitados` en tiempo de ejecución.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  filas_actualizadas INTEGER;
BEGIN
  UPDATE public.clientes
  SET modulos_habilitados = ARRAY['pariciones']::TEXT[]
  WHERE id = 'el-renuevo';

  GET DIAGNOSTICS filas_actualizadas = ROW_COUNT;

  IF filas_actualizadas <> 1 THEN
    RAISE EXCEPTION
      'No se pudo configurar La Hoyada: se esperó 1 cliente con id el-renuevo y se actualizaron % filas',
      filas_actualizadas;
  END IF;
END
$$;

COMMIT;

-- Resultado esperado:
-- el-renuevo | Estancia La Hoyada | {pariciones}
SELECT id, nombre, modulos_habilitados
FROM public.clientes
WHERE id = 'el-renuevo';
