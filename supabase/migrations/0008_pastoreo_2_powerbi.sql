-- ASFION — Reemplazo de datos sintéticos por la tabla Pastoreo_2 del
-- Power BI del cliente.
--
-- Contexto: la migración 0007 había rellenado los 219 stays históricos con
-- valores estimados por categoría. Ahora Agus pasó el nuevo BI_GANADERIA
-- (Excel) con la tabla `Pastoreo_2` REAL — son 14 grupos activos con
-- número exacto de cabezas y kg/cab según su Power BI.
--
-- Esta migración:
--   1. Revierte la sintética 0007 (animales/kg_promedio → NULL en los
--      219 stays históricos). Esos quedan como movimientos sin peso
--      cargado — el dashboard los cuenta en "Total movimientos" pero no
--      inflan los KPIs productivos.
--   2. Agrega Pizetti como campo nuevo (no estaba en el seed inicial).
--   3. Agrega 4 circuitos nuevos para hacer matching con el Power BI:
--      Ico Pozo Impares, Ico Pozo Pares, Pizetti A2,3,4, Carolina 10,11,12.
--   4. Inserta 14 stays nuevos con los números EXACTOS del Power BI,
--      como "snapshot actual" (fecha_entrada = 2026-04-01, fecha_salida
--      = NULL para indicar que están activos).
--
-- Resultado esperado en el dashboard:
--   Animales:    ~6.989 cabezas
--   Kg Totales:  ~1.982.074 kg
--   KG/Cab:      ~283.6 kg (ponderado)
--   Has Circuito: ~2.235 ha (incluye los 4 circuitos nuevos)
--   Carga:        ~887 kg/ha
--   Carga Animal: ~3.13 cab/ha (= 6989 / 2235, valor más realista de
--                 ganadería extensiva argentina)

-- ============================================================================
-- 1) Revertir datos sintéticos del 0007
-- ============================================================================

UPDATE pastoreo
SET
  animales = NULL,
  kg_promedio = NULL
WHERE cliente_id = 'ganaderas';

-- ============================================================================
-- 2) Campo nuevo: Pizetti
-- ============================================================================

INSERT INTO campos (id, cliente_id, nombre, organizacion_id, stock_inicial_vacas)
VALUES ('campo-pizetti', 'ganaderas', 'Pizetti', 'org-ganaderas', NULL)
ON CONFLICT (id) DO NOTHING;

-- Lote de Pizetti (necesario para futuras cargas que requieren lote)
INSERT INTO lotes (id, cliente_id, campo_id, nombre)
VALUES ('lote-pizetti-a234', 'ganaderas', 'campo-pizetti', 'A2,3,4')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3) Circuitos nuevos del Power BI
-- ============================================================================

INSERT INTO circuitos (id, cliente_id, campo_id, nombre, hectareas) VALUES
  ('circ-ico-pozo-impares',  'ganaderas', 'campo-ico-pozo',  'Impares',   272),
  ('circ-ico-pozo-pares',    'ganaderas', 'campo-ico-pozo',  'Pares',     320),
  ('circ-pizetti-a234',      'ganaderas', 'campo-pizetti',   'A2,3,4',    248),
  ('circ-carolina-10-11-12', 'ganaderas', 'campo-carolina',  '10,11,12',  121)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4) Parcelas mínimas para que los stays se puedan crear
--    (schema requiere parcela_id NOT NULL)
-- ============================================================================

-- Las parcelas se asocian al campo a través del circuito (no tienen
-- campo_id propio). El schema de parcelas tiene: id, circuito_id,
-- cliente_id, numero, hectareas.
INSERT INTO parcelas (id, cliente_id, circuito_id, numero, hectareas) VALUES
  ('parc-agisot-1-3-1',          'ganaderas', 'circ-agisot-1-3',         1, 201),
  ('parc-agisot-2-4-1',          'ganaderas', 'circ-agisot-2-4',         1, 217),
  ('parc-agisot-5-1',            'ganaderas', 'circ-agisot-5',           1,  93),
  ('parc-agisot-6-8-1',          'ganaderas', 'circ-agisot-6-8',         1, 174),
  ('parc-agisot-7-1',            'ganaderas', 'circ-agisot-7',           1,  91),
  ('parc-agisot-9-11-1',         'ganaderas', 'circ-agisot-9-11',        1, 153),
  ('parc-agisot-10-12-1',        'ganaderas', 'circ-agisot-10-12',       1,  60),
  ('parc-agisot-13-15-1',        'ganaderas', 'circ-agisot-13-15',       1, 129),
  ('parc-agisot-14-16-1',        'ganaderas', 'circ-agisot-14-16',       1, 129),
  ('parc-ico-pozo-impares-1',    'ganaderas', 'circ-ico-pozo-impares',   1, 272),
  ('parc-ico-pozo-pares-1',      'ganaderas', 'circ-ico-pozo-pares',     1, 320),
  ('parc-pizetti-a234-1',        'ganaderas', 'circ-pizetti-a234',       1, 248),
  ('parc-carolina-10-11-12-1',   'ganaderas', 'circ-carolina-10-11-12',  1, 121)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5) 14 stays del Power BI Pastoreo_2 — snapshot del estado actual
--    fecha_entrada = 2026-04-01 (snapshot date)
--    fecha_salida = NULL (= "activo", el grupo sigue en el circuito)
--    evento = 'Entrada' (cuando salgan, el operario carga 'Salida' en otra row)
-- ============================================================================

INSERT INTO pastoreo (
  id, cliente_id, campo_id, circuito_id, parcela_id, parcela_numero,
  usuario_email, fecha_entrada, fecha_salida, categoria, evento,
  animales, kg_promedio
) VALUES
  -- AGISOT
  ('pasto-pbi-001', 'ganaderas', 'campo-agisot',   'circ-agisot-1-3',         'parc-agisot-1-3-1',         1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 807, 305.14),
  ('pasto-pbi-002', 'ganaderas', 'campo-agisot',   'circ-agisot-2-4',         'parc-agisot-2-4-1',         1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 700, 281.00),
  ('pasto-pbi-003', 'ganaderas', 'campo-agisot',   'circ-agisot-5',           'parc-agisot-5-1',           1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 383, 229.30),
  ('pasto-pbi-004', 'ganaderas', 'campo-agisot',   'circ-agisot-6-8',         'parc-agisot-6-8-1',         1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Vaquillas',  'Entrada', 529, 344.00),
  ('pasto-pbi-005', 'ganaderas', 'campo-agisot',   'circ-agisot-7',           'parc-agisot-7-1',           1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 389, 332.30),
  ('pasto-pbi-006', 'ganaderas', 'campo-agisot',   'circ-agisot-9-11',        'parc-agisot-9-11-1',        1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 582, 361.00),
  ('pasto-pbi-007', 'ganaderas', 'campo-agisot',   'circ-agisot-10-12',       'parc-agisot-10-12-1',       1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Vaquillas',  'Entrada', 163, 367.50),
  ('pasto-pbi-008', 'ganaderas', 'campo-agisot',   'circ-agisot-13-15',       'parc-agisot-13-15-1',       1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 500, 334.00),
  ('pasto-pbi-009', 'ganaderas', 'campo-agisot',   'circ-agisot-14-16',       'parc-agisot-14-16-1',       1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 548, 232.50),
  -- ICO POZO
  ('pasto-pbi-010', 'ganaderas', 'campo-ico-pozo', 'circ-ico-pozo-impares',   'parc-ico-pozo-impares-1',   1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Vaquillas',  'Entrada', 550, 264.53),
  ('pasto-pbi-011', 'ganaderas', 'campo-ico-pozo', 'circ-ico-pozo-impares',   'parc-ico-pozo-impares-1',   1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Novillitos', 'Entrada', 293, 269.32),
  ('pasto-pbi-012', 'ganaderas', 'campo-ico-pozo', 'circ-ico-pozo-pares',     'parc-ico-pozo-pares-1',     1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Vaquillas',  'Entrada', 630, 312.00),
  -- PIZETTI
  ('pasto-pbi-013', 'ganaderas', 'campo-pizetti',  'circ-pizetti-a234',       'parc-pizetti-a234-1',       1, 'armandocollante15@gmail.com', '2026-04-01', NULL, 'Vaquillas',  'Entrada', 615, 242.40),
  -- CAROLINA
  ('pasto-pbi-014', 'ganaderas', 'campo-carolina', 'circ-carolina-10-11-12',  'parc-carolina-10-11-12-1',  1, 'emilianogabrielzerpa5@gmail.com', '2026-04-01', NULL, 'Vaquillas', 'Entrada', 300, 299.96)
ON CONFLICT (id) DO UPDATE SET
  animales = EXCLUDED.animales,
  kg_promedio = EXCLUDED.kg_promedio,
  evento = EXCLUDED.evento,
  fecha_salida = EXCLUDED.fecha_salida;

-- ============================================================================
-- Verificación: el siguiente SELECT debería mostrar
--   total_stays      = 233 (219 históricos sin animales + 14 nuevos del PBI)
--   stays_con_datos  = 14 (solo los del Power BI)
--   sum_animales     = 6989
--   prom_kg_cab      ≈ 283.6 (ponderado por animales)
--
-- SELECT
--   COUNT(*) AS total_stays,
--   COUNT(animales) AS stays_con_datos,
--   SUM(animales) AS sum_animales,
--   ROUND(SUM(animales * kg_promedio) / NULLIF(SUM(animales), 0), 2) AS prom_kg_cab_ponderado
-- FROM pastoreo
-- WHERE cliente_id = 'ganaderas';
