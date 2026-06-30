-- ASFION — Completar el row de cliente Ganaderas con módulos + catálogos
-- al día.
--
-- Contexto: la tabla `clientes` (creada en 0001) ya tiene las columnas
-- `nombre`, `tagline`, `logo_url`, `accent_color`, `modulos_habilitados`,
-- `catalogos JSONB`. El seed inicial (0002) sembró Ganaderas pero faltaron:
--   - 'compras' y 'ventas' en `modulos_habilitados`
--   - bloque `compras` en `catalogos` JSONB
--
-- Esta migración cierra el gap así el ClientConfigContext de la app
-- (que ahora hace fetch en runtime) recibe la config completa. Sin
-- esto, los módulos Compras/Ventas se ven en la web pero no en la app.

UPDATE clientes
SET
  modulos_habilitados = ARRAY[
    'pariciones',
    'lluvias',
    'mortandad',
    'pastoreo',
    'compras',
    'ventas'
  ]::TEXT[],
  catalogos = catalogos || jsonb_build_object(
    'compras', jsonb_build_object(
      'actividades', jsonb_build_array('Destete Precoz', 'Engorde', 'Invernada'),
      'plazos',      jsonb_build_array('Contado', '30 días', '60 días', '90 días')
    )
  )
WHERE id = 'ganaderas';

-- Verificación:
-- SELECT id, modulos_habilitados,
--        catalogos -> 'compras' AS compras_cat
-- FROM clientes WHERE id = 'ganaderas';
