-- =============================================================================
-- 0036 — Campañas operativas generales
-- =============================================================================
--
-- La campaña operativa ordena la lectura de TODOS los módulos sin borrar
-- historia. Es distinta de `campanias_reproductivas`:
--
--   Operativa    2026/27: 01/09/2026 a 31/08/2027
--   Reproductiva 2026/27: 01/09/2026 a 31/03/2027 (migration 0030)
--
-- Los eventos siguen siendo la fuente de verdad y se asignan a una campaña
-- por su fecha en la app/dashboard. No agregamos `campania_id` a cada tabla:
-- evita duplicar estado y mantiene compatibles las importaciones históricas.

BEGIN;

CREATE TABLE IF NOT EXISTS campanias_operativas (
  id             TEXT PRIMARY KEY,
  cliente_id     TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  activa         BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campanias_operativas_fechas_chk CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS campanias_operativas_cliente_fecha_idx
  ON campanias_operativas(cliente_id, fecha_inicio DESC);

CREATE UNIQUE INDEX IF NOT EXISTS campanias_operativas_una_activa_idx
  ON campanias_operativas(cliente_id)
  WHERE activa;

ALTER TABLE campanias_operativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campanias_operativas_select ON campanias_operativas;
CREATE POLICY campanias_operativas_select ON campanias_operativas
  FOR SELECT TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin());

DROP POLICY IF EXISTS campanias_operativas_modify ON campanias_operativas;
CREATE POLICY campanias_operativas_modify ON campanias_operativas
  FOR ALL TO authenticated
  USING (current_user_can_manage_events() OR is_super_admin())
  WITH CHECK (
    (cliente_id = current_cliente_id() AND current_user_can_manage_events())
    OR is_super_admin()
  );

-- Dejamos también la campaña cerrada inmediata. Permite revisar el historial
-- desde el primer release del selector sin inventar fechas en el frontend.
INSERT INTO campanias_operativas (
  id, cliente_id, nombre, fecha_inicio, fecha_fin, activa, observaciones
)
VALUES
  (
    'campania-operativa-ganaderas-2025-2026',
    'ganaderas',
    'Campaña 2025/26',
    DATE '2025-09-01',
    DATE '2026-08-31',
    FALSE,
    'Campaña histórica anterior a la implementación del selector.'
  ),
  (
    'campania-operativa-ganaderas-2026-2027',
    'ganaderas',
    'Campaña 2026/27',
    DATE '2026-09-01',
    DATE '2027-08-31',
    TRUE,
    'Campaña operativa vigente. Pariciones finaliza internamente el 31/03/2027.'
  )
ON CONFLICT (id) DO UPDATE SET
  nombre        = EXCLUDED.nombre,
  fecha_inicio  = EXCLUDED.fecha_inicio,
  fecha_fin     = EXCLUDED.fecha_fin,
  activa        = EXCLUDED.activa,
  observaciones = EXCLUDED.observaciones,
  updated_at    = NOW();

COMMIT;

-- Verificación esperada para Ganaderas: dos filas y una sola activa.
SELECT id, nombre, fecha_inicio, fecha_fin, activa
FROM campanias_operativas
WHERE cliente_id = 'ganaderas'
ORDER BY fecha_inicio DESC;
