-- =============================================================================
-- 0026 — super_admins: comparación case-insensitive
-- =============================================================================
--
-- Problema reportado 29-jun: el usuario agusufi20@gmail.com está en la tabla
-- super_admins, pero el dashboard no le muestra las pestañas "Cobranzas" y
-- "Clientes". Las policies viejas comparaban email con `=` strict, lo cual
-- falla si:
--   - El JWT lo trae con alguna mayúscula (ej. el provider lo registra como
--     se tipeó en el sign-up).
--   - La tabla lo tiene normalizado en minúscula.
--
-- Solución defense-in-depth: comparación `lower(trim(...))` en ambos lados
-- de las policies + función helper `is_super_admin()` que ya existía para
-- usar desde otras tablas. También normalizamos los rows existentes a
-- lower(trim()) para que el `.eq('email', email)` del frontend (que ya
-- lowercasea antes de buscar) matchee.
--
-- También: `is_super_admin()` se reescribe para usar la comparación lower
-- y queda como SINGLE-SOURCE-OF-TRUTH — toda otra policy que dependa de
-- super-admin debería llamar a esta función y no replicar la lógica.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Verificar:
--        SELECT is_super_admin();   -- corrida con tu JWT activo
--      Debe devolver `true` si tu email está en la tabla.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Normalizar rows existentes a lower(trim()) — idempotente
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE super_admins SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Asegurar que nuevos INSERTs vengan normalizados — trigger BEFORE INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION super_admins_normalize_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS super_admins_normalize_email_trg ON super_admins;
CREATE TRIGGER super_admins_normalize_email_trg
BEFORE INSERT OR UPDATE ON super_admins
FOR EACH ROW EXECUTE FUNCTION super_admins_normalize_email();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Reescribir policies con comparación case-insensitive
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS super_admins_select_self ON super_admins;
CREATE POLICY super_admins_select_self ON super_admins
  FOR SELECT TO authenticated
  USING (email = lower(trim(auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS super_admins_modify ON super_admins;
CREATE POLICY super_admins_modify ON super_admins
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM super_admins sa
    WHERE sa.email = lower(trim(auth.jwt() ->> 'email'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM super_admins sa
    WHERE sa.email = lower(trim(auth.jwt() ->> 'email'))
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Reescribir is_super_admin() para usar comparación case-insensitive.
--    Esta función se usa en TODAS las policies del sistema que necesitan
--    chequear super-admin (campos, lotes, usuarios, billing, etc).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins
    WHERE email = lower(trim(auth.jwt() ->> 'email'))
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación esperada:
--   SELECT auth.jwt() ->> 'email' AS mi_email,
--          is_super_admin()       AS soy_admin;
--   → Si tu email (lower-trimmed) está en super_admins, soy_admin = true.
-- =============================================================================
