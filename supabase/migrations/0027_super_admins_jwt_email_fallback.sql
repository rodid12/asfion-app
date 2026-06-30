-- =============================================================================
-- 0027 — super_admins: encontrar el email del usuario en cualquier path
-- =============================================================================
--
-- Diagnóstico 29-jun: la query del usuario `SELECT auth.jwt() ->> 'email'`
-- devuelve NULL. La mig 0026 normalizaba el email para case-insensitive,
-- pero asume que el email viene en el JWT top-level — y en este proyecto
-- NO viene ahí (depende de cómo el provider de auth setea el token).
--
-- Posibles paths donde Supabase puede tener el email:
--   1. auth.jwt() ->> 'email'                       (top-level claim)
--   2. auth.jwt() -> 'user_metadata' ->> 'email'    (metadata del user)
--   3. auth.users.email                             (tabla interna, autoritativo)
--
-- Esta mig hace que `is_super_admin()` lo busque en los 3 con COALESCE +
-- normalización lower(trim()). Mientras alguno tenga el email, matchea.
-- Como la tabla auth.users.email es la fuente de verdad de Supabase Auth,
-- ese path SIEMPRE va a tener el valor correcto.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Verificar (logueado como agusufi20):
--        SELECT is_super_admin();   -- ahora debe devolver true
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Helper interno: extrae el email del usuario actual, mirando los 3 paths
--    Es SECURITY DEFINER para poder leer auth.users (restringida por RLS).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT lower(trim(
    COALESCE(
      auth.jwt() ->> 'email',
      auth.jwt() -> 'user_metadata' ->> 'email',
      (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  ));
$$;

COMMENT ON FUNCTION current_user_email() IS
  'Email del usuario actual normalizado (lower+trim). Busca en JWT top-level, '
  'user_metadata, y auth.users.email como fallback. Usar SIEMPRE en lugar '
  'de auth.jwt() ->> ''email'' directo — algunos providers no setean ese path.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Reescribir is_super_admin() usando el helper
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE email = current_user_email()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Reescribir policies de super_admins usando el helper
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS super_admins_select_self ON super_admins;
CREATE POLICY super_admins_select_self ON super_admins
  FOR SELECT TO authenticated
  USING (email = current_user_email());

DROP POLICY IF EXISTS super_admins_modify ON super_admins;
CREATE POLICY super_admins_modify ON super_admins
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación esperada (loguearse como agusufi20 antes):
--   SELECT current_user_email() AS mi_email,
--          is_super_admin()      AS soy_admin;
--   → mi_email = 'agusufi20@gmail.com'   (NUNCA null si el user está logueado)
--   → soy_admin = true
-- =============================================================================
