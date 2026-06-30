-- ASFION — Tabla NDVI_Pasturas con data real del Power BI.
--
-- Contexto: Agus pasó el Excel NDVI_Pasturas.xlsx con 318 mediciones
-- satelitales del campo AGISOT, distribuidas en 9 circuitos a lo largo
-- de 6 meses (Ene 2026 → Jun 2026).
--
-- Cada medición tiene:
--   - NDVI: índice satelital 0.30-0.46 (la mayoría en "Intermedio")
--   - MS_kg_ha: kg de materia seca por ha estimado del NDVI (tabla de
--     conversión: <0.30 → 2000, 0.30-0.40 → 2750, 0.40-0.60 → 5000,
--     >0.60 → 7500)
--   - MS_total_kg: SUM(MS_kg_ha × hectáreas) — kg disponibles totales
--   - Estado: Intermedio / Bajo / Bueno / Alto
--
-- Resultado esperado en el dashboard (módulo NDVI/MS):
--   Mediciones: 318
--   MS Total: ~47.460.000 kg (suma de todas las mediciones)
--   Ha medidas: ~7.938 (suma; mismas parcelas medidas múltiples veces)
--   MS kg/ha promedio: ~5.978 (ponderado por hectáreas)

-- ============================================================================
-- 1) Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS ndvi_pasturas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  campo TEXT NOT NULL,         -- texto libre (matchea con nombre de campos)
  circuito TEXT NOT NULL,      -- texto libre (matchea con nombre de circuitos)
  lote TEXT,                   -- número o ID del lote
  parcelas INTEGER,            -- cantidad de parcelas agrupadas en la medición
  hectareas NUMERIC(10, 2),
  ndvi NUMERIC(5, 4),          -- 0.0000-1.0000
  ms_kg_ha NUMERIC(10, 2),     -- kg de MS por hectárea
  ms_total_kg NUMERIC(12, 2),  -- kg totales (MS_kg_ha × hectareas)
  estado TEXT,                 -- Bajo / Intermedio / Bueno / Alto
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ndvi_cliente_fecha_idx ON ndvi_pasturas(cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS ndvi_circuito_idx ON ndvi_pasturas(circuito);

-- ============================================================================
-- 2) RLS — lectura abierta a usuarios del cliente, escritura solo service role
-- ============================================================================

ALTER TABLE ndvi_pasturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ndvi_select_policy ON ndvi_pasturas;
CREATE POLICY ndvi_select_policy ON ndvi_pasturas
  FOR SELECT
  USING (true);  -- todos los autenticados pueden leer

-- ============================================================================
-- 3) Data: 318 mediciones del Power BI
-- ============================================================================

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0002', 'ganaderas', '2026-01-06', 'AGISOT', '5', '5', 4, 25.0, 0.3926, 2750.0, 68750.0, 'Intermedio'),
('ndvi-0003', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '3', 5, 24.0, 0.3727, 2750.0, 66000.0, 'Intermedio'),
('ndvi-0004', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '1', 3, 23.0, 0.3915, 2750.0, 63250.0, 'Intermedio'),
('ndvi-0005', 'ganaderas', '2026-01-06', 'AGISOT', '7', '7', 4, 18.0, 0.3419, 2750.0, 49500.0, 'Intermedio'),
('ndvi-0006', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '9', 4, 16.0, 0.3776, 2750.0, 44000.0, 'Intermedio'),
('ndvi-0007', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '11', 5, 19.0, 0.3643, 2750.0, 52250.0, 'Intermedio'),
('ndvi-0008', 'ganaderas', '2026-01-06', 'AGISOT', '13_15', '15', 4, 39.0, 0.4341, 5000.0, 195000.0, 'Buen crecimiento'),
('ndvi-0009', 'ganaderas', '2026-01-06', 'AGISOT', '10_12', '12', 1, 27.0, 0.3005, 2750.0, 74250.0, 'Intermedio'),
('ndvi-0010', 'ganaderas', '2026-01-06', 'AGISOT', '10_12', '10', 5, 25.0, 0.3854, 2750.0, 68750.0, 'Intermedio'),
('ndvi-0011', 'ganaderas', '2026-01-06', 'AGISOT', '6_8', '6', 6, 24.0, 0.4314, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0012', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '4', 1, 23.0, 0.4512, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0013', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '2', 9, 21.0, 0.5017, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0014', 'ganaderas', '2026-01-06', 'AGISOT', '6_8', '6', 3, 28.0, 0.3013, 2750.0, 77000.0, 'Intermedio'),
('ndvi-0015', 'ganaderas', '2026-01-06', 'AGISOT', '6_8', '6', 4, 24.0, 0.2547, 2000.0, 48000.0, 'Bajo/Estrés'),
('ndvi-0016', 'ganaderas', '2026-01-06', 'AGISOT', '6_8', '6', 5, 24.0, 0.464, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0017', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '4', 2, 23.0, 0.4076, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0018', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '4', 3, 23.0, 0.2011, 2000.0, 46000.0, 'Bajo/Estrés'),
('ndvi-0019', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '2', 7, 21.0, 0.4576, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0020', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '2', 8, 21.0, 0.4954, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0021', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '4', 4, 36.0, 0.1954, 2000.0, 72000.0, 'Bajo/Estrés'),
('ndvi-0022', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '2', 6, 20.0, 0.4142, 5000.0, 100000.0, 'Buen crecimiento'),
('ndvi-0023', 'ganaderas', '2026-01-06', 'AGISOT', '10_12', '10', 6, 31.0, 0.4271, 5000.0, 155000.0, 'Buen crecimiento'),
('ndvi-0024', 'ganaderas', '2026-01-06', 'AGISOT', '10_12', '12', 2, 26.0, 0.1442, 2000.0, 52000.0, 'Bajo/Estrés'),
('ndvi-0025', 'ganaderas', '2026-01-06', 'AGISOT', '10_12', '12', 3, 31.0, 0.145, 2000.0, 62000.0, 'Bajo/Estrés'),
('ndvi-0026', 'ganaderas', '2026-01-06', 'AGISOT', '13_15', '13', 1, 23.0, 0.4372, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0027', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '11', 6, 38.0, 0.3696, 2750.0, 104500.0, 'Intermedio'),
('ndvi-0028', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '9', 3, 21.0, 0.3367, 2750.0, 57750.0, 'Intermedio'),
('ndvi-0029', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '9', 2, 21.0, 0.3828, 2750.0, 57750.0, 'Intermedio'),
('ndvi-0030', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '9', 1, 24.0, 0.4565, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0031', 'ganaderas', '2026-01-06', 'AGISOT', '7', '7', 1, 24.0, 0.367, 2750.0, 66000.0, 'Intermedio'),
('ndvi-0032', 'ganaderas', '2026-01-06', 'AGISOT', '7', '7', 2, 24.0, 0.329, 2750.0, 66000.0, 'Intermedio'),
('ndvi-0033', 'ganaderas', '2026-01-06', 'AGISOT', '7', '7', 3, 22.0, 0.2156, 2000.0, 44000.0, 'Bajo/Estrés'),
('ndvi-0034', 'ganaderas', '2026-01-06', 'AGISOT', '5', '5', 1, 18.0, 0.3693, 2750.0, 49500.0, 'Intermedio'),
('ndvi-0035', 'ganaderas', '2026-01-06', 'AGISOT', '5', '5', 2, 23.0, 0.3823, 2750.0, 63250.0, 'Intermedio'),
('ndvi-0036', 'ganaderas', '2026-01-06', 'AGISOT', '5', '5', 3, 22.0, 0.366, 2750.0, 60500.0, 'Intermedio'),
('ndvi-0037', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '1', 2, 18.0, 0.385, 2750.0, 49500.0, 'Intermedio'),
('ndvi-0038', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '1', 4, 24.0, 0.4188, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0039', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '1', 1, 22.0, 0.2774, 2000.0, 44000.0, 'Bajo/Estrés'),
('ndvi-0040', 'ganaderas', '2026-01-06', 'AGISOT', '14_16', '14', 4, 35.0, 0.3722, 2750.0, 96250.0, 'Intermedio'),
('ndvi-0041', 'ganaderas', '2026-01-06', 'AGISOT', '14_16', '14', 3, 32.0, 0.2791, 2000.0, 64000.0, 'Bajo/Estrés'),
('ndvi-0042', 'ganaderas', '2026-01-06', 'AGISOT', '14_16', '16', 2, 31.0, 0.4586, 5000.0, 155000.0, 'Buen crecimiento'),
('ndvi-0043', 'ganaderas', '2026-01-06', 'AGISOT', '14_16', '16', 1, 30.0, 0.4432, 5000.0, 150000.0, 'Buen crecimiento'),
('ndvi-0044', 'ganaderas', '2026-01-06', 'AGISOT', '13_15', '13', 3, 15.0, 0.3794, 2750.0, 41250.0, 'Intermedio'),
('ndvi-0045', 'ganaderas', '2026-01-06', 'AGISOT', '13_15', '15', 5, 22.0, 0.4736, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0046', 'ganaderas', '2026-01-06', 'AGISOT', '9_11', '11', 7, 22.0, 0.5025, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0047', 'ganaderas', '2026-01-06', 'AGISOT', '10_12', '10', 4, 25.0, 0.243, 2000.0, 50000.0, 'Bajo/Estrés'),
('ndvi-0048', 'ganaderas', '2026-01-06', 'AGISOT', '6_8', '8', 2, 32.0, 0.408, 5000.0, 160000.0, 'Buen crecimiento'),
('ndvi-0049', 'ganaderas', '2026-01-06', 'AGISOT', '6_8', '8', 1, 37.0, 0.4172, 5000.0, 185000.0, 'Buen crecimiento'),
('ndvi-0050', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '3', 6, 26.0, 0.3902, 2750.0, 71500.0, 'Intermedio'),
('ndvi-0051', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '3', 7, 26.0, 0.347, 2750.0, 71500.0, 'Intermedio');

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0052', 'ganaderas', '2026-01-06', 'AGISOT', '1_3', '3', 8, 28.0, 0.335, 2750.0, 77000.0, 'Intermedio'),
('ndvi-0053', 'ganaderas', '2026-01-06', 'AGISOT', '2_4', '2', 5, 19.0, 0.1948, 2000.0, 38000.0, 'Bajo/Estrés'),
('ndvi-0054', 'ganaderas', '2026-01-06', 'AGISOT', '13_15', '13', 2, 27.0, 0.39, 2750.0, 74250.0, 'Intermedio'),
('ndvi-0055', 'ganaderas', '2026-01-26', 'AGISOT', '5', '5', 4, 25.0, 0.4878, 5000.0, 125000.0, 'Buen crecimiento'),
('ndvi-0056', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '3', 5, 24.0, 0.6101, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0057', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '1', 3, 23.0, 0.7148, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0058', 'ganaderas', '2026-01-26', 'AGISOT', '7', '7', 4, 18.0, 0.4772, 5000.0, 90000.0, 'Buen crecimiento'),
('ndvi-0059', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '9', 4, 16.0, 0.3534, 2750.0, 44000.0, 'Intermedio'),
('ndvi-0060', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '11', 5, 19.0, 0.393, 2750.0, 52250.0, 'Intermedio'),
('ndvi-0061', 'ganaderas', '2026-01-26', 'AGISOT', '13_15', '15', 4, 39.0, 0.4117, 5000.0, 195000.0, 'Buen crecimiento'),
('ndvi-0062', 'ganaderas', '2026-01-26', 'AGISOT', '10_12', '12', 1, 27.0, 0.4602, 5000.0, 135000.0, 'Buen crecimiento'),
('ndvi-0063', 'ganaderas', '2026-01-26', 'AGISOT', '10_12', '10', 5, 25.0, 0.6124, 7500.0, 187500.0, 'Máximo desarrollo'),
('ndvi-0064', 'ganaderas', '2026-01-26', 'AGISOT', '6_8', '6', 6, 24.0, 0.7402, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0065', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '4', 1, 23.0, 0.7379, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0066', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '2', 9, 21.0, 0.2904, 2000.0, 42000.0, 'Bajo/Estrés'),
('ndvi-0067', 'ganaderas', '2026-01-26', 'AGISOT', '6_8', '6', 3, 28.0, 0.7233, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0068', 'ganaderas', '2026-01-26', 'AGISOT', '6_8', '6', 4, 24.0, 0.6698, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0069', 'ganaderas', '2026-01-26', 'AGISOT', '6_8', '6', 5, 24.0, 0.7518, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0070', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '4', 2, 23.0, 0.7081, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0071', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '4', 3, 23.0, 0.5122, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0072', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '2', 7, 21.0, 0.7319, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0073', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '2', 8, 21.0, 0.7492, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0074', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '4', 4, 36.0, 0.4786, 5000.0, 180000.0, 'Buen crecimiento'),
('ndvi-0075', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '2', 6, 20.0, 0.6539, 7500.0, 150000.0, 'Máximo desarrollo'),
('ndvi-0076', 'ganaderas', '2026-01-26', 'AGISOT', '10_12', '10', 6, 31.0, 0.5952, 5000.0, 155000.0, 'Buen crecimiento'),
('ndvi-0077', 'ganaderas', '2026-01-26', 'AGISOT', '10_12', '12', 2, 26.0, 0.145, 2000.0, 52000.0, 'Bajo/Estrés'),
('ndvi-0078', 'ganaderas', '2026-01-26', 'AGISOT', '10_12', '12', 3, 31.0, 0.1455, 2000.0, 62000.0, 'Bajo/Estrés'),
('ndvi-0079', 'ganaderas', '2026-01-26', 'AGISOT', '13_15', '13', 1, 23.0, 0.5077, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0080', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '11', 6, 38.0, 0.64, 7500.0, 285000.0, 'Máximo desarrollo'),
('ndvi-0081', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '9', 3, 21.0, 0.7108, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0082', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '9', 2, 21.0, 0.7435, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0083', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '9', 1, 24.0, 0.7849, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0084', 'ganaderas', '2026-01-26', 'AGISOT', '7', '7', 1, 24.0, 0.5329, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0085', 'ganaderas', '2026-01-26', 'AGISOT', '7', '7', 2, 24.0, 0.3518, 2750.0, 66000.0, 'Intermedio'),
('ndvi-0086', 'ganaderas', '2026-01-26', 'AGISOT', '7', '7', 3, 22.0, 0.5226, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0087', 'ganaderas', '2026-01-26', 'AGISOT', '5', '5', 1, 18.0, 0.7213, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0088', 'ganaderas', '2026-01-26', 'AGISOT', '5', '5', 2, 23.0, 0.7398, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0089', 'ganaderas', '2026-01-26', 'AGISOT', '5', '5', 3, 22.0, 0.7271, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0090', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '1', 2, 18.0, 0.7598, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0091', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '1', 4, 24.0, 0.5149, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0092', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '1', 1, 22.0, 0.7319, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0093', 'ganaderas', '2026-01-26', 'AGISOT', '14_16', '14', 4, 35.0, 0.5207, 5000.0, 175000.0, 'Buen crecimiento'),
('ndvi-0094', 'ganaderas', '2026-01-26', 'AGISOT', '14_16', '14', 3, 32.0, 0.4778, 5000.0, 160000.0, 'Buen crecimiento'),
('ndvi-0095', 'ganaderas', '2026-01-26', 'AGISOT', '14_16', '16', 2, 31.0, 0.4543, 5000.0, 155000.0, 'Buen crecimiento'),
('ndvi-0096', 'ganaderas', '2026-01-26', 'AGISOT', '14_16', '16', 1, 30.0, 0.556, 5000.0, 150000.0, 'Buen crecimiento'),
('ndvi-0097', 'ganaderas', '2026-01-26', 'AGISOT', '13_15', '13', 3, 15.0, 0.6105, 7500.0, 112500.0, 'Máximo desarrollo'),
('ndvi-0098', 'ganaderas', '2026-01-26', 'AGISOT', '13_15', '15', 5, 22.0, 0.6758, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0099', 'ganaderas', '2026-01-26', 'AGISOT', '9_11', '11', 7, 22.0, 0.7618, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0100', 'ganaderas', '2026-01-26', 'AGISOT', '10_12', '10', 4, 25.0, 0.3951, 2750.0, 68750.0, 'Intermedio'),
('ndvi-0101', 'ganaderas', '2026-01-26', 'AGISOT', '6_8', '8', 2, 32.0, 0.4849, 5000.0, 160000.0, 'Buen crecimiento');

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0102', 'ganaderas', '2026-01-26', 'AGISOT', '6_8', '8', 1, 37.0, 0.7049, 7500.0, 277500.0, 'Máximo desarrollo'),
('ndvi-0103', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '3', 6, 26.0, 0.4037, 5000.0, 130000.0, 'Buen crecimiento'),
('ndvi-0104', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '3', 7, 26.0, 0.707, 7500.0, 195000.0, 'Máximo desarrollo'),
('ndvi-0105', 'ganaderas', '2026-01-26', 'AGISOT', '1_3', '3', 8, 28.0, 0.6779, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0106', 'ganaderas', '2026-01-26', 'AGISOT', '2_4', '2', 5, 19.0, 0.3495, 2750.0, 52250.0, 'Intermedio'),
('ndvi-0107', 'ganaderas', '2026-01-26', 'AGISOT', '13_15', '13', 2, 27.0, 0.6439, 7500.0, 202500.0, 'Máximo desarrollo'),
('ndvi-0108', 'ganaderas', '2026-02-05', 'AGISOT', '5', '5', 4, 25.0, 0.7027, 7500.0, 187500.0, 'Máximo desarrollo'),
('ndvi-0109', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '3', 5, 24.0, 0.8024, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0110', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '1', 3, 23.0, 0.5743, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0111', 'ganaderas', '2026-02-05', 'AGISOT', '7', '7', 4, 18.0, 0.4584, 5000.0, 90000.0, 'Buen crecimiento'),
('ndvi-0112', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '9', 4, 16.0, 0.6209, 7500.0, 120000.0, 'Máximo desarrollo'),
('ndvi-0113', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '11', 5, 19.0, 0.7879, 7500.0, 142500.0, 'Máximo desarrollo'),
('ndvi-0114', 'ganaderas', '2026-02-05', 'AGISOT', '13_15', '15', 4, 39.0, 0.5166, 5000.0, 195000.0, 'Buen crecimiento'),
('ndvi-0115', 'ganaderas', '2026-02-05', 'AGISOT', '10_12', '12', 1, 27.0, 0.5045, 5000.0, 135000.0, 'Buen crecimiento'),
('ndvi-0116', 'ganaderas', '2026-02-05', 'AGISOT', '10_12', '10', 5, 25.0, 0.7193, 7500.0, 187500.0, 'Máximo desarrollo'),
('ndvi-0117', 'ganaderas', '2026-02-05', 'AGISOT', '6_8', '6', 6, 24.0, 0.6752, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0118', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '4', 1, 23.0, 0.7974, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0119', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '2', 9, 21.0, 0.5774, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0120', 'ganaderas', '2026-02-05', 'AGISOT', '6_8', '6', 3, 28.0, 0.8495, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0121', 'ganaderas', '2026-02-05', 'AGISOT', '6_8', '6', 4, 24.0, 0.8276, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0122', 'ganaderas', '2026-02-05', 'AGISOT', '6_8', '6', 5, 24.0, 0.7971, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0123', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '4', 2, 23.0, 0.8031, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0124', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '4', 3, 23.0, 0.7228, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0125', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '2', 7, 21.0, 0.5708, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0126', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '2', 8, 21.0, 0.3971, 2750.0, 57750.0, 'Intermedio'),
('ndvi-0127', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '4', 4, 36.0, 0.6703, 7500.0, 270000.0, 'Máximo desarrollo'),
('ndvi-0128', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '2', 6, 20.0, 0.7357, 7500.0, 150000.0, 'Máximo desarrollo'),
('ndvi-0129', 'ganaderas', '2026-02-05', 'AGISOT', '10_12', '10', 6, 31.0, 0.7194, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0130', 'ganaderas', '2026-02-05', 'AGISOT', '10_12', '12', 2, 26.0, 0.1689, 2000.0, 52000.0, 'Bajo/Estrés'),
('ndvi-0131', 'ganaderas', '2026-02-05', 'AGISOT', '10_12', '12', 3, 31.0, 0.1596, 2000.0, 62000.0, 'Bajo/Estrés'),
('ndvi-0132', 'ganaderas', '2026-02-05', 'AGISOT', '13_15', '13', 1, 23.0, 0.75, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0133', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '11', 6, 38.0, 0.7898, 7500.0, 285000.0, 'Máximo desarrollo'),
('ndvi-0134', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '9', 3, 21.0, 0.7888, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0135', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '9', 2, 21.0, 0.8064, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0136', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '9', 1, 24.0, 0.5122, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0137', 'ganaderas', '2026-02-05', 'AGISOT', '7', '7', 1, 24.0, 0.6476, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0138', 'ganaderas', '2026-02-05', 'AGISOT', '7', '7', 2, 24.0, 0.5806, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0139', 'ganaderas', '2026-02-05', 'AGISOT', '7', '7', 3, 22.0, 0.4768, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0140', 'ganaderas', '2026-02-05', 'AGISOT', '5', '5', 1, 18.0, 0.5569, 5000.0, 90000.0, 'Buen crecimiento'),
('ndvi-0141', 'ganaderas', '2026-02-05', 'AGISOT', '5', '5', 2, 23.0, 0.7766, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0142', 'ganaderas', '2026-02-05', 'AGISOT', '5', '5', 3, 22.0, 0.7351, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0143', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '1', 2, 18.0, 0.5327, 5000.0, 90000.0, 'Buen crecimiento'),
('ndvi-0144', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '1', 4, 24.0, 0.5266, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0145', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '1', 1, 22.0, 0.8195, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0146', 'ganaderas', '2026-02-05', 'AGISOT', '14_16', '14', 4, 35.0, 0.6968, 7500.0, 262500.0, 'Máximo desarrollo'),
('ndvi-0147', 'ganaderas', '2026-02-05', 'AGISOT', '14_16', '14', 3, 32.0, 0.6014, 7500.0, 240000.0, 'Máximo desarrollo'),
('ndvi-0148', 'ganaderas', '2026-02-05', 'AGISOT', '14_16', '16', 2, 31.0, 0.6303, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0149', 'ganaderas', '2026-02-05', 'AGISOT', '14_16', '16', 1, 30.0, 0.5267, 5000.0, 150000.0, 'Buen crecimiento'),
('ndvi-0150', 'ganaderas', '2026-02-05', 'AGISOT', '13_15', '13', 3, 15.0, 0.7448, 7500.0, 112500.0, 'Máximo desarrollo'),
('ndvi-0151', 'ganaderas', '2026-02-05', 'AGISOT', '13_15', '15', 5, 22.0, 0.46, 5000.0, 110000.0, 'Buen crecimiento');

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0152', 'ganaderas', '2026-02-05', 'AGISOT', '9_11', '11', 7, 22.0, 0.5142, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0153', 'ganaderas', '2026-02-05', 'AGISOT', '10_12', '10', 4, 25.0, 0.5254, 5000.0, 125000.0, 'Buen crecimiento'),
('ndvi-0154', 'ganaderas', '2026-02-05', 'AGISOT', '6_8', '8', 2, 32.0, 0.6797, 7500.0, 240000.0, 'Máximo desarrollo'),
('ndvi-0155', 'ganaderas', '2026-02-05', 'AGISOT', '6_8', '8', 1, 37.0, 0.6245, 7500.0, 277500.0, 'Máximo desarrollo'),
('ndvi-0156', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '3', 6, 26.0, 0.719, 7500.0, 195000.0, 'Máximo desarrollo'),
('ndvi-0157', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '3', 7, 26.0, 0.7872, 7500.0, 195000.0, 'Máximo desarrollo'),
('ndvi-0158', 'ganaderas', '2026-02-05', 'AGISOT', '1_3', '3', 8, 28.0, 0.7783, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0159', 'ganaderas', '2026-02-05', 'AGISOT', '2_4', '2', 5, 19.0, 0.562, 5000.0, 95000.0, 'Buen crecimiento'),
('ndvi-0160', 'ganaderas', '2026-02-05', 'AGISOT', '13_15', '13', 2, 27.0, 0.7919, 7500.0, 202500.0, 'Máximo desarrollo'),
('ndvi-0161', 'ganaderas', '2026-02-25', 'AGISOT', '5', '5', 4, 25.0, 0.7158, 7500.0, 187500.0, 'Máximo desarrollo'),
('ndvi-0162', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '3', 5, 24.0, 0.7573, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0163', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '1', 3, 23.0, 0.7787, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0164', 'ganaderas', '2026-02-25', 'AGISOT', '7', '7', 4, 18.0, 0.7362, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0165', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '9', 4, 16.0, 0.8009, 7500.0, 120000.0, 'Máximo desarrollo'),
('ndvi-0166', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '11', 5, 19.0, 0.7716, 7500.0, 142500.0, 'Máximo desarrollo'),
('ndvi-0167', 'ganaderas', '2026-02-25', 'AGISOT', '13_15', '15', 4, 39.0, 0.7695, 7500.0, 292500.0, 'Máximo desarrollo'),
('ndvi-0168', 'ganaderas', '2026-02-25', 'AGISOT', '10_12', '12', 1, 27.0, 0.7045, 7500.0, 202500.0, 'Máximo desarrollo'),
('ndvi-0169', 'ganaderas', '2026-02-25', 'AGISOT', '10_12', '10', 5, 25.0, 0.2258, 2000.0, 50000.0, 'Bajo/Estrés'),
('ndvi-0170', 'ganaderas', '2026-02-25', 'AGISOT', '6_8', '6', 6, 24.0, 0.7852, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0171', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '4', 1, 23.0, 0.7237, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0172', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '2', 9, 21.0, 0.6505, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0173', 'ganaderas', '2026-02-25', 'AGISOT', '6_8', '6', 3, 28.0, 0.8417, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0174', 'ganaderas', '2026-02-25', 'AGISOT', '6_8', '6', 4, 24.0, 0.828, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0175', 'ganaderas', '2026-02-25', 'AGISOT', '6_8', '6', 5, 24.0, 0.6415, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0176', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '4', 2, 23.0, 0.6131, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0177', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '4', 3, 23.0, 0.8025, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0178', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '2', 7, 21.0, 0.6993, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0179', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '2', 8, 21.0, 0.3866, 2750.0, 57750.0, 'Intermedio'),
('ndvi-0180', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '4', 4, 36.0, 0.8102, 7500.0, 270000.0, 'Máximo desarrollo'),
('ndvi-0181', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '2', 6, 20.0, 0.7447, 7500.0, 150000.0, 'Máximo desarrollo'),
('ndvi-0182', 'ganaderas', '2026-02-25', 'AGISOT', '10_12', '10', 6, 31.0, 0.6316, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0183', 'ganaderas', '2026-02-25', 'AGISOT', '10_12', '12', 2, 26.0, 0.3607, 2750.0, 71500.0, 'Intermedio'),
('ndvi-0184', 'ganaderas', '2026-02-25', 'AGISOT', '10_12', '12', 3, 31.0, 0.3061, 2750.0, 85250.0, 'Intermedio'),
('ndvi-0185', 'ganaderas', '2026-02-25', 'AGISOT', '13_15', '13', 1, 23.0, 0.6389, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0186', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '11', 6, 38.0, 0.5073, 5000.0, 190000.0, 'Buen crecimiento'),
('ndvi-0187', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '9', 3, 21.0, 0.8084, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0188', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '9', 2, 21.0, 0.7365, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0189', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '9', 1, 24.0, 0.7907, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0190', 'ganaderas', '2026-02-25', 'AGISOT', '7', '7', 1, 24.0, 0.5948, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0191', 'ganaderas', '2026-02-25', 'AGISOT', '7', '7', 2, 24.0, 0.5552, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0192', 'ganaderas', '2026-02-25', 'AGISOT', '7', '7', 3, 22.0, 0.6615, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0193', 'ganaderas', '2026-02-25', 'AGISOT', '5', '5', 1, 18.0, 0.7739, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0194', 'ganaderas', '2026-02-25', 'AGISOT', '5', '5', 2, 23.0, 0.7214, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0195', 'ganaderas', '2026-02-25', 'AGISOT', '5', '5', 3, 22.0, 0.6265, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0196', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '1', 2, 18.0, 0.7577, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0197', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '1', 4, 24.0, 0.8186, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0198', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '1', 1, 22.0, 0.8095, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0199', 'ganaderas', '2026-02-25', 'AGISOT', '14_16', '14', 4, 35.0, 0.5327, 5000.0, 175000.0, 'Buen crecimiento'),
('ndvi-0200', 'ganaderas', '2026-02-25', 'AGISOT', '14_16', '14', 3, 32.0, 0.7281, 7500.0, 240000.0, 'Máximo desarrollo'),
('ndvi-0201', 'ganaderas', '2026-02-25', 'AGISOT', '14_16', '16', 2, 31.0, 0.5266, 5000.0, 155000.0, 'Buen crecimiento');

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0202', 'ganaderas', '2026-02-25', 'AGISOT', '14_16', '16', 1, 30.0, 0.6963, 7500.0, 225000.0, 'Máximo desarrollo'),
('ndvi-0203', 'ganaderas', '2026-02-25', 'AGISOT', '13_15', '13', 3, 15.0, 0.6287, 7500.0, 112500.0, 'Máximo desarrollo'),
('ndvi-0204', 'ganaderas', '2026-02-25', 'AGISOT', '13_15', '15', 5, 22.0, 0.7454, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0205', 'ganaderas', '2026-02-25', 'AGISOT', '9_11', '11', 7, 22.0, 0.8122, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0206', 'ganaderas', '2026-02-25', 'AGISOT', '10_12', '10', 4, 25.0, 0.2264, 2000.0, 50000.0, 'Bajo/Estrés'),
('ndvi-0207', 'ganaderas', '2026-02-25', 'AGISOT', '6_8', '8', 2, 32.0, 0.4831, 5000.0, 160000.0, 'Buen crecimiento'),
('ndvi-0208', 'ganaderas', '2026-02-25', 'AGISOT', '6_8', '8', 1, 37.0, 0.7125, 7500.0, 277500.0, 'Máximo desarrollo'),
('ndvi-0209', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '3', 6, 26.0, 0.3636, 2750.0, 71500.0, 'Intermedio'),
('ndvi-0210', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '3', 7, 26.0, 0.731, 7500.0, 195000.0, 'Máximo desarrollo'),
('ndvi-0211', 'ganaderas', '2026-02-25', 'AGISOT', '1_3', '3', 8, 28.0, 0.7697, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0212', 'ganaderas', '2026-02-25', 'AGISOT', '2_4', '2', 5, 19.0, 0.818, 7500.0, 142500.0, 'Máximo desarrollo'),
('ndvi-0213', 'ganaderas', '2026-02-25', 'AGISOT', '13_15', '13', 2, 27.0, 0.635, 7500.0, 202500.0, 'Máximo desarrollo'),
('ndvi-0214', 'ganaderas', '2026-03-02', 'AGISOT', '5', '5', 4, 25.0, 0.6206, 7500.0, 187500.0, 'Máximo desarrollo'),
('ndvi-0215', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '3', 5, 24.0, 0.7961, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0216', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '1', 3, 23.0, 0.7856, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0217', 'ganaderas', '2026-03-02', 'AGISOT', '7', '7', 4, 18.0, 0.7475, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0218', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '9', 4, 16.0, 0.8025, 7500.0, 120000.0, 'Máximo desarrollo'),
('ndvi-0219', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '11', 5, 19.0, 0.5571, 5000.0, 95000.0, 'Buen crecimiento'),
('ndvi-0220', 'ganaderas', '2026-03-02', 'AGISOT', '13_15', '15', 4, 39.0, 0.7314, 7500.0, 292500.0, 'Máximo desarrollo'),
('ndvi-0221', 'ganaderas', '2026-03-02', 'AGISOT', '10_12', '12', 1, 27.0, 0.6254, 7500.0, 202500.0, 'Máximo desarrollo'),
('ndvi-0222', 'ganaderas', '2026-03-02', 'AGISOT', '10_12', '10', 5, 25.0, 0.2123, 2000.0, 50000.0, 'Bajo/Estrés'),
('ndvi-0223', 'ganaderas', '2026-03-02', 'AGISOT', '6_8', '6', 6, 24.0, 0.786, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0224', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '4', 1, 23.0, 0.7634, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0225', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '2', 9, 21.0, 0.7295, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0226', 'ganaderas', '2026-03-02', 'AGISOT', '6_8', '6', 3, 28.0, 0.8293, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0227', 'ganaderas', '2026-03-02', 'AGISOT', '6_8', '6', 4, 24.0, 0.8175, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0228', 'ganaderas', '2026-03-02', 'AGISOT', '6_8', '6', 5, 24.0, 0.724, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0229', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '4', 2, 23.0, 0.6952, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0230', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '4', 3, 23.0, 0.8059, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0231', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '2', 7, 21.0, 0.5489, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0232', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '2', 8, 21.0, 0.4655, 5000.0, 105000.0, 'Buen crecimiento'),
('ndvi-0233', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '4', 4, 36.0, 0.8127, 7500.0, 270000.0, 'Máximo desarrollo'),
('ndvi-0234', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '2', 6, 20.0, 0.5859, 5000.0, 100000.0, 'Buen crecimiento'),
('ndvi-0235', 'ganaderas', '2026-03-02', 'AGISOT', '10_12', '10', 6, 31.0, 0.7224, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0236', 'ganaderas', '2026-03-02', 'AGISOT', '10_12', '12', 2, 26.0, 0.4043, 5000.0, 130000.0, 'Buen crecimiento'),
('ndvi-0237', 'ganaderas', '2026-03-02', 'AGISOT', '10_12', '12', 3, 31.0, 0.3383, 2750.0, 85250.0, 'Intermedio'),
('ndvi-0238', 'ganaderas', '2026-03-02', 'AGISOT', '13_15', '13', 1, 23.0, 0.5381, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0239', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '11', 6, 38.0, 0.6574, 7500.0, 285000.0, 'Máximo desarrollo'),
('ndvi-0240', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '9', 3, 21.0, 0.8051, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0241', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '9', 2, 21.0, 0.788, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0242', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '9', 1, 24.0, 0.802, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0243', 'ganaderas', '2026-03-02', 'AGISOT', '7', '7', 1, 24.0, 0.6855, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0244', 'ganaderas', '2026-03-02', 'AGISOT', '7', '7', 2, 24.0, 0.6657, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0245', 'ganaderas', '2026-03-02', 'AGISOT', '7', '7', 3, 22.0, 0.5411, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0246', 'ganaderas', '2026-03-02', 'AGISOT', '5', '5', 1, 18.0, 0.7861, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0247', 'ganaderas', '2026-03-02', 'AGISOT', '5', '5', 2, 23.0, 0.7753, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0248', 'ganaderas', '2026-03-02', 'AGISOT', '5', '5', 3, 22.0, 0.7082, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0249', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '1', 2, 18.0, 0.7916, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0250', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '1', 4, 24.0, 0.7354, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0251', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '1', 1, 22.0, 0.7894, 7500.0, 165000.0, 'Máximo desarrollo');

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0252', 'ganaderas', '2026-03-02', 'AGISOT', '14_16', '14', 4, 35.0, 0.5664, 5000.0, 175000.0, 'Buen crecimiento'),
('ndvi-0253', 'ganaderas', '2026-03-02', 'AGISOT', '14_16', '14', 3, 32.0, 0.6051, 7500.0, 240000.0, 'Máximo desarrollo'),
('ndvi-0254', 'ganaderas', '2026-03-02', 'AGISOT', '14_16', '16', 2, 31.0, 0.6273, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0255', 'ganaderas', '2026-03-02', 'AGISOT', '14_16', '16', 1, 30.0, 0.7265, 7500.0, 225000.0, 'Máximo desarrollo'),
('ndvi-0256', 'ganaderas', '2026-03-02', 'AGISOT', '13_15', '13', 3, 15.0, 0.6987, 7500.0, 112500.0, 'Máximo desarrollo'),
('ndvi-0257', 'ganaderas', '2026-03-02', 'AGISOT', '13_15', '15', 5, 22.0, 0.7495, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0258', 'ganaderas', '2026-03-02', 'AGISOT', '9_11', '11', 7, 22.0, 0.703, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0259', 'ganaderas', '2026-03-02', 'AGISOT', '10_12', '10', 4, 25.0, 0.2232, 2000.0, 50000.0, 'Bajo/Estrés'),
('ndvi-0260', 'ganaderas', '2026-03-02', 'AGISOT', '6_8', '8', 2, 32.0, 0.5744, 5000.0, 160000.0, 'Buen crecimiento'),
('ndvi-0261', 'ganaderas', '2026-03-02', 'AGISOT', '6_8', '8', 1, 37.0, 0.5686, 5000.0, 185000.0, 'Buen crecimiento'),
('ndvi-0262', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '3', 6, 26.0, 0.4786, 5000.0, 130000.0, 'Buen crecimiento'),
('ndvi-0263', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '3', 7, 26.0, 0.472, 5000.0, 130000.0, 'Buen crecimiento'),
('ndvi-0264', 'ganaderas', '2026-03-02', 'AGISOT', '1_3', '3', 8, 28.0, 0.7664, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0265', 'ganaderas', '2026-03-02', 'AGISOT', '2_4', '2', 5, 19.0, 0.8151, 7500.0, 142500.0, 'Máximo desarrollo'),
('ndvi-0266', 'ganaderas', '2026-03-02', 'AGISOT', '13_15', '13', 2, 27.0, 0.7272, 7500.0, 202500.0, 'Máximo desarrollo'),
('ndvi-0267', 'ganaderas', '2026-03-29', 'AGISOT', '5', '5', 4, 25.0, 0.6488, 7500.0, 187500.0, 'Máximo desarrollo'),
('ndvi-0268', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '3', 5, 24.0, 0.8236, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0269', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '1', 3, 23.0, 0.8097, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0270', 'ganaderas', '2026-03-29', 'AGISOT', '7', '7', 4, 18.0, 0.7344, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0271', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '9', 4, 16.0, 0.8176, 7500.0, 120000.0, 'Máximo desarrollo'),
('ndvi-0272', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '11', 5, 19.0, 0.8164, 7500.0, 142500.0, 'Máximo desarrollo'),
('ndvi-0273', 'ganaderas', '2026-03-29', 'AGISOT', '13_15', '15', 4, 39.0, 0.7754, 7500.0, 292500.0, 'Máximo desarrollo'),
('ndvi-0274', 'ganaderas', '2026-03-29', 'AGISOT', '10_12', '12', 1, 27.0, 0.559, 5000.0, 135000.0, 'Buen crecimiento'),
('ndvi-0275', 'ganaderas', '2026-03-29', 'AGISOT', '10_12', '10', 5, 25.0, 0.4383, 5000.0, 125000.0, 'Buen crecimiento'),
('ndvi-0276', 'ganaderas', '2026-03-29', 'AGISOT', '6_8', '6', 6, 24.0, 0.7166, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0277', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '4', 1, 23.0, 0.552, 5000.0, 115000.0, 'Buen crecimiento'),
('ndvi-0278', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '2', 9, 21.0, 0.7323, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0279', 'ganaderas', '2026-03-29', 'AGISOT', '6_8', '6', 3, 28.0, 0.7694, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0280', 'ganaderas', '2026-03-29', 'AGISOT', '6_8', '6', 4, 24.0, 0.6212, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0281', 'ganaderas', '2026-03-29', 'AGISOT', '6_8', '6', 5, 24.0, 0.5886, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0282', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '4', 2, 23.0, 0.7482, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0283', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '4', 3, 23.0, 0.8159, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0284', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '2', 7, 21.0, 0.617, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0285', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '2', 8, 21.0, 0.7694, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0286', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '4', 4, 36.0, 0.624, 7500.0, 270000.0, 'Máximo desarrollo'),
('ndvi-0287', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '2', 6, 20.0, 0.5217, 5000.0, 100000.0, 'Buen crecimiento'),
('ndvi-0288', 'ganaderas', '2026-03-29', 'AGISOT', '10_12', '10', 6, 31.0, 0.7561, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0289', 'ganaderas', '2026-03-29', 'AGISOT', '10_12', '12', 2, 26.0, 0.6837, 7500.0, 195000.0, 'Máximo desarrollo'),
('ndvi-0290', 'ganaderas', '2026-03-29', 'AGISOT', '10_12', '12', 3, 31.0, 0.6163, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0291', 'ganaderas', '2026-03-29', 'AGISOT', '13_15', '13', 1, 23.0, 0.6554, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0292', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '11', 6, 38.0, 0.6917, 7500.0, 285000.0, 'Máximo desarrollo'),
('ndvi-0293', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '9', 3, 21.0, 0.7901, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0294', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '9', 2, 21.0, 0.7496, 7500.0, 157500.0, 'Máximo desarrollo'),
('ndvi-0295', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '9', 1, 24.0, 0.5704, 5000.0, 120000.0, 'Buen crecimiento'),
('ndvi-0296', 'ganaderas', '2026-03-29', 'AGISOT', '7', '7', 1, 24.0, 0.7562, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0297', 'ganaderas', '2026-03-29', 'AGISOT', '7', '7', 2, 24.0, 0.7073, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0298', 'ganaderas', '2026-03-29', 'AGISOT', '7', '7', 3, 22.0, 0.5787, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0299', 'ganaderas', '2026-03-29', 'AGISOT', '5', '5', 1, 18.0, 0.7298, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0300', 'ganaderas', '2026-03-29', 'AGISOT', '5', '5', 2, 23.0, 0.8051, 7500.0, 172500.0, 'Máximo desarrollo'),
('ndvi-0301', 'ganaderas', '2026-03-29', 'AGISOT', '5', '5', 3, 22.0, 0.7541, 7500.0, 165000.0, 'Máximo desarrollo');

INSERT INTO ndvi_pasturas (id, cliente_id, fecha, campo, circuito, lote, parcelas, hectareas, ndvi, ms_kg_ha, ms_total_kg, estado) VALUES
('ndvi-0302', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '1', 2, 18.0, 0.7227, 7500.0, 135000.0, 'Máximo desarrollo'),
('ndvi-0303', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '1', 4, 24.0, 0.6669, 7500.0, 180000.0, 'Máximo desarrollo'),
('ndvi-0304', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '1', 1, 22.0, 0.5593, 5000.0, 110000.0, 'Buen crecimiento'),
('ndvi-0305', 'ganaderas', '2026-03-29', 'AGISOT', '14_16', '14', 4, 35.0, 0.5737, 5000.0, 175000.0, 'Buen crecimiento'),
('ndvi-0306', 'ganaderas', '2026-03-29', 'AGISOT', '14_16', '14', 3, 32.0, 0.5448, 5000.0, 160000.0, 'Buen crecimiento'),
('ndvi-0307', 'ganaderas', '2026-03-29', 'AGISOT', '14_16', '16', 2, 31.0, 0.7214, 7500.0, 232500.0, 'Máximo desarrollo'),
('ndvi-0308', 'ganaderas', '2026-03-29', 'AGISOT', '14_16', '16', 1, 30.0, 0.7287, 7500.0, 225000.0, 'Máximo desarrollo'),
('ndvi-0309', 'ganaderas', '2026-03-29', 'AGISOT', '13_15', '13', 3, 15.0, 0.6919, 7500.0, 112500.0, 'Máximo desarrollo'),
('ndvi-0310', 'ganaderas', '2026-03-29', 'AGISOT', '13_15', '15', 5, 22.0, 0.6357, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0311', 'ganaderas', '2026-03-29', 'AGISOT', '9_11', '11', 7, 22.0, 0.6634, 7500.0, 165000.0, 'Máximo desarrollo'),
('ndvi-0312', 'ganaderas', '2026-03-29', 'AGISOT', '10_12', '10', 4, 25.0, 0.5194, 5000.0, 125000.0, 'Buen crecimiento'),
('ndvi-0313', 'ganaderas', '2026-03-29', 'AGISOT', '6_8', '8', 2, 32.0, 0.6329, 7500.0, 240000.0, 'Máximo desarrollo'),
('ndvi-0314', 'ganaderas', '2026-03-29', 'AGISOT', '6_8', '8', 1, 37.0, 0.7749, 7500.0, 277500.0, 'Máximo desarrollo'),
('ndvi-0315', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '3', 6, 26.0, 0.7522, 7500.0, 195000.0, 'Máximo desarrollo'),
('ndvi-0316', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '3', 7, 26.0, 0.4922, 5000.0, 130000.0, 'Buen crecimiento'),
('ndvi-0317', 'ganaderas', '2026-03-29', 'AGISOT', '1_3', '3', 8, 28.0, 0.6513, 7500.0, 210000.0, 'Máximo desarrollo'),
('ndvi-0318', 'ganaderas', '2026-03-29', 'AGISOT', '2_4', '2', 5, 19.0, 0.6369, 7500.0, 142500.0, 'Máximo desarrollo'),
('ndvi-0319', 'ganaderas', '2026-03-29', 'AGISOT', '13_15', '13', 2, 27.0, 0.7109, 7500.0, 202500.0, 'Máximo desarrollo');



-- Verificación:
-- SELECT
--   COUNT(*) AS total,
--   ROUND(SUM(ms_total_kg)::numeric, 0) AS sum_ms_kg,
--   ROUND(SUM(hectareas)::numeric, 0) AS sum_ha,
--   ROUND(SUM(ms_total_kg) / NULLIF(SUM(hectareas), 0), 1) AS prom_ms_kg_ha
-- FROM ndvi_pasturas WHERE cliente_id = 'ganaderas';
-- Debería dar: total=318, sum_ms_kg ~47.460.000, sum_ha ~7.938, prom ~5.978
