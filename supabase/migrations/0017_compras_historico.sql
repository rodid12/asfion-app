-- ASFION — Histórico completo de compras del cliente Ganaderas.
--
-- Hoja 2 del archivo "cierre pastoreo 26(1).xlsx" — 17 operaciones cargadas
-- entre 7/5/2026 y 1/6/2026, todas hacia el feedlot Corrales (actividad
-- Invernada).
--
-- Reemplaza las 7 compras de migration 0016 (que eran solo las últimas
-- 7 del Excel viejo). Convención de numero_operacion del Excel "0010-26"
-- se normaliza a "10_26" para coincidir con el formato auto-generado
-- por la app móvil (NN_YY).
--
-- CAMBIOS DE SCHEMA: agregamos total_machos y total_hembras como columnas
-- explícitas para soportar los nuevos KPIs del dashboard (relación M/H).
-- Antes solo teníamos `cant_cab_y_cat` como TEXT libre que requería
-- parsing frágil.

-- =============================================================================
-- 1) Schema: agregar columnas TM/TH (idempotente)
-- =============================================================================

ALTER TABLE compras ADD COLUMN IF NOT EXISTS total_machos INTEGER;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS total_hembras INTEGER;

-- Hacer kg_netos_destino NULLABLE — la operación 0013-26 viene con peso
-- destino vacío en el Excel ("comprado, todavía no pesado en destino"),
-- y poner 0 o copiar origen mentiría sobre la merma. Para nuevas
-- instalaciones limpias el ALTER va acá; para DBs donde 0017 falló a
-- mitad la migración 0021 hace lo mismo + reintenta los 2 INSERTs.
ALTER TABLE compras ALTER COLUMN kg_netos_destino DROP NOT NULL;

-- =============================================================================
-- 2) Reemplazar las compras viejas con el histórico completo
-- =============================================================================

-- Borrar las compras viejas seedeadas (las del Excel anterior). Los IDs
-- nuevos siguen el patrón compra-2026-001, compra-2026-010, etc. Si Agus
-- ya cargó compras nuevas desde la app móvil (con UUIDs random), esas NO
-- se tocan.
DELETE FROM compras
WHERE cliente_id = 'ganaderas'
  AND id IN (
    '2a9bb778', 'f8194997', 'aea28ba2', '3147ccd3',
    '8e6eb597', '97cf0c30', '9a95120f'
  );

INSERT INTO compras (
  id, cliente_id, campo_id, usuario_email, fecha, actividad,
  cant_cab_y_cat, total_machos, total_hembras,
  kg_netos_origen, kg_netos_destino, merma_porcentaje,
  precio, consignado, titular, plazo, numero_operacion, observaciones
) VALUES
  ('compra-2026-001', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-07', 'Invernada', '64 machos · 60 hembras', 64, 60, 22128, 21400, 3.29, 5200, 'Teo Perez Alsina', 'Galvan Jorge Ruben (Las Breñas, Chaco)', 'Contado', '1_26', NULL),
  ('compra-2026-002', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-07', 'Invernada', '70 machos · 40 hembras', 70, 40, 20448, 20770, -1.57, 5500, 'BGL', 'Ñangapiry SA (El Dorado, Misiones)', '30-60', '2_26', NULL),
  ('compra-2026-003', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-11', 'Invernada', '83 machos · 39 hembras', 83, 39, 23765, 23260, 2.12, 5800, 'Eduardo Rueda', 'La Loma SAS (Resistencia, Cahaco)', '30-60', '3_26', NULL),
  ('compra-2026-004', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-13', 'Invernada', '90 machos · 40 hembras', 90, 40, 19350, 18920, 2.22, 6000, 'BGL', 'BGL (San Martin Chaco)', '30-60', '4_26', NULL),
  ('compra-2026-005', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-11', 'Invernada', '87 machos · 33 hembras', 87, 33, 22034, 20800, 5.6, 5800, 'Eduardo Rueda', 'La Loma SAS (Resistencia, Cahaco)', '30-60', '5_26', NULL),
  ('compra-2026-006', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-12', 'Invernada', '74 machos · 46 hembras', 74, 46, 22776, 21290, 6.52, 5100, 'Abelardo Usandivaras', 'Carneiro Lobo Braian (El Dorado, Misiones)', 'Contado', '6_26', NULL),
  ('compra-2026-007', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-19', 'Invernada', '83 machos · 27 hembras', 83, 27, 19995, 19040, 4.78, 5200, 'Teo Perez Alsina', 'Serial Ojeda Lisandro Nicolas (Saladas Corrientes)', 'Contado', '7_26', NULL),
  ('compra-2026-008', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-19', 'Invernada', '81 machos · 29 hembras', 81, 29, 19526, 19160, 1.87, 5300, 'Santiago Scofano', 'La Positiva Negocios Ganaderos SAS (Colonia Elisa Chaco)', 'Contado', '8_26', NULL),
  ('compra-2026-009', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-26', 'Invernada', '71 machos · 29 hembras', 71, 29, 17014, 16760, 1.49, 5300, 'Santiago Scofano', 'Juarez Marcelo Alberto (Riacho JEJE)', 'Contado', '9_26', NULL),
  ('compra-2026-010', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-28', 'Invernada', '82 machos · 33 hembras', 82, 33, 22359, 21227, 5.06, 5300, 'Santiago Scofano', 'Acevedo Claudio Norberto (San Martin Chaco)', 'Contado', '10_26', NULL),
  ('compra-2026-011', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-28', 'Invernada', '85 machos · 37 hembras', 85, 37, 20715, 18780, 9.34, 5000, 'Abelardo Usandivaras', 'Carneiro Lobo Braian (Misiones)', 'Contado', '11_26', NULL),
  ('compra-2026-012', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-01', 'Invernada', '84 machos · 36 hembras', 84, 36, 21627, 20520, 5.12, 5200, 'Teo Perez Alsina', 'Rolon Jhonatan Diego (Saladas Corrientes)', 'Contado', '12_26', NULL),
  ('compra-2026-014', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-01', 'Invernada', '65 machos · 57 hembras', 65, 57, 21303, 19980, 6.21, 5000, 'Abelardo Usandivaras', 'Carneiro Lobo Braian (Misiones)', 'Contado', '14_26', NULL),
  -- ⚠️ La operación 0013-26 viene PARTIDA en 2 jaulas distintas en el Excel
  -- (Martin Elias + Cisneros, mismo n° de operación, distintos vendedores).
  -- Antes ambas filas usaban PK 'compra-2026-013' y el ON CONFLICT pisaba
  -- la primera con la segunda → se perdía Martin Elias (49 cabezas, $55M).
  -- Los sufijos -a/-b separan los PK manteniendo numero_operacion='13_26'
  -- en ambas para que el dashboard las agrupe igual al buscar por N° op.
  ('compra-2026-013-a', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-01', 'Invernada', '49 machos', 49, NULL, 10074.4, NULL, 100, 5500, 'Eduardo Rueda', 'Miguel Elias Martin (Taco Pozo)', '30-60', '13_26', NULL),
  ('compra-2026-013-b', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-01', 'Invernada', '16 machos · 1 hembra', 16, 1, 3300, NULL, 100, 5200, 'Eduardo Rueda', 'Cisneros Walter Alberto (Taco Pozo)', 'Contado', '13_26', NULL),
  ('compra-2026-015', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-01', 'Invernada', '52 machos · 27 hembras', 52, 27, 14090.399, 13680, 2.91, 5250, 'Abelardo Usandivaras', 'De Jesus Victoria Maria Belen (San Martin Chaco)', 'Contado', '15_26', NULL),
  ('compra-2026-016', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-01', 'Invernada', '99 machos', 99, NULL, 21563, 21060, 2.33, 5100, 'Juan Calderoni', 'Torres Jorge Casiano (Curuzu Cuatia)', 'Contado', '16_26', NULL)
ON CONFLICT (id) DO UPDATE SET
  campo_id           = EXCLUDED.campo_id,
  fecha              = EXCLUDED.fecha,
  actividad          = EXCLUDED.actividad,
  cant_cab_y_cat     = EXCLUDED.cant_cab_y_cat,
  total_machos       = EXCLUDED.total_machos,
  total_hembras      = EXCLUDED.total_hembras,
  kg_netos_origen    = EXCLUDED.kg_netos_origen,
  kg_netos_destino   = EXCLUDED.kg_netos_destino,
  merma_porcentaje   = EXCLUDED.merma_porcentaje,
  precio             = EXCLUDED.precio,
  consignado         = EXCLUDED.consignado,
  titular            = EXCLUDED.titular,
  plazo              = EXCLUDED.plazo,
  numero_operacion   = EXCLUDED.numero_operacion;

-- Verificación:
-- SELECT
--   COUNT(*)                                    AS total_ops,
--   SUM(total_machos)                           AS sum_machos,
--   SUM(total_hembras)                          AS sum_hembras,
--   SUM(total_machos + total_hembras)           AS cabezas_total,
--   ROUND(SUM(kg_netos_destino)::numeric, 0)    AS kg_total,
--   ROUND(AVG(kg_netos_destino / NULLIF(total_machos + total_hembras, 0))::numeric, 1) AS kg_prom_cab,
--   ROUND(SUM(kg_netos_destino * precio)::numeric, 0) AS inversion_total
-- FROM compras WHERE cliente_id = 'ganaderas';
