-- =============================================================================
-- 0021 — Compras: schema fix + carga histórica completa (self-contained)
-- =============================================================================
--
-- Esta migración es AUTOSUFICIENTE: combina lo de 0017 (carga histórica de
-- 17 compras) + el fix de schema que faltaba (kg_netos_destino NULLABLE) +
-- el split del PK duplicado de la op 0013-26.
--
-- Por qué autosuficiente: la migración 0017 explotaba en el INSERT del PK
-- duplicado `compra-2026-013`, y Supabase SQL editor corre todo en una
-- transacción implícita — al fallar al final, los ALTER TABLE del principio
-- (que agregaban total_machos / total_hembras) también se rollearon. Por
-- eso después tampoco se podía correr 0021: las columnas no existían.
--
-- Esta 0021 hace TODO el camino completo:
--   1. ALTER ADD COLUMN total_machos / total_hembras (idempotente)
--   2. ALTER kg_netos_destino DROP NOT NULL (idempotente)
--   3. Borrar las 7 compras viejas del seed 0016 (no las que cargó el user)
--   4. Insertar las 17 compras del Excel "cierre pastoreo 26(2).xlsx" con
--      la op 0013-26 partida en `-a` y `-b` (Martin Elias + Cisneros)
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Verificar: SELECT COUNT(*) FROM compras WHERE cliente_id='ganaderas';
--      → 17 (o más si el user ya cargó compras nuevas desde la app móvil)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Schema: columnas TM/TH + destino NULLABLE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE compras ADD COLUMN IF NOT EXISTS total_machos  INTEGER;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS total_hembras INTEGER;
ALTER TABLE compras ALTER COLUMN kg_netos_destino DROP NOT NULL;

-- merma y kg_corregidos también NULLABLE por defensa (eran NULLABLE en
-- el schema original pero defensivos por si alguien las pusiera NOT NULL).
ALTER TABLE compras ALTER COLUMN merma_porcentaje DROP NOT NULL;
ALTER TABLE compras ALTER COLUMN kg_corregidos    DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Borrar las 7 compras viejas del seed 0016 + el row fantasma 'compra-2026-013'
--    (si quedó de algún intento previo de 0017)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM compras
WHERE cliente_id = 'ganaderas'
  AND id IN (
    '2a9bb778', 'f8194997', 'aea28ba2', '3147ccd3',
    '85ad9e6f', '6d29c63e', 'd485c1d2',
    'compra-2026-013'   -- PK viejo sin sufijo, si quedó colgado
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Cargar las 17 compras del Excel
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotente con ON CONFLICT — re-ejecutar no duplica ni pierde data.
-- Convención: numero_operacion "0010-26" → "10_26" (matchea formato de
-- la app móvil NN_YY).

-- Columnas en orden — ojo con `km_recorrido` (INTEGER!) y `observaciones` (TEXT).
-- "Vendedor Razon Social" del Excel cuando existe va en `observaciones` (no en
-- titular para no pisar "Quien Liquida"). km_recorrido queda NULL — el Excel
-- nunca lo trae cargado.
INSERT INTO compras (
  id, cliente_id, campo_id, usuario_email, fecha, actividad,
  cant_cab_y_cat, total_machos, total_hembras,
  kg_netos_origen, kg_netos_destino, merma_porcentaje,
  precio, consignado, titular, plazo, numero_operacion,
  km_recorrido, observaciones
) VALUES
  ('compra-2026-001','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-07','Invernada','64 machos · 60 hembras',64,60,22128,21400,3.29,5200,'Teo Perez Alsina','Galvan Jorge Ruben (Las Breñas, Chaco)','Contado','1_26',NULL,NULL),
  ('compra-2026-002','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-07','Invernada','70 machos · 40 hembras',70,40,20448,20770,-1.58,5500,'BGL','Ñangapiry SA (El Dorado, Misiones)','30-60','2_26',NULL,NULL),
  ('compra-2026-003','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-11','Invernada','83 machos · 39 hembras',83,39,23765,23260,2.12,5800,'Eduardo Rueda','La Loma SAS (Resistencia, Chaco)','30-60','3_26',NULL,NULL),
  -- Op 0004-26: el Excel trae Vendedor Razon Social = "Agrocomercial Yuquery"
  -- (única op del Excel con este campo cargado). Lo guardamos en observaciones.
  ('compra-2026-004','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-13','Invernada','90 machos · 40 hembras',90,40,19350,18920,2.22,6000,'BGL','BGL (San Martin Chaco)','30-60','4_26',NULL,'Vendedor Razón Social: Agrocomercial Yuquery'),
  ('compra-2026-005','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-11','Invernada','87 machos · 33 hembras',87,33,22034,20800,5.60,5800,'Eduardo Rueda','La Loma SAS (Resistencia, Chaco)','30-60','5_26',NULL,NULL),
  ('compra-2026-006','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-12','Invernada','74 machos · 46 hembras',74,46,22776,21290,6.52,5100,'Abelardo Usandivaras','Carneiro Lobo Braian (El Dorado, Misiones)','Contado','6_26',NULL,NULL),
  ('compra-2026-007','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-19','Invernada','83 machos · 27 hembras',83,27,19995,19040,4.78,5200,'Teo Perez Alsina','Serial Ojeda Lisandro Nicolas (Saladas Corrientes)','Contado','7_26',NULL,NULL),
  ('compra-2026-008','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-19','Invernada','81 machos · 29 hembras',81,29,19526,19160,1.87,5300,'Santiago Scofano','La Positiva Negocios Ganaderos (Colonia Elisa Chaco)','Contado','8_26',NULL,NULL),
  ('compra-2026-009','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-26','Invernada','71 machos · 29 hembras',71,29,17014,16760,1.49,5300,'Santiago Scofano','Juarez Marcelo Alberto (Riacho JEJE)','Contado','9_26',NULL,NULL),
  ('compra-2026-010','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-28','Invernada','82 machos · 33 hembras',82,33,22359,21227,5.06,5300,'Santiago Scofano','Acevedo Claudio Norberto (San Martin Chaco)','Contado','10_26',NULL,NULL),
  ('compra-2026-011','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-05-28','Invernada','85 machos · 37 hembras',85,37,20715,18780,9.34,5000,'Abelardo Usandivaras','Carneiro Lobo Braian (Misiones)','Contado','11_26',NULL,NULL),
  ('compra-2026-012','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-06-01','Invernada','84 machos · 36 hembras',84,36,21627,20520,5.12,5200,'Teo Perez Alsina','Rolon Jhonatan Diego (Saladas Corrientes)','Contado','12_26',NULL,NULL),
  -- ⚠️ Op 0013-26 viene PARTIDA en 2 jaulas (mismo n°, distintos vendedores):
  -- Martin Elias trae Vendedor Razon Social = "Martin Elias" (= titular).
  -- Cisneros trae Vendedor Razon Social = "Walter Cisneros" (= titular).
  ('compra-2026-013-a','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-06-01','Invernada','49 machos',49,NULL,10074.4,NULL,NULL,5500,'Eduardo Rueda','Miguel Elias Martin (Taco Pozo)','30-60','13_26',NULL,'Sin pesaje en destino al cierre'),
  ('compra-2026-013-b','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-06-01','Invernada','16 machos · 1 hembra',16,1,3300,NULL,NULL,5200,'Eduardo Rueda','Cisneros Walter Alberto (Taco Pozo)','Contado','13_26',NULL,'Sin pesaje en destino al cierre'),
  ('compra-2026-014','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-06-01','Invernada','65 machos · 57 hembras',65,57,21303,19980,6.21,5000,'Abelardo Usandivaras','Carneiro Lobo Braian (Misiones)','Contado','14_26',NULL,NULL),
  ('compra-2026-015','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-06-01','Invernada','52 machos · 27 hembras',52,27,14090.4,13680,2.91,5250,'Abelardo Usandivaras','De Jesus Victoria Maria Belen (San Martin Chaco)','Contado','15_26',NULL,NULL),
  ('compra-2026-016','ganaderas','campo-corrales','robustianoasaravia@gmail.com','2026-06-01','Invernada','99 machos',99,NULL,21563,21060,2.33,5100,'Juan Calderoni','Torres Jorge Casiano (Curuzu Cuatia)','Contado','16_26',NULL,NULL)
ON CONFLICT (id) DO UPDATE SET
  campo_id         = EXCLUDED.campo_id,
  fecha            = EXCLUDED.fecha,
  actividad        = EXCLUDED.actividad,
  cant_cab_y_cat   = EXCLUDED.cant_cab_y_cat,
  total_machos     = EXCLUDED.total_machos,
  total_hembras    = EXCLUDED.total_hembras,
  kg_netos_origen  = EXCLUDED.kg_netos_origen,
  kg_netos_destino = EXCLUDED.kg_netos_destino,
  merma_porcentaje = EXCLUDED.merma_porcentaje,
  precio           = EXCLUDED.precio,
  consignado       = EXCLUDED.consignado,
  titular          = EXCLUDED.titular,
  plazo            = EXCLUDED.plazo,
  numero_operacion = EXCLUDED.numero_operacion,
  km_recorrido     = EXCLUDED.km_recorrido,
  observaciones    = EXCLUDED.observaciones;

-- =============================================================================
-- Verificación esperada tras correr:
--   SELECT COUNT(*) FROM compras WHERE cliente_id='ganaderas';        -- 17
--   SELECT COUNT(*) FROM compras WHERE numero_operacion='13_26';      -- 2
--   SELECT id, total_machos, total_hembras, kg_netos_destino
--     FROM compras WHERE numero_operacion='13_26';
--   → compra-2026-013-a: 49 machos, NULL hembras, NULL destino
--   → compra-2026-013-b: 16 machos, 1 hembra,    NULL destino
-- =============================================================================
