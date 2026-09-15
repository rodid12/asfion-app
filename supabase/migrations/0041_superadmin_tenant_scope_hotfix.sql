-- =============================================================================
-- 0041 — HOTFIX: alcance explícito de tenant para super-administradores
-- =============================================================================
--
-- Problema corregido:
--   0039 habilitó SELECT global a los super-admins confiando solamente en que
--   el frontend agregaría `.eq(cliente_id, ...)`. Una APK ya instalada no
--   agrega ese filtro y podía recibir filas de más de un cliente.
--
-- Solución:
--   El dashboard web declara el cliente elegido en el header estándar
--   `x-client-info` como `asfion-tenant=<cliente_id>`. RLS exige que ese scope
--   coincida con la fila. Sin ese header (APK actual), el permiso especial de
--   super-admin no se activa y siguen rigiendo las policies normales del JWT.
--
-- Este script NO borra ni modifica datos. Es idempotente.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.requested_admin_cliente_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT (
    regexp_match(
      COALESCE(
        NULLIF(current_setting('request.headers', TRUE), '')::JSONB ->> 'x-client-info',
        ''
      ),
      '(^|;)asfion-tenant=([a-z0-9-]+)(;|$)'
    )
  )[2];
$$;

REVOKE ALL ON FUNCTION public.requested_admin_cliente_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requested_admin_cliente_id() TO authenticated;

-- Reemplaza los SELECT globales creados por 0039. Si una tabla opcional no
-- existe todavía, simplemente se omite.
DO $$
DECLARE
  tabla TEXT;
  policy_name TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'campos',
    'usuarios',
    'lotes',
    'pluviometros',
    'circuitos',
    'parcelas',
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
    'campanias_reproductivas',
    'campanias_operativas'
  ]
  LOOP
    IF to_regclass(format('public.%I', tabla)) IS NOT NULL THEN
      policy_name := tabla || '_superadmin_select';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tabla);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated ' ||
        'USING (is_super_admin() AND cliente_id = requested_admin_cliente_id())',
        policy_name,
        tabla
      );
    END IF;
  END LOOP;
END
$$;

-- Las antiguas policies FOR ALL de catálogos también cubrían SELECT y podían
-- saltear el scope. Las separamos por operación para que nunca den lectura
-- global implícita.
DO $$
DECLARE
  tabla TEXT;
  old_policy TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['campos', 'usuarios', 'lotes', 'circuitos']
  LOOP
    IF to_regclass(format('public.%I', tabla)) IS NOT NULL THEN
      old_policy := tabla || '_super_admin_write';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', old_policy, tabla);

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tabla || '_superadmin_insert', tabla);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tabla || '_superadmin_update', tabla);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tabla || '_superadmin_delete', tabla);

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated ' ||
        'WITH CHECK (is_super_admin() AND cliente_id = requested_admin_cliente_id())',
        tabla || '_superadmin_insert', tabla
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated ' ||
        'USING (is_super_admin() AND cliente_id = requested_admin_cliente_id()) ' ||
        'WITH CHECK (is_super_admin() AND cliente_id = requested_admin_cliente_id())',
        tabla || '_superadmin_update', tabla
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated ' ||
        'USING (is_super_admin() AND cliente_id = requested_admin_cliente_id())',
        tabla || '_superadmin_delete', tabla
      );
    END IF;
  END LOOP;
END
$$;

-- Policies antiguas que incluían `OR is_super_admin()` y, por ser permisivas,
-- anulaban el nuevo scope. Se recrean preservando el acceso del tenant normal.
DO $$
BEGIN
  IF to_regclass('public.pastoreo_ciclos') IS NOT NULL THEN
    DROP POLICY IF EXISTS pastoreo_ciclos_select ON public.pastoreo_ciclos;
    DROP POLICY IF EXISTS pastoreo_ciclos_modify ON public.pastoreo_ciclos;
    CREATE POLICY pastoreo_ciclos_select ON public.pastoreo_ciclos
      FOR SELECT TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
    CREATE POLICY pastoreo_ciclos_modify ON public.pastoreo_ciclos
      FOR ALL TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      )
      WITH CHECK (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
  END IF;

  IF to_regclass('public.pariciones_resumen_servicio') IS NOT NULL THEN
    DROP POLICY IF EXISTS par_resumen_select ON public.pariciones_resumen_servicio;
    DROP POLICY IF EXISTS par_resumen_modify ON public.pariciones_resumen_servicio;
    CREATE POLICY par_resumen_select ON public.pariciones_resumen_servicio
      FOR SELECT TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
    CREATE POLICY par_resumen_modify ON public.pariciones_resumen_servicio
      FOR ALL TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      )
      WITH CHECK (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
  END IF;

  IF to_regclass('public.campanias_reproductivas') IS NOT NULL THEN
    DROP POLICY IF EXISTS campanias_reproductivas_select ON public.campanias_reproductivas;
    DROP POLICY IF EXISTS campanias_reproductivas_modify ON public.campanias_reproductivas;
    CREATE POLICY campanias_reproductivas_select ON public.campanias_reproductivas
      FOR SELECT TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
    CREATE POLICY campanias_reproductivas_modify ON public.campanias_reproductivas
      FOR ALL TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      )
      WITH CHECK (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
  END IF;

  IF to_regclass('public.campanias_operativas') IS NOT NULL THEN
    DROP POLICY IF EXISTS campanias_operativas_select ON public.campanias_operativas;
    DROP POLICY IF EXISTS campanias_operativas_modify ON public.campanias_operativas;
    CREATE POLICY campanias_operativas_select ON public.campanias_operativas
      FOR SELECT TO authenticated
      USING (
        cliente_id = current_cliente_id()
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
    CREATE POLICY campanias_operativas_modify ON public.campanias_operativas
      FOR ALL TO authenticated
      USING (
        (cliente_id = current_cliente_id() AND current_user_can_manage_events())
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      )
      WITH CHECK (
        (cliente_id = current_cliente_id() AND current_user_can_manage_events())
        OR (is_super_admin() AND cliente_id = requested_admin_cliente_id())
      );
  END IF;
END
$$;

COMMIT;

-- Verificación opcional: ninguna policy operativa debería conservar un
-- `is_super_admin()` global sin `requested_admin_cliente_id()`.
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%superadmin%'
    OR tablename IN (
      'pastoreo_ciclos',
      'pariciones_resumen_servicio',
      'campanias_reproductivas',
      'campanias_operativas'
    )
  )
ORDER BY tablename, policyname;
