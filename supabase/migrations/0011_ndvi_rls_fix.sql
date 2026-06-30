-- ASFION — Fix de RLS en ndvi_pasturas.
--
-- Bug: la migración 0009 creó la policy SELECT con USING (true), que
-- significa "cualquier usuario autenticado puede leer cualquier fila de
-- cualquier tenant". Eso es un leak cross-tenant grave (Crítico).
--
-- Fix: filtrar por cliente_id usando la función auxiliar que ya tiene
-- el resto del schema (current_cliente_id() definida en 0001_init).
--
-- Idempotente: dropea la policy vieja si existe y crea la nueva.

DROP POLICY IF EXISTS ndvi_select_policy ON ndvi_pasturas;

CREATE POLICY ndvi_select_policy ON ndvi_pasturas
  FOR SELECT
  USING (cliente_id = current_cliente_id());

-- Bloqueamos también INSERT/UPDATE/DELETE por las dudas — hoy la única
-- forma de crear rows en ndvi_pasturas es via service_role (migración
-- 0009 manual). No queremos que ningún usuario con session normal pueda
-- escribir mediciones falsas.

DROP POLICY IF EXISTS ndvi_insert_policy ON ndvi_pasturas;
DROP POLICY IF EXISTS ndvi_update_policy ON ndvi_pasturas;
DROP POLICY IF EXISTS ndvi_delete_policy ON ndvi_pasturas;

-- (sin políticas INSERT/UPDATE/DELETE → bloquea por default cuando RLS
-- está ON. service_role bypassea RLS de todos modos.)
