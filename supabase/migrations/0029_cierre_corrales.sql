-- ============================================================================
-- Cierre de Corrales — feedlot performance por tropa
-- ============================================================================
--
-- Réplica de la página 6 del Power BI de Ganadera Valle de Anta. Cada row
-- es una tropa cerrada (encerrada + terminada/recriada). Métricas clave:
--
--   - Cantidad: animales en la tropa
--   - P. Inicial / P. Final (kg): pesos promedio al ingreso y a la salida
--   - Duración (días): cuánto estuvieron en el corral
--   - CMS (kg/an/día) y CMS (% PV): consumo de materia seca
--   - ADPV (kg/an/día): aumento diario peso vivo
--   - EC (kg/kg): eficiencia de conversión = kg MS consumida / kg producido
--   - Costo Ración ($/kg MS): costo de la mezcla por kilo de materia seca
--   - Costo Alim ($/kg prod): costo de alimentación por kilo producido
--
-- Las medidas DAX del Power BI (P Inicial Promedio, ADPV Ponderado, EC
-- Promedio, etc.) son TODAS ponderadas por Cantidad usando:
--   DIVIDE( SUMX(rows, valor × cantidad), SUM(cantidad) )
-- El cálculo está implementado en `asfion-web/src/pages/CorralesPage.tsx`
-- (función `kpis` con `wAdpv += c.adpv × cantidad` / animales).
--
-- Seed: 21 tropas de Ganadera Valle de Anta (campaña 2025) cargadas del
-- Excel Cierre_Corrales.xlsx que mandó Agus el 30/06/2026.
--   - 5 Re Cría · Vaquillona (TROPA 1..5)
--   - 7 Re Cría · Novillo    (TROPA 1..7) ← suma 4269 animales = screenshot user
--   - 5 Terminación · Novillo
--   - 4 Terminación · Vaquillona

-- ============================================================================
-- 1) Tabla cierre_corrales
-- ============================================================================

CREATE TABLE IF NOT EXISTS cierre_corrales (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  -- Dimensiones / filtros del Power BI
  etapa TEXT NOT NULL CHECK (etapa IN ('Re Cría', 'Terminación')),
  categoria TEXT NOT NULL CHECK (categoria IN ('Novillo', 'Vaquillona')),
  tropa TEXT NOT NULL,                        -- "TROPA 1", "TROPA 2", etc.

  -- Contexto extra del Excel
  establecimiento TEXT,                       -- "Ganadera Valle de Anta"
  tipo_animal TEXT,                           -- "Nov", "Vaq", "Vaq1"
  fecha_encierre DATE,

  -- Métricas (todas DOUBLE PRECISION para preservar la precisión del Excel)
  cantidad           INTEGER NOT NULL,        -- "Cantidad" → animales (ponderador DAX)
  peso_inicial       DOUBLE PRECISION,        -- "P. Inicial (kg)"
  peso_final         DOUBLE PRECISION,        -- "P. Final (kg)"
  duracion_dias      DOUBLE PRECISION,        -- "Duración (días)"
  cms_kg_dia         DOUBLE PRECISION,        -- "CMS (kg/an/día)"
  cms_pct_pv         DOUBLE PRECISION,        -- "CMS (% PV)"
  adpv               DOUBLE PRECISION,        -- "ADPV (kg/an/día)"
  ec_promedio        DOUBLE PRECISION,        -- "EC (kg/kg)"
  racion_peso_ms     DOUBLE PRECISION,        -- "Costo Ración ($/kg MS)"
  alim_peso_prod     DOUBLE PRECISION,        -- "Costo Alim ($/kg prod)"

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cierre_corrales_cliente_idx ON cierre_corrales(cliente_id);
CREATE INDEX IF NOT EXISTS cierre_corrales_etapa_cat_idx ON cierre_corrales(cliente_id, etapa, categoria);

-- ============================================================================
-- 2) RLS — los usuarios solo ven los corrales de su cliente
-- ============================================================================

ALTER TABLE cierre_corrales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cierre_corrales_select_policy ON cierre_corrales;
CREATE POLICY cierre_corrales_select_policy ON cierre_corrales
  FOR SELECT USING (cliente_id = current_cliente_id());

DROP POLICY IF EXISTS cierre_corrales_insert_policy ON cierre_corrales;
CREATE POLICY cierre_corrales_insert_policy ON cierre_corrales
  FOR INSERT WITH CHECK (cliente_id = current_cliente_id());

DROP POLICY IF EXISTS cierre_corrales_update_policy ON cierre_corrales;
CREATE POLICY cierre_corrales_update_policy ON cierre_corrales
  FOR UPDATE
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

DROP POLICY IF EXISTS cierre_corrales_delete_policy ON cierre_corrales;
CREATE POLICY cierre_corrales_delete_policy ON cierre_corrales
  FOR DELETE USING (cliente_id = current_cliente_id());

-- ============================================================================
-- 3) Seed: 21 tropas de Ganadera Valle de Anta (campaña 2025)
-- ============================================================================

INSERT INTO cierre_corrales (
  id, cliente_id, etapa, categoria, tropa,
  establecimiento, tipo_animal, fecha_encierre,
  cantidad, peso_inicial, peso_final, duracion_dias,
  cms_kg_dia, cms_pct_pv, adpv, ec_promedio,
  racion_peso_ms, alim_peso_prod
) VALUES
  ('corral-gva-001-recria-vaq-t1',       'ganaderas', 'Re Cría',     'Vaquillona', 'TROPA 1', 'Ganadera Valle de Anta', 'Vaq1', '2025-07-02', 1527, 169.064440, 303.767220, 198.618241, 5.972391,  2.526223, 0.678199,  8.806245,  25.1810,  221.750064),
  ('corral-gva-002-recria-vaq-t2',       'ganaderas', 'Re Cría',     'Vaquillona', 'TROPA 2', 'Ganadera Valle de Anta', 'Vaq1', '2025-07-12',  373, 177.426434, 303.544355, 191.299692, 6.688834,  2.781389, 0.659269, 10.145837,  25.1810,  255.482325),
  ('corral-gva-003-recria-vaq-t3',       'ganaderas', 'Re Cría',     'Vaquillona', 'TROPA 3', 'Ganadera Valle de Anta', 'Vaq1', '2025-10-09',  480, 200.132083, 271.440587, 106.423100, 6.159816,  2.612457, 0.670047,  9.193107,  25.1810,  231.491629),
  ('corral-gva-004-recria-vaq-t4',       'ganaderas', 'Re Cría',     'Vaquillona', 'TROPA 4', 'Ganadera Valle de Anta', 'Vaq1', '2025-12-10',  226, 210.061947, 248.825611,  48.760907, 5.952936,  2.594507, 0.794974,  7.488212,  25.1810,  188.560672),
  ('corral-gva-005-recria-vaq-t5',       'ganaderas', 'Re Cría',     'Vaquillona', 'TROPA 5', 'Ganadera Valle de Anta', 'Vaq1', '2025-12-12',  235, 248.683574, 274.630862,  36.728884, 6.564235,  2.508715, 0.706455,  9.291801,  25.1810,  233.976834),

  ('corral-gva-006-recria-nov-t1',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 1', 'Ganadera Valle de Anta', 'Nov',  '2025-06-22',  774, 172.174884, 292.120182, 206.174009, 5.038704,  2.170475, 0.581767,  8.661030,  25.1810,  218.093392),
  ('corral-gva-007-recria-nov-t2',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 2', 'Ganadera Valle de Anta', 'Nov',  '2025-07-06',  881, 178.154506, 315.604139, 186.430010, 5.503403,  2.229188, 0.737272,  7.464549,  25.1810,  187.964813),
  ('corral-gva-008-recria-nov-t3',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 3', 'Ganadera Valle de Anta', 'Nov',  '2025-07-31',  380, 206.584868, 335.387632, 162.511336, 6.313644,  2.329876, 0.792577,  7.965969,  25.1810,  200.591055),
  ('corral-gva-009-recria-nov-t4',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 4', 'Ganadera Valle de Anta', 'Nov',  '2025-08-17',  368, 196.622283, 313.211366, 147.851964, 6.691964,  2.625156, 0.788553,  8.486386,  25.1810,  213.695687),
  ('corral-gva-010-recria-nov-t5',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 5', 'Ganadera Valle de Anta', 'Nov',  '2025-08-16',  708, 205.348234, 316.465292, 146.725480, 6.410765,  2.457110, 0.757313,  8.465150,  25.1810,  213.160953),
  ('corral-gva-011-recria-nov-t6',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 6', 'Ganadera Valle de Anta', 'Nov',  '2025-10-10',  382, 205.800026, 273.794368, 100.297368, 6.335876,  2.642181, 0.677927,  9.345949,  25.1810,  235.340343),
  ('corral-gva-012-recria-nov-t7',       'ganaderas', 'Re Cría',     'Novillo',    'TROPA 7', 'Ganadera Valle de Anta', 'Nov',  '2025-11-27',  776, 216.606314, 251.275464,  54.955464, 6.286402,  2.687175, 0.630859,  9.964829,  25.1810,  250.924349),

  ('corral-gva-013-terminacion-nov-t1',  'ganaderas', 'Terminación', 'Novillo',    'TROPA 1', 'Ganadera Valle de Anta', 'Nov',  '2025-04-02', 1549, 329.714332, 404.969655,  97.064543, 8.609370,  2.343693, 0.775312, 11.104391, 155.4700, 1726.399648),
  ('corral-gva-014-terminacion-nov-t2',  'ganaderas', 'Terminación', 'Novillo',    'TROPA 2', 'Ganadera Valle de Anta', 'Nov',  '2025-04-28', 1612, 297.706427, 395.206477, 121.276758, 7.695952,  2.221333, 0.803947,  9.572715,  28.5900,  273.683913),
  ('corral-gva-015-terminacion-nov-t3',  'ganaderas', 'Terminación', 'Novillo',    'TROPA 3', 'Ganadera Valle de Anta', 'Nov',  '2025-05-30',  274, 241.333029, 370.067391, 133.086417, 11.445751, 3.744110, 0.967299, 11.832692,  28.5900,  338.296651),
  ('corral-gva-016-terminacion-nov-t4',  'ganaderas', 'Terminación', 'Novillo',    'TROPA 4', 'Ganadera Valle de Anta', 'Nov',  '2025-06-13', 1429, 279.585290, 380.617543, 119.303024, 7.348436,  2.226115, 0.846854,  8.677335,  28.5900,  248.084996),
  ('corral-gva-017-terminacion-nov-t5',  'ganaderas', 'Terminación', 'Novillo',    'TROPA 5', 'Ganadera Valle de Anta', 'Nov',  '2025-06-05',  692, 279.910679, 391.343230, 120.808490, 7.655568,  2.280975, 0.922390,  8.299708,  28.5900,  237.288647),

  ('corral-gva-018-terminacion-vaq-t1',  'ganaderas', 'Terminación', 'Vaquillona', 'TROPA 1', 'Ganadera Valle de Anta', 'Vaq',  '2025-04-03',  379, 318.009868, 366.324776,  72.385224, 7.975960,  2.331012, 0.667469, 11.949555, 155.4700, 1857.797367),
  ('corral-gva-019-terminacion-vaq-t2',  'ganaderas', 'Terminación', 'Vaquillona', 'TROPA 2', 'Ganadera Valle de Anta', 'Vaq',  '2025-04-29',  664, 295.632681, 366.767735,  93.160443, 8.109147,  2.448412, 0.763576, 10.619964,  28.5900,  303.624785),
  ('corral-gva-020-terminacion-vaq-t3',  'ganaderas', 'Terminación', 'Vaquillona', 'TROPA 3', 'Ganadera Valle de Anta', 'Vaq',  '2025-06-15', 1009, 278.844420, 360.833668, 114.380505, 7.818863,  2.444624, 0.716811, 10.907838,  28.5900,  311.855092),
  ('corral-gva-021-terminacion-vaq-t4',  'ganaderas', 'Terminación', 'Vaquillona', 'TROPA 4', 'Ganadera Valle de Anta', 'Vaq',  '2025-06-05',  350, 260.935771, 367.776699, 137.202857, 6.414192,  2.040421, 0.778708,  8.236970,  28.5900,  235.494964)
ON CONFLICT (id) DO UPDATE SET
  etapa           = EXCLUDED.etapa,
  categoria       = EXCLUDED.categoria,
  tropa           = EXCLUDED.tropa,
  establecimiento = EXCLUDED.establecimiento,
  tipo_animal     = EXCLUDED.tipo_animal,
  fecha_encierre  = EXCLUDED.fecha_encierre,
  cantidad        = EXCLUDED.cantidad,
  peso_inicial    = EXCLUDED.peso_inicial,
  peso_final      = EXCLUDED.peso_final,
  duracion_dias   = EXCLUDED.duracion_dias,
  cms_kg_dia      = EXCLUDED.cms_kg_dia,
  cms_pct_pv      = EXCLUDED.cms_pct_pv,
  adpv            = EXCLUDED.adpv,
  ec_promedio     = EXCLUDED.ec_promedio,
  racion_peso_ms  = EXCLUDED.racion_peso_ms,
  alim_peso_prod  = EXCLUDED.alim_peso_prod,
  updated_at      = now();

-- ============================================================================
-- 4) Verificación post-seed
-- ============================================================================
-- SELECT etapa, categoria, COUNT(*) tropas, SUM(cantidad) animales
-- FROM cierre_corrales WHERE cliente_id = 'ganaderas'
-- GROUP BY 1, 2 ORDER BY 1, 2;
--
-- Esperado:
--   Re Cría      | Novillo    | 7 | 4269   ← coincide con el screenshot user
--   Re Cría      | Vaquillona | 5 | 2841
--   Terminación  | Novillo    | 5 | 5556
--   Terminación  | Vaquillona | 4 | 2402
--   TOTAL: 21 tropas, 15068 animales
