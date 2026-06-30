-- ASFION — Tabla `tactos` para el módulo Preñez.
--
-- Bug que motivó esta migración: `asfion-web/src/pages/Dashboard.tsx`
-- tenía un array literal `TACTOS_GVA` con los 7 rodeos de Ganaderas
-- hardcodeado en el código TypeScript. Eso significaba:
--   1. Cualquier nuevo cliente veía los rodeos de Ganaderas en su Preñez
--      (leak cross-tenant — bypassea RLS por completo)
--   2. Para actualizar un tacto había que hacer release de código
--   3. No había forma de que el veterinario cargara desde la app
--
-- Esta migración:
--   - Crea la tabla `tactos` con todas las columnas del modelo Preñez
--   - Aplica RLS por cliente_id
--   - Inserta los 7 rodeos de Ganaderas como data inicial
--   - El próximo paso (en el código TS) es reemplazar el import literal
--     por un fetch desde aquí

-- ============================================================================
-- 1) Tabla tactos
-- ============================================================================

CREATE TABLE IF NOT EXISTS tactos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  rodeo TEXT NOT NULL,
  campo TEXT,                       -- texto libre, opcional
  fecha DATE,                       -- fecha del tacto, opcional (los del piloto no la tienen)
  origen_total INTEGER NOT NULL,    -- cabezas del rodeo
  prenez_cabeza INTEGER NOT NULL DEFAULT 0,
  prenez_cuerpo INTEGER NOT NULL DEFAULT 0,
  prenez_cola   INTEGER NOT NULL DEFAULT 0,
  vacias        INTEGER NOT NULL DEFAULT 0,
  perdon        INTEGER NOT NULL DEFAULT 0,
  descarte      INTEGER NOT NULL DEFAULT 0,
  feed_lot      INTEGER NOT NULL DEFAULT 0,
  observaciones TEXT,
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tactos_cliente_idx ON tactos(cliente_id);
CREATE INDEX IF NOT EXISTS tactos_cliente_rodeo_idx ON tactos(cliente_id, rodeo);

-- ============================================================================
-- 2) RLS — los usuarios solo ven sus propios tactos
-- ============================================================================

ALTER TABLE tactos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tactos_select_policy ON tactos;
CREATE POLICY tactos_select_policy ON tactos
  FOR SELECT
  USING (cliente_id = current_cliente_id());

DROP POLICY IF EXISTS tactos_insert_policy ON tactos;
CREATE POLICY tactos_insert_policy ON tactos
  FOR INSERT
  WITH CHECK (cliente_id = current_cliente_id());

DROP POLICY IF EXISTS tactos_update_policy ON tactos;
CREATE POLICY tactos_update_policy ON tactos
  FOR UPDATE
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

DROP POLICY IF EXISTS tactos_delete_policy ON tactos;
CREATE POLICY tactos_delete_policy ON tactos
  FOR DELETE
  USING (cliente_id = current_cliente_id());

-- ============================================================================
-- 3) Seed: los 7 rodeos del piloto Ganaderas (tomado del Excel
--    `Prenez` del GVA_F(7).xlsx que mandó Agus en su momento)
-- ============================================================================

INSERT INTO tactos (id, cliente_id, rodeo, origen_total, prenez_cabeza, prenez_cuerpo, prenez_cola, vacias, perdon, descarte, feed_lot) VALUES
  ('tacto-gva-001', 'ganaderas', 'VQ 27M Margarita',     254, 123,  86, 26, 19, 0, 0, 0),
  ('tacto-gva-002', 'ganaderas', 'Vaquillas 15M Ag',     529, 336,  96, 31, 65, 0, 0, 0),
  ('tacto-gva-003', 'ganaderas', 'Vaquillas 2° Serv C',  540,   0,   0,  0,  0, 0, 0, 0),
  ('tacto-gva-004', 'ganaderas', 'Vacas Carolina',       416, 141, 140, 86, 48, 0, 0, 0),
  ('tacto-gva-005', 'ganaderas', 'Vacas Progreso',       418, 192, 138, 58, 30, 0, 0, 0),
  ('tacto-gva-006', 'ganaderas', 'Vacas Picaflor IATF',  557,   0,   0,  0,  0, 0, 0, 0),
  ('tacto-gva-007', 'ganaderas', 'Vacas Picaflor Toro',  358,   0,   0,  0,  0, 0, 0, 0)
ON CONFLICT (id) DO UPDATE SET
  rodeo         = EXCLUDED.rodeo,
  origen_total  = EXCLUDED.origen_total,
  prenez_cabeza = EXCLUDED.prenez_cabeza,
  prenez_cuerpo = EXCLUDED.prenez_cuerpo,
  prenez_cola   = EXCLUDED.prenez_cola,
  vacias        = EXCLUDED.vacias,
  perdon        = EXCLUDED.perdon,
  descarte      = EXCLUDED.descarte,
  feed_lot      = EXCLUDED.feed_lot,
  updated_at    = now();
