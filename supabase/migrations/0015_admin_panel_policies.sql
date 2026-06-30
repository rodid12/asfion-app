-- ASFION — Policies para el panel de administración multi-cliente.
--
-- Hasta acá los super-admins solo podían tocar `clientes` y `payments`
-- (migración 0005). Para que el panel admin del dashboard pueda crear
-- clientes nuevos + sus campos sin tocar SQL a mano, sumamos:
--
--   1. Sync de whitelist de is_super_admin() con la del frontend
--      (asfion-web/src/lib/billing.ts ya incluía agusufi20@ pero el
--      SQL solo tenía rosariodidziulis8@).
--   2. Policy super-admin sobre `campos` (INSERT/UPDATE/DELETE) para que
--      el panel pueda crear campos de un cliente nuevo desde la UI.
--   3. Policy super-admin sobre `usuarios` (INSERT/UPDATE/DELETE) — la
--      tabla no tenía ninguna policy de escritura, sólo SELECT. Sin esto
--      no se puede invitar usuarios desde la UI.

-- ============================================================================
-- 1) Whitelist de super-admins
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT (auth.jwt() ->> 'email') IN (
    'rosariodidziulis8@gmail.com',
    'agusufi20@gmail.com'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 2) Campos: super-admin puede gestionar todo. El SELECT existente
--    (cliente_id = current_cliente_id()) sigue igual para usuarios normales.
-- ============================================================================

DROP POLICY IF EXISTS campos_super_admin_write ON campos;
CREATE POLICY campos_super_admin_write ON campos FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- También: el super-admin puede LEER campos de cualquier cliente
-- (para mostrar todos los campos del cliente que está editando, no solo
-- los del tenant del JWT). FOR ALL ya cubre SELECT por defecto.

-- ============================================================================
-- 3) Usuarios: policy de escritura para super-admin
-- ============================================================================

DROP POLICY IF EXISTS usuarios_super_admin_write ON usuarios;
CREATE POLICY usuarios_super_admin_write ON usuarios FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Permitir que cualquier usuario autenticado lea su PROPIO row (el SELECT
-- original en 0001 ya hace esto; lo dejamos documentado para claridad).

-- ============================================================================
-- 4) Lotes y Circuitos: super-admin también puede gestionarlos. Si un
--    cliente nuevo entra, necesita poder crearle su estructura inicial.
-- ============================================================================

DROP POLICY IF EXISTS lotes_super_admin_write ON lotes;
CREATE POLICY lotes_super_admin_write ON lotes FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS circuitos_super_admin_write ON circuitos;
CREATE POLICY circuitos_super_admin_write ON circuitos FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
