-- =============================================================================
-- 0035 — Eliminación de eventos reservada a administradores
-- =============================================================================
-- La app bloquea la edición manual para operarios en todos los formularios.
-- Esta migración agrega defensa en profundidad para DELETE: aunque alguien
-- intente llamar la API directamente, solo un administrador del tenant puede
-- eliminar registros. No se endurece UPDATE aquí porque Pastoreo utiliza una
-- actualización operativa automática para cerrar la permanencia anterior al
-- registrar una nueva rotación; ese flujo se diferencia de la edición manual
-- en la interfaz.
-- =============================================================================

CREATE OR REPLACE FUNCTION current_user_can_manage_events()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    WHERE lower(btrim(u.email)) = current_user_email()
      AND u.cliente_id = current_cliente_id()
      AND u.rol = 'administrador'
  );
$$;

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['pariciones', 'lluvias', 'mortandad', 'pastoreo', 'compras']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON %I', tabla, tabla);
    EXECUTE format(
      'CREATE POLICY %I_delete ON %I FOR DELETE TO authenticated USING (' ||
      'cliente_id = current_cliente_id() AND current_cliente_can_write() ' ||
      'AND current_user_can_manage_events())',
      tabla,
      tabla
    );
  END LOOP;
END $$;

-- Ventas ya tiene su policy propia `ventas_delete`, también limitada a admin.

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('pariciones', 'lluvias', 'mortandad', 'pastoreo', 'compras', 'ventas')
  AND cmd = 'DELETE'
ORDER BY tablename;
