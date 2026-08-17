-- =============================================================================
-- 0030 — Vincular Preñez con Pariciones por campaña y campo
-- =============================================================================
--
-- Regla de negocio acordada para Ganaderas:
--   1. Preñez (`tactos`) es la foto INMUTABLE al inicio de la campaña.
--   2. Las categorías/rodeos se agrupan por campo (ej. "AG" = Agisot).
--   3. Pariciones consume esa base para calcular vacas por parir, pero nunca
--      modifica los tactos originales.
--   4. Los eventos nuevos reciben campaña automáticamente según su fecha.
--   5. `campos.stock_inicial_vacas` queda como cache del stock de la campaña
--      activa para mantener compatibles la app móvil y el dashboard actual.
--
-- Campaña inicial de este cambio: 2026-2027 (01/09/2026 a 31/03/2027).
-- La migración es idempotente y se puede ejecutar más de una vez.

BEGIN;

-- =============================================================================
-- 1) Catálogo de campañas reproductivas
-- =============================================================================

CREATE TABLE IF NOT EXISTS campanias_reproductivas (
  id             TEXT PRIMARY KEY,
  cliente_id     TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  servicio_anio  INTEGER NOT NULL,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  activa         BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campanias_reproductivas_fechas_chk CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS campanias_reproductivas_cliente_idx
  ON campanias_reproductivas(cliente_id, fecha_inicio DESC);

-- Una sola campaña activa por cliente.
CREATE UNIQUE INDEX IF NOT EXISTS campanias_reproductivas_una_activa_idx
  ON campanias_reproductivas(cliente_id)
  WHERE activa;

ALTER TABLE campanias_reproductivas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campanias_reproductivas_select ON campanias_reproductivas;
CREATE POLICY campanias_reproductivas_select ON campanias_reproductivas
  FOR SELECT TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin());

DROP POLICY IF EXISTS campanias_reproductivas_modify ON campanias_reproductivas;
CREATE POLICY campanias_reproductivas_modify ON campanias_reproductivas
  FOR ALL TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin())
  WITH CHECK (cliente_id = current_cliente_id() OR is_super_admin());

-- =============================================================================
-- 2) Relaciones: campaña/campo en tactos y campaña en pariciones
-- =============================================================================

ALTER TABLE tactos
  ADD COLUMN IF NOT EXISTS campo_id TEXT REFERENCES campos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS campania_id TEXT REFERENCES campanias_reproductivas(id) ON DELETE RESTRICT;

ALTER TABLE pariciones
  ADD COLUMN IF NOT EXISTS campania_id TEXT REFERENCES campanias_reproductivas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS tactos_campania_campo_idx
  ON tactos(cliente_id, campania_id, campo_id);

CREATE INDEX IF NOT EXISTS pariciones_campania_campo_fecha_idx
  ON pariciones(cliente_id, campania_id, campo_id, fecha DESC);

-- =============================================================================
-- 3) Campaña Ganaderas 2026-2027
-- =============================================================================

INSERT INTO campanias_reproductivas (
  id, cliente_id, nombre, servicio_anio,
  fecha_inicio, fecha_fin, activa, observaciones
)
VALUES (
  'campania-ganaderas-2026-2027',
  'ganaderas',
  'Campaña 2026-2027',
  2026,
  DATE '2026-09-01',
  DATE '2027-03-31',
  TRUE,
  'Stock inicial tomado del último Excel de Preñez. AG corresponde a Agisot.'
)
ON CONFLICT (id) DO UPDATE SET
  nombre        = EXCLUDED.nombre,
  servicio_anio = EXCLUDED.servicio_anio,
  fecha_inicio  = EXCLUDED.fecha_inicio,
  fecha_fin     = EXCLUDED.fecha_fin,
  activa        = EXCLUDED.activa,
  observaciones = EXCLUDED.observaciones,
  updated_at    = NOW();

-- =============================================================================
-- 4) Mapeo de categorías/rodeos de Preñez al campo real
-- =============================================================================
--
-- Varias filas pertenecen al mismo campo y se suman en el visualizador:
--   Carolina = Vaquillas 2° Serv C + Vacas Carolina
--   Picaflor = Vacas Picaflor IATF + Vacas Picaflor Toro
--   AG = Agisot

UPDATE tactos
SET campo_id = CASE id
    WHEN 'tacto-gva-001' THEN 'campo-margarita'
    WHEN 'tacto-gva-002' THEN 'campo-agisot'
    WHEN 'tacto-gva-003' THEN 'campo-carolina'
    WHEN 'tacto-gva-004' THEN 'campo-carolina'
    WHEN 'tacto-gva-005' THEN 'campo-progreso'
    WHEN 'tacto-gva-006' THEN 'campo-picaflor'
    WHEN 'tacto-gva-007' THEN 'campo-picaflor'
    ELSE campo_id
  END,
  campo = CASE id
    WHEN 'tacto-gva-001' THEN 'Margarita'
    WHEN 'tacto-gva-002' THEN 'Agisot'
    WHEN 'tacto-gva-003' THEN 'Carolina'
    WHEN 'tacto-gva-004' THEN 'Carolina'
    WHEN 'tacto-gva-005' THEN 'Progreso'
    WHEN 'tacto-gva-006' THEN 'Picaflor'
    WHEN 'tacto-gva-007' THEN 'Picaflor'
    ELSE campo
  END,
  campania_id = 'campania-ganaderas-2026-2027',
  updated_at = NOW()
WHERE cliente_id = 'ganaderas'
  AND id IN (
    'tacto-gva-001', 'tacto-gva-002', 'tacto-gva-003', 'tacto-gva-004',
    'tacto-gva-005', 'tacto-gva-006', 'tacto-gva-007'
  );

-- =============================================================================
-- 5) Asignación automática de campaña a cada nueva parición
-- =============================================================================

CREATE OR REPLACE FUNCTION asignar_campania_a_paricion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT c.id
    INTO NEW.campania_id
  FROM campanias_reproductivas c
  WHERE c.cliente_id = NEW.cliente_id
    AND NEW.fecha BETWEEN c.fecha_inicio AND c.fecha_fin
  ORDER BY c.activa DESC, c.fecha_inicio DESC
  LIMIT 1;

  -- Si no existe campaña para la fecha, queda NULL. No bloqueamos cargas
  -- históricas: el dashboard seguirá usando el resumen/flujo legacy.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pariciones_asignar_campania_trg ON pariciones;
CREATE TRIGGER pariciones_asignar_campania_trg
  BEFORE INSERT OR UPDATE OF cliente_id, fecha
  ON pariciones
  FOR EACH ROW
  EXECUTE FUNCTION asignar_campania_a_paricion();

-- Backfill defensivo por si ya se cargaron eventos de septiembre antes de
-- ejecutar esta migración.
UPDATE pariciones p
SET campania_id = c.id
FROM campanias_reproductivas c
WHERE p.cliente_id = c.cliente_id
  AND p.fecha BETWEEN c.fecha_inicio AND c.fecha_fin
  AND p.campania_id IS DISTINCT FROM c.id;

-- =============================================================================
-- 6) Cache compatible: sincronizar campos.stock_inicial_vacas desde Preñez
-- =============================================================================
--
-- La fuente de verdad sigue siendo `tactos`. Esta función solo mantiene el
-- campo histórico que ya consumen la app y el dashboard, evitando tener dos
-- fórmulas distintas durante la transición.

CREATE OR REPLACE FUNCTION _refrescar_stock_prenez_activa(p_cliente_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE campos c
  SET stock_inicial_vacas = COALESCE((
    SELECT SUM(
      COALESCE(t.prenez_cabeza, 0) +
      COALESCE(t.prenez_cuerpo, 0) +
      COALESCE(t.prenez_cola, 0)
    )::INTEGER
    FROM tactos t
    JOIN campanias_reproductivas cr ON cr.id = t.campania_id
    WHERE t.cliente_id = p_cliente_id
      AND t.campo_id = c.id
      AND cr.activa = TRUE
  ), 0)
  WHERE c.cliente_id = p_cliente_id;
END;
$$;

-- Helper interno: no se expone como RPC a usuarios autenticados.
REVOKE ALL ON FUNCTION _refrescar_stock_prenez_activa(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION _refrescar_stock_prenez_activa(TEXT) FROM anon;
REVOKE ALL ON FUNCTION _refrescar_stock_prenez_activa(TEXT) FROM authenticated;

CREATE OR REPLACE FUNCTION refrescar_stock_prenez_desde_tacto_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_nuevo TEXT;
  v_cliente_anterior TEXT;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    v_cliente_nuevo := NEW.cliente_id;
    PERFORM _refrescar_stock_prenez_activa(v_cliente_nuevo);
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_cliente_anterior := OLD.cliente_id;
    IF v_cliente_anterior IS DISTINCT FROM v_cliente_nuevo THEN
      PERFORM _refrescar_stock_prenez_activa(v_cliente_anterior);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tactos_refrescar_stock_prenez_trg ON tactos;
CREATE TRIGGER tactos_refrescar_stock_prenez_trg
  AFTER INSERT OR UPDATE OR DELETE
  ON tactos
  FOR EACH ROW
  EXECUTE FUNCTION refrescar_stock_prenez_desde_tacto_trg();

CREATE OR REPLACE FUNCTION refrescar_stock_prenez_desde_campania_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM _refrescar_stock_prenez_activa(NEW.cliente_id);
  IF TG_OP = 'UPDATE' AND OLD.cliente_id IS DISTINCT FROM NEW.cliente_id THEN
    PERFORM _refrescar_stock_prenez_activa(OLD.cliente_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campanias_refrescar_stock_prenez_trg ON campanias_reproductivas;
CREATE TRIGGER campanias_refrescar_stock_prenez_trg
  AFTER INSERT OR UPDATE OF activa
  ON campanias_reproductivas
  FOR EACH ROW
  EXECUTE FUNCTION refrescar_stock_prenez_desde_campania_trg();

-- Primera sincronización. Resultado esperado Ganaderas: 2.715 preñadas.
SELECT _refrescar_stock_prenez_activa('ganaderas');

COMMIT;

-- =============================================================================
-- VERIFICACIÓN — ejecutar después de la migración
-- =============================================================================
--
-- 1) Stock por campo esperado:
--      Agisot       463
--      Carolina     826
--      Margarita    235
--      Picaflor     803
--      Progreso     388
--      TOTAL      2.715
--
-- SELECT
--   c.nombre AS campo,
--   c.stock_inicial_vacas AS prenadas_iniciales
-- FROM campos c
-- WHERE c.cliente_id = 'ganaderas'
--   AND c.stock_inicial_vacas > 0
-- ORDER BY c.nombre;
--
-- 2) Ninguno de los 7 tactos puede quedar sin campo/campaña:
--
-- SELECT id, rodeo, campo, campo_id, campania_id,
--        prenez_cabeza + prenez_cuerpo + prenez_cola AS prenadas
-- FROM tactos
-- WHERE cliente_id = 'ganaderas'
-- ORDER BY campo, rodeo;
--
-- 3) Cuando haya cargas nuevas, deben salir con campaña automática:
--
-- SELECT fecha, campo_id, campania_id, evento, COUNT(*)
-- FROM pariciones
-- WHERE cliente_id = 'ganaderas' AND fecha >= DATE '2026-09-01'
-- GROUP BY fecha, campo_id, campania_id, evento
-- ORDER BY fecha DESC;
