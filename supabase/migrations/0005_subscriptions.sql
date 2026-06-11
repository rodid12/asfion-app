-- ASFION — Subscription enforcement.
--
-- Modelo de cobranza: cada cliente paga periódicamente (mes, trimestre, año).
-- La app refuerza el pago en escalera SUAVE — el cliente nunca pierde acceso
-- a sus datos, pero la fricción aumenta a medida que pasa el vencimiento:
--
--   active        → todo normal
--   past_due      → días 1-7 vencido: banner naranja, app sigue operativa
--   restricted    → días 8-19 vencido: read-only, no se cargan eventos nuevos
--   suspended     → días 20+ vencido: login bloqueado salvo para export
--   canceled      → cuenta cerrada, solo data retention (sin login)
--
-- El estado lo mueve un cron diario (Supabase Edge Function en 0006). El admin
-- de ASFION marca pagos recibidos vía el dashboard, que avanza period_end_date
-- y vuelve el status a 'active'.

-- =============================================================================
-- ALTER: clientes — agregar columnas de subscription
-- =============================================================================
ALTER TABLE clientes
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due', 'restricted', 'suspended', 'canceled')),
  ADD COLUMN period_end_date DATE,                          -- próximo vencimiento (NULL = no billing setup)
  ADD COLUMN last_payment_date TIMESTAMPTZ,                 -- última transferencia confirmada
  ADD COLUMN billing_notes TEXT;                            -- notas internas del admin (no se muestran al cliente)

CREATE INDEX clientes_subscription_status_idx ON clientes(subscription_status);
CREATE INDEX clientes_period_end_idx ON clientes(period_end_date)
  WHERE subscription_status IN ('active', 'past_due', 'restricted');

COMMENT ON COLUMN clientes.subscription_status IS
  'Estado de cobranza. Lo mueve el cron diario de transiciones (0006). '
  'active → past_due al día 1, → restricted al día 8, → suspended al día 20.';
COMMENT ON COLUMN clientes.period_end_date IS
  'Fecha hasta la cual está pagado. Cuando ya pasó esta fecha, el cron mueve '
  'el status. Cuando el admin marca un pago, esta fecha avanza N días según el plan.';

-- =============================================================================
-- TABLA: payments — historial de pagos recibidos
-- =============================================================================
-- Audit trail. No tiene RLS sobre policies de cliente: solo el admin
-- (super_admin) puede leer/escribir. Para el cliente no es visible.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha_pago DATE NOT NULL,                                 -- cuándo el cliente pagó (no cuándo se cargó)
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  moneda TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS', 'USD')),
  metodo TEXT NOT NULL CHECK (metodo IN ('transferencia', 'efectivo', 'mercadopago', 'otro')),
  -- Período cubierto por este pago. Ej: paga 30 días → cubre desde
  -- (period_end_date anterior + 1) hasta (period_end_date nuevo).
  cubre_hasta DATE NOT NULL,
  notas TEXT,                                               -- comentario libre del admin
  -- Email del admin que confirmó el pago (audit).
  registrado_por TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_cliente_fecha_idx ON payments(cliente_id, fecha_pago DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- payments no se expone a clientes — solo super_admin puede ver/escribir.
-- Por ahora la policy chequea contra una whitelist hardcoded de emails;
-- cuando tengamos una tabla `super_admins` la migramos.
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT (auth.jwt() ->> 'email') IN (
    -- Whitelist de admins de ASFION. Editar acá para sumar a alguien al
    -- panel de billing. (Idealmente moverlo a una tabla en el futuro.)
    'rosariodidziulis8@gmail.com'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY payments_super_admin_only ON payments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- También: el super_admin puede leer/escribir `clientes` (para marcar pagos
-- y cambiar status). Esto se SUMA a la policy existente clientes_select,
-- que sigue dejando que cada cliente lea su propio row.
CREATE POLICY clientes_super_admin_write ON clientes FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =============================================================================
-- HELPER: ¿el cliente actual puede ESCRIBIR (cargar eventos)?
-- =============================================================================
-- Read = siempre OK (para que el cliente pueda exportar incluso suspended).
-- Write = solo si está active o past_due (días 1-7).
-- restricted, suspended, canceled → no se cargan eventos nuevos.
CREATE OR REPLACE FUNCTION current_cliente_can_write() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM clientes c
    WHERE c.id = current_cliente_id()
      AND c.subscription_status IN ('active', 'past_due')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- ACTUALIZAR RLS POLICIES — separar SELECT (siempre OK) de INSERT/UPDATE/DELETE
-- (requieren subscription activa). DELETE intencionalmente bloqueado en
-- restricted para que un cliente vencido no pueda borrar evidencia de eventos.
-- =============================================================================

-- pariciones
DROP POLICY IF EXISTS pariciones_all ON pariciones;

CREATE POLICY pariciones_select ON pariciones FOR SELECT
  USING (cliente_id = current_cliente_id());

CREATE POLICY pariciones_write ON pariciones FOR INSERT
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY pariciones_update ON pariciones FOR UPDATE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write())
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY pariciones_delete ON pariciones FOR DELETE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write());

-- lluvias
DROP POLICY IF EXISTS lluvias_all ON lluvias;

CREATE POLICY lluvias_select ON lluvias FOR SELECT
  USING (cliente_id = current_cliente_id());

CREATE POLICY lluvias_write ON lluvias FOR INSERT
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY lluvias_update ON lluvias FOR UPDATE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write())
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY lluvias_delete ON lluvias FOR DELETE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write());

-- mortandad
DROP POLICY IF EXISTS mortandad_all ON mortandad;

CREATE POLICY mortandad_select ON mortandad FOR SELECT
  USING (cliente_id = current_cliente_id());

CREATE POLICY mortandad_write ON mortandad FOR INSERT
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY mortandad_update ON mortandad FOR UPDATE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write())
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY mortandad_delete ON mortandad FOR DELETE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write());

-- pastoreo
DROP POLICY IF EXISTS pastoreo_all ON pastoreo;

CREATE POLICY pastoreo_select ON pastoreo FOR SELECT
  USING (cliente_id = current_cliente_id());

CREATE POLICY pastoreo_write ON pastoreo FOR INSERT
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY pastoreo_update ON pastoreo FOR UPDATE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write())
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY pastoreo_delete ON pastoreo FOR DELETE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write());

-- compras
DROP POLICY IF EXISTS compras_all ON compras;

CREATE POLICY compras_select ON compras FOR SELECT
  USING (cliente_id = current_cliente_id());

CREATE POLICY compras_write ON compras FOR INSERT
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY compras_update ON compras FOR UPDATE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write())
  WITH CHECK (cliente_id = current_cliente_id() AND current_cliente_can_write());

CREATE POLICY compras_delete ON compras FOR DELETE
  USING (cliente_id = current_cliente_id() AND current_cliente_can_write());

-- NOTE: NO tocamos las policies de campos/lotes/pluviometros/circuitos/parcelas.
-- Son catálogos, no eventos. Aunque la subscription esté vencida, debería poder
-- modificarlos el admin si está en past_due (lo necesita para reorganizar antes
-- de pagar). En restricted/suspended sí queda bloqueado pero por la falta de
-- login mismo, no por RLS sobre catálogos.
--
-- Si en el futuro queremos endurecer esto, sumamos current_cliente_can_write()
-- a las policies de catálogos también.
