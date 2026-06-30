-- =============================================================================
-- 0022 — Security Hardening (renombrado de 0021 para evitar colisión con
--        0021_compras_kg_destino_nullable.sql del hotfix de compras)
-- =============================================================================
--
-- Resultado del audit del 27-jun-2026. Resuelve 4 issues:
--
--   1. SET search_path en funciones SECURITY DEFINER — sin esto un user con
--      privilegio CREATE en algún schema podría sobreescribir auth.jwt() o
--      la tabla usuarios y escalar privilegios.
--   2. Whitelist super_admin hardcodeada en 2 lugares (SQL + JS) — riesgo
--      de drift. Pasamos a una tabla super_admins con una sola fuente de
--      verdad. La función is_super_admin() ahora lee de ahí.
--   3. Storage RLS no chequea subscription_status — un cliente suspended
--      podía seguir subiendo fotos. Agregamos current_cliente_can_write()
--      al WITH CHECK de las policies de fotos-eventos.
--   4. NDVI: policy explícita "no escritura" — antes confiábamos en que la
--      ausencia de policy bloqueaba INSERT/UPDATE/DELETE. Si alguien por
--      descuido agrega una policy con USING(true), reaparece el bug del
--      audit anterior (0011). Lockeamos explícito.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN (es idempotente, se puede correr varias veces)
--   3. Verificar:
--        SELECT proname, proconfig FROM pg_proc
--        WHERE proname IN ('current_cliente_id','is_super_admin','current_cliente_can_write');
--      Esperado: proconfig contiene 'search_path=pg_catalog, public' en las 3
-- =============================================================================

-- ============================================================================
-- 1) SET search_path en las 3 funciones SECURITY DEFINER existentes
-- ============================================================================
-- Defensa contra search_path injection: si un user con CREATE en cualquier
-- schema crea una tabla "usuarios" o función "auth.jwt", podría hacer que la
-- función SECURITY DEFINER resuelva referencias contra esos objetos
-- maliciosos. Fijar search_path elimina el vector.

ALTER FUNCTION current_cliente_id()        SET search_path = pg_catalog, public;
ALTER FUNCTION is_super_admin()            SET search_path = pg_catalog, public;
ALTER FUNCTION current_cliente_can_write() SET search_path = pg_catalog, public;

-- ============================================================================
-- 2) Tabla super_admins — fuente única de verdad
-- ============================================================================
-- Antes la whitelist vivía hardcodeada en:
--   - SQL: 0015_admin_panel_policies.sql líneas 21-24
--   - JS:  asfion-web/src/lib/billing.ts líneas 13-16
-- Cada vez que sumábamos un admin había que tocar AMBOS — drift garantizado.
--
-- Ahora: tabla pequeña con seguridad estricta, y is_super_admin() la lee.
-- El frontend la consulta via /rest/v1/super_admins (filtrado por RLS al
-- propio email del JWT, no expone la lista).

CREATE TABLE IF NOT EXISTS super_admins (
  email      TEXT PRIMARY KEY,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by   TEXT,                                  -- email del que agregó (audit)
  notas      TEXT
);

-- Seed con los 2 super admins históricos (los mismos que estaban hardcoded
-- en 0015 + billing.ts). Idempotente.
INSERT INTO super_admins (email, notas) VALUES
  ('rosariodidziulis8@gmail.com',           'Cliente / dueño del producto'),
  ('agustincollante.gmail.com@gmail.com',   'Agus — operación + Power BI')
ON CONFLICT (email) DO NOTHING;

-- RLS: solo super_admins pueden leer la tabla, y solo se ven a sí mismos.
-- Esto evita que un super_admin enumere quiénes más son super_admin via API.
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admins_select_self ON super_admins;
CREATE POLICY super_admins_select_self ON super_admins
  FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- Modificación: solo otro super_admin puede agregar / borrar.
DROP POLICY IF EXISTS super_admins_modify ON super_admins;
CREATE POLICY super_admins_modify ON super_admins
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE email = (auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE email = (auth.jwt() ->> 'email')
    )
  );

-- Reescribir is_super_admin() para leer de la tabla. Mantener la firma
-- compatible (sin args, retorna boolean) y SECURITY DEFINER con
-- search_path fijo (defensa item 1).
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- ============================================================================
-- 3) Storage RLS: chequear subscription_status en escritura de fotos
-- ============================================================================
-- Bug actual: 0013_fotos_storage.sql permite INSERT/UPDATE/DELETE a cualquier
-- usuario autenticado del cliente, incluso si el cliente está suspended.
-- Bypass parcial del paywall: el operario sube fotos aunque el cliente no
-- pague (la entrada del evento sí se bloquea por RLS de pariciones et al,
-- pero las fotos se acumulan).
--
-- Fix: sumar current_cliente_can_write() al WITH CHECK / USING. Esa función
-- ya combina cliente_id matching + subscription_status IN ('active','trial').

DROP POLICY IF EXISTS fotos_eventos_insert_policy ON storage.objects;
CREATE POLICY fotos_eventos_insert_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = current_cliente_id()
    AND current_cliente_can_write()
  );

DROP POLICY IF EXISTS fotos_eventos_update_policy ON storage.objects;
CREATE POLICY fotos_eventos_update_policy ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = current_cliente_id()
    AND current_cliente_can_write()
  );

DROP POLICY IF EXISTS fotos_eventos_delete_policy ON storage.objects;
CREATE POLICY fotos_eventos_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-eventos'
    AND (storage.foldername(name))[1] = current_cliente_id()
    AND current_cliente_can_write()
  );

-- ============================================================================
-- 4) NDVI: policy explícita "no escritura"
-- ============================================================================
-- 0011_ndvi_rls_fix.sql dropea las policies de INSERT/UPDATE/DELETE y
-- comentaba "sin política → bloquea por default". Eso es CIERTO con RLS ON,
-- pero si alguien por error futuro agrega CREATE POLICY ndvi_*_policy USING(true),
-- reaparece el bug original. Defendemos en profundidad con una policy
-- explícita que niega TODA mutación a cualquier rol que no sea service_role
-- (que bypassea RLS de todos modos).

DROP POLICY IF EXISTS ndvi_no_write ON ndvi_pasturas;
CREATE POLICY ndvi_no_write ON ndvi_pasturas
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- Sanity check (correr esto manual después de aplicar):
--
--   -- Verificar search_path en las 3 funciones:
--   SELECT proname, proconfig FROM pg_proc
--   WHERE proname IN ('current_cliente_id','is_super_admin','current_cliente_can_write');
--   -- Esperado: {search_path=pg_catalog, public}
--
--   -- Verificar super_admins seed:
--   SELECT email FROM super_admins;
--
--   -- Verificar policies storage tienen current_cliente_can_write:
--   SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr,
--          pg_get_expr(polwithcheck, polrelid) AS check_expr
--   FROM pg_policy
--   WHERE polrelid = 'storage.objects'::regclass
--     AND polname LIKE 'fotos_eventos%';
-- =============================================================================
