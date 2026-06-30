-- =============================================================================
-- 0018 — Pastoreo Ciclos (Largada / Control / Final)
-- =============================================================================
--
-- Contexto: el cliente nos pasó el Excel corregido "cierre pastoreo 26(2).xlsx"
-- con la estructura definitiva de seguimiento de pastoreo: cada grupo tiene
-- TRES etapas de pesaje:
--
--   1. LARGADA      → momento de ingreso al circuito (peso inicial, cabezas)
--   2. CONTROL      → pesaje intermedio opcional (60-90 días después)
--   3. CIERRE/FINAL → encierre / salida del circuito (peso de salida, GDPV)
--
-- La tabla `pastoreo` actual usa el modelo "evento" (Entrada/Salida) que NO
-- representa esto bien: 1 ciclo necesita 1 row, no 2-3 rows.
--
-- Solución: tabla NUEVA `pastoreo_ciclos` con columnas para las 3 etapas en
-- una sola fila — matchea 1:1 el Excel del cliente, y simplifica la UI.
-- La tabla vieja `pastoreo` se mantiene para no romper lo cargado por la app
-- móvil (las "Entradas" individuales pueden seguir viviendo ahí), pero el
-- dashboard de Pastoreo va a leer de `pastoreo_ciclos`.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar este archivo y RUN
--   3. Verificar:
--        SELECT COUNT(*) AS total,
--               COUNT(fecha_control) AS con_control,
--               COUNT(fecha_encierre) AS con_cierre,
--               SUM(cant_animales) AS total_cabezas
--        FROM pastoreo_ciclos WHERE cliente_id = 'ganaderas';
--      Esperado: total=15, con_control≈5, con_cierre=13, cabezas=8161
-- =============================================================================

-- ============================================================================
-- 1) Schema de la tabla
-- ============================================================================

CREATE TABLE IF NOT EXISTS pastoreo_ciclos (
  id                                TEXT PRIMARY KEY,
  cliente_id                        TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  -- Identificación del ciclo
  campo_id                          TEXT REFERENCES campos(id) ON DELETE SET NULL,
  campo_nombre                      TEXT NOT NULL,   -- denormalizado para queries rápidas
  circuito_nombre                   TEXT NOT NULL,   -- nombre tal cual aparece en el Excel
  categoria                         TEXT NOT NULL,   -- novillito / Vaquillas / Vaq 15M / Vaq a 27 Meses

  -- Datos comunes
  has_circuito                      NUMERIC(10,2),
  cant_animales                     INTEGER,         -- cant a la largada
  carga_ca_ha                       NUMERIC(8,3),    -- = cant_animales / has

  -- ========== ETAPA 1: LARGADA (ingreso) ==========
  fecha_ingreso                     DATE,
  peso_prom_ingreso_sin_desbaste    NUMERIC(8,2),
  kg_neto_ingreso_desbaste          NUMERIC(8,2),    -- = peso_prom * 0.95
  kg_totales_carne_ingreso          NUMERIC(12,2),
  carga_kg_carne_ha_real            NUMERIC(10,2),

  -- ========== ETAPA 2: CONTROL (opcional, intermedio) ==========
  fecha_control                     DATE,
  cant_control                      INTEGER,
  kg_neto_control                   NUMERIC(8,2),
  kg_totales_carne_control          NUMERIC(12,2),
  kg_carne_producidos_animal_control NUMERIC(8,2),
  dias_pastoreo_control             INTEGER,
  gdpv_control                      NUMERIC(6,3),
  kg_carne_producidos_ha_control    NUMERIC(10,2),

  -- ========== ETAPA 3: CIERRE / FINAL (encierre) ==========
  fecha_encierre                    DATE,
  cant_final                        INTEGER,
  kg_neto_final                     NUMERIC(8,2),
  kg_totales_carne_final            NUMERIC(12,2),
  kg_carne_producidos_animal_final  NUMERIC(8,2),
  dias_pastoreo_final               INTEGER,
  gdpv_final                        NUMERIC(6,3),
  kg_carne_producidos_ha_final      NUMERIC(10,2),

  -- Auditoría
  observaciones                     TEXT,
  creado_por_email                  TEXT,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pastoreo_ciclos_cliente ON pastoreo_ciclos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pastoreo_ciclos_campo   ON pastoreo_ciclos(cliente_id, campo_nombre);
CREATE INDEX IF NOT EXISTS idx_pastoreo_ciclos_cat     ON pastoreo_ciclos(cliente_id, categoria);
CREATE INDEX IF NOT EXISTS idx_pastoreo_ciclos_ingreso ON pastoreo_ciclos(cliente_id, fecha_ingreso DESC);

-- ============================================================================
-- 2) RLS — multi-tenant
-- ============================================================================
ALTER TABLE pastoreo_ciclos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pastoreo_ciclos_select ON pastoreo_ciclos;
DROP POLICY IF EXISTS pastoreo_ciclos_modify ON pastoreo_ciclos;

CREATE POLICY pastoreo_ciclos_select ON pastoreo_ciclos
  FOR SELECT TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin());

CREATE POLICY pastoreo_ciclos_modify ON pastoreo_ciclos
  FOR ALL TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin())
  WITH CHECK (cliente_id = current_cliente_id() OR is_super_admin());

-- ============================================================================
-- 3) Asegurar que el campo La Hoyada exista (no estaba en el seed original)
-- ============================================================================
INSERT INTO campos (id, cliente_id, nombre, organizacion_id)
VALUES ('campo-la-hoyada', 'ganaderas', 'La Hoyada', 'org-ganaderas')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4) Seed de 15 ciclos del Excel "cierre pastoreo 26(2).xlsx" Hoja 1
-- ============================================================================
-- IDs estables tipo: pasto-ciclo-2026-NN  (idempotente)
-- Las filas con kg_neto_final = 0 (sin cierre real) tienen las columnas
-- finales en NULL — son ciclos "en curso" o sin pesaje final.

INSERT INTO pastoreo_ciclos (
  id, cliente_id, campo_id, campo_nombre, circuito_nombre, categoria,
  has_circuito, cant_animales, carga_ca_ha,
  fecha_ingreso, peso_prom_ingreso_sin_desbaste, kg_neto_ingreso_desbaste,
  kg_totales_carne_ingreso, carga_kg_carne_ha_real,
  fecha_control, cant_control, kg_neto_control, kg_totales_carne_control,
  kg_carne_producidos_animal_control, dias_pastoreo_control, gdpv_control,
  kg_carne_producidos_ha_control,
  fecha_encierre, cant_final, kg_neto_final, kg_totales_carne_final,
  kg_carne_producidos_animal_final, dias_pastoreo_final, gdpv_final,
  kg_carne_producidos_ha_final
) VALUES
  -- 1: Aguisot · 9 y 11 · novillito
  ('pasto-ciclo-2026-01','ganaderas','campo-agisot','Aguisot','9 y 11','novillito',
   153,582,3.804,
   '2026-01-02',371.11,352.55,205186.72,1341.09,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-05',579,405.45,234755.55,52.90,123,0.430,193.26),

  -- 2: Aguisot · 13 Y 15 · novillito (con control)
  ('pasto-ciclo-2026-02','ganaderas','campo-agisot','Aguisot','13 Y 15','novillito',
   129,500,3.876,
   '2026-01-04',334.06,317.36,158678.50,1230.07,
   '2026-04-08',500,358.66,173625.00,29.89,122,0.250,115.86,
   '2026-05-06',500,347.25,173625.00,29.89,122,0.250,115.86),

  -- 3: Aguisot · Lote 7 · novillito (con control)
  ('pasto-ciclo-2026-03','ganaderas','campo-agisot','Aguisot','Lote 7','novillito',
   91,389,4.275,
   '2026-01-04',332.30,315.69,122801.46,1349.47,
   '2026-03-29',382,359.11,137138.00,43.31,122,0.360,157.54,
   '2026-05-06',382,359.00,137138.00,43.31,122,0.360,157.54),

  -- 4: Aguisot · Lote 1y3 · novillito (con control)
  ('pasto-ciclo-2026-04','ganaderas','campo-agisot','Aguisot','Lote 1y3','novillito',
   201,807,4.015,
   '2026-01-07',294.00,279.30,225395.10,1121.37,
   '2026-04-03',805,313.32,260031.10,43.72,162,0.270,172.32,
   '2026-06-18',805,323.02,260031.10,43.72,162,0.270,172.32),

  -- 5: Aguisot · 10 Y 12 · Vaquillas
  ('pasto-ciclo-2026-05','ganaderas','campo-agisot','Aguisot','10 Y 12','Vaquillas',
   58,163,2.810,
   '2026-01-08',377.50,358.62,58455.88,1007.86,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-14',160,400.00,64000.00,41.38,126,0.330,95.59),

  -- 6: Aguisot · 6 y 8 · Vaq 15M (SIN CIERRE — datos finales NULL)
  ('pasto-ciclo-2026-06','ganaderas','campo-agisot','Aguisot','6 y 8','Vaq 15M',
   174,529,3.040,
   '2026-01-15',344.12,326.91,172937.51,993.89,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),

  -- 7: Ico Pozo · Ico Pozo Mod A pares · Vaquillas
  ('pasto-ciclo-2026-07','ganaderas','campo-ico-pozo','Ico Pozo','Ico Pozo Mod A pares','Vaquillas',
   320,630,1.969,
   '2026-01-15',312.00,296.40,186732.00,583.54,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-09',613,329.22,201811.86,32.82,114,0.290,47.12),

  -- 8: Ico Pozo · Ico Pozo Mod A impares · Vaquillas
  ('pasto-ciclo-2026-08','ganaderas','campo-ico-pozo','Ico Pozo','Ico Pozo Mod A impares','Vaquillas',
   272,843,3.099,
   '2026-01-16',266.28,252.97,213250.34,784.01,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-06-14',836,289.25,241813.00,36.28,149,0.240,105.01),

  -- 9: Aguisot · Lote 2y4 · novillito
  ('pasto-ciclo-2026-09','ganaderas','campo-agisot','Aguisot','Lote 2y4','novillito',
   217,700,3.226,
   '2026-01-18',294.00,279.30,195510.00,900.97,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-06-23',700,309.70,216790.00,30.40,156,0.190,98.06),

  -- 10: Aguisot · 14 Y 16 · novillito (con control)
  ('pasto-ciclo-2026-10','ganaderas','campo-agisot','Aguisot','14 Y 16','novillito',
   129,548,4.248,
   '2026-01-22',232.51,220.88,121044.71,938.33,
   '2026-04-01',545,256.38,149330.00,53.12,120,0.440,219.27,
   '2026-05-22',545,274.00,149330.00,53.12,120,0.440,219.27),

  -- 11: Aguisot · Lote 5 · novillito
  ('pasto-ciclo-2026-11','ganaderas','campo-agisot','Aguisot','Lote 5','novillito',
   93,383,4.118,
   '2026-01-23',229.33,217.86,83441.72,897.22,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-19',373,281.52,105006.96,63.66,116,0.550,231.88),

  -- 12: Pizeti · Todo · Vaquillas
  ('pasto-ciclo-2026-12','ganaderas','campo-pizetti','Pizeti','Todo','Vaquillas',
   248,615,2.480,
   '2026-01-29',242.45,230.33,141651.41,571.18,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-22',615,275.46,169407.90,45.13,113,0.400,111.92),

  -- 13: La Hoyada · Lote 13-15 · novillito
  ('pasto-ciclo-2026-13','ganaderas','campo-la-hoyada','La Hoyada','Lote 13-15','novillito',
   64.5,601,9.318,
   '2026-04-10',282.00,267.90,161007.90,2496.25,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-21',598,281.28,168205.44,13.38,41,0.330,111.59),

  -- 14: La Hoyada · Lote 13-15 · Vaquillas (mismo circuito, otra categoría)
  ('pasto-ciclo-2026-14','ganaderas','campo-la-hoyada','La Hoyada','Lote 13-15','Vaquillas',
   64.5,283,4.388,
   '2026-04-10',241.30,229.24,64873.51,1005.79,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   '2026-05-22',278,241.80,67220.40,12.56,42,0.300,36.39),

  -- 15: Carolina · Lote 10-11-12 · Vaq a 27 Meses (SIN CIERRE)
  ('pasto-ciclo-2026-15','ganaderas','campo-carolina','Carolina','Lote 10-11-12','Vaq a 27 Meses',
   121,300,2.480,
   '2026-01-29',299.96,284.96,85488.60,706.52,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
   NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)

ON CONFLICT (id) DO UPDATE SET
  campo_id                          = EXCLUDED.campo_id,
  campo_nombre                      = EXCLUDED.campo_nombre,
  circuito_nombre                   = EXCLUDED.circuito_nombre,
  categoria                         = EXCLUDED.categoria,
  has_circuito                      = EXCLUDED.has_circuito,
  cant_animales                     = EXCLUDED.cant_animales,
  carga_ca_ha                       = EXCLUDED.carga_ca_ha,
  fecha_ingreso                     = EXCLUDED.fecha_ingreso,
  peso_prom_ingreso_sin_desbaste    = EXCLUDED.peso_prom_ingreso_sin_desbaste,
  kg_neto_ingreso_desbaste          = EXCLUDED.kg_neto_ingreso_desbaste,
  kg_totales_carne_ingreso          = EXCLUDED.kg_totales_carne_ingreso,
  carga_kg_carne_ha_real            = EXCLUDED.carga_kg_carne_ha_real,
  fecha_control                     = EXCLUDED.fecha_control,
  cant_control                      = EXCLUDED.cant_control,
  kg_neto_control                   = EXCLUDED.kg_neto_control,
  kg_totales_carne_control          = EXCLUDED.kg_totales_carne_control,
  kg_carne_producidos_animal_control = EXCLUDED.kg_carne_producidos_animal_control,
  dias_pastoreo_control             = EXCLUDED.dias_pastoreo_control,
  gdpv_control                      = EXCLUDED.gdpv_control,
  kg_carne_producidos_ha_control    = EXCLUDED.kg_carne_producidos_ha_control,
  fecha_encierre                    = EXCLUDED.fecha_encierre,
  cant_final                        = EXCLUDED.cant_final,
  kg_neto_final                     = EXCLUDED.kg_neto_final,
  kg_totales_carne_final            = EXCLUDED.kg_totales_carne_final,
  kg_carne_producidos_animal_final  = EXCLUDED.kg_carne_producidos_animal_final,
  dias_pastoreo_final               = EXCLUDED.dias_pastoreo_final,
  gdpv_final                        = EXCLUDED.gdpv_final,
  kg_carne_producidos_ha_final      = EXCLUDED.kg_carne_producidos_ha_final,
  updated_at                        = NOW();

-- =============================================================================
-- Resumen esperado tras correr esto:
--   • 15 ciclos cargados
--   • 5 con etapa Control completa (filas 2, 3, 4, 10 + verificar)
--   • 13 con etapa Cierre/Final (las que tienen fecha_encierre NOT NULL)
--   • 2 SIN cierre: "Aguisot · 6 y 8 · Vaq 15M" y "Carolina · 10-11-12 · Vaq 27M"
-- =============================================================================
