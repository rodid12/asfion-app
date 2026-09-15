-- =============================================================================
-- 0039 — Vista multi-cliente segura para super-administradores
-- =============================================================================
--
-- Objetivo:
--   Rosario y Agustín pueden elegir un cliente en el dashboard web y revisar
--   sus módulos sin cambiar su row de `usuarios` ni iniciar sesión con la
--   cuenta del cliente.
--
-- Seguridad:
--   - Solo agrega SELECT para quienes cumplen is_super_admin().
--   - No amplía INSERT / UPDATE / DELETE de tablas operativas.
--   - El frontend siempre agrega `.eq('cliente_id', cliente_elegido)`; no
--     existe una opción "Todos". La policy permite leer, pero la consulta
--     trae únicamente el tenant seleccionado.
--   - Usuarios normales mantienen exactamente las policies existentes.
--
-- Es idempotente y tolera módulos opcionales que todavía no existan.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  tabla TEXT;
  policy_name TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    -- Catálogos usados por el dashboard o por futuras vistas de detalle.
    'campos',
    'lotes',
    'pluviometros',
    'circuitos',
    'parcelas',

    -- Eventos y módulos operativos.
    'pariciones',
    'lluvias',
    'mortandad',
    'pastoreo',
    'pastoreo_ciclos',
    'pariciones_resumen_servicio',
    'compras',
    'ventas',
    'tactos',
    'ndvi_pasturas',
    'cierre_corrales',

    -- Períodos que gobiernan los filtros del dashboard.
    'campanias_reproductivas',
    'campanias_operativas'
  ]
  LOOP
    IF to_regclass(format('public.%I', tabla)) IS NOT NULL THEN
      policy_name := tabla || '_superadmin_select';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tabla);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (is_super_admin())',
        policy_name,
        tabla
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;

-- Verificación opcional después de RUN:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE '%superadmin_select'
-- ORDER BY tablename;
--
-- Deben aparecer las tablas existentes con cmd = SELECT.
