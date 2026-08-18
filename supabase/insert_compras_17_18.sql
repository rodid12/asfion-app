-- ============================================================================
-- INSERT compras 17_26 y 18_26 (Corrales, julio 2026)
-- ============================================================================
--
-- Script one-shot para cargar las 2 últimas operaciones del cuadro que
-- mandó Ro (fecha 07/07/2026). No es migración numerada porque son data
-- ops, no cambio de schema — se corre en SQL Editor de Supabase.
--
-- Mapeo de columnas Excel → tabla compras:
--   ID_Compra        → id
--   CAMPO            → campo_id = 'campo-corrales'
--   ACTIVIDAD        → actividad
--   FECHA            → fecha (dd/mm/yyyy → yyyy-mm-dd)
--   CANT CAB Y CAT   → cant_cab_y_cat (texto libre)
--   KG NETOS Origen  → kg_netos_origen
--   KG NETOS Destino → kg_netos_destino
--   Merma %          → merma_porcentaje
--   Precio           → precio
--   Consignado       → consignado
--   Titular          → titular
--   Plazo            → plazo
--   Numero DTE       → numero_dte
--   Prefijo/Correl/Nro op → numero_operacion (ej. "17_26")
--   Km recorrido     → km_recorrido
--   Observaciones + Flete → observaciones (Flete embebido)
--   Usuario          → usuario_email
--
-- Columnas del Excel SIN campo propio en la DB:
--   - Prefijo/Correlativo por separado → no existen; solo numero_operacion
--   - Flete           → embebido en observaciones con formato "Flete: XXX"
--
-- Ambas filas dicen "121 terneros" / "165 terneros" (categoría genérica
-- sin distinguir sexo) — por eso total_machos y total_hembras quedan NULL.

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT idempotente (ON CONFLICT en id — si ya existe, actualiza)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO compras (
  id, cliente_id, campo_id, usuario_email, fecha,
  actividad, cant_cab_y_cat,
  kg_netos_origen, kg_netos_destino, merma_porcentaje, kg_corregidos,
  precio, consignado, titular, plazo,
  numero_dte, numero_operacion, km_recorrido,
  observaciones,
  total_machos, total_hembras
) VALUES

  -- Fila 17_26 — Pérez Alsina caro / De bortolini
  ('8c3042b3', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-07-07',
   'Invernada', '121 terneros',
   20951, 19700, 5.97, NULL,
   5400, 'Pérez Alsina caro', 'De bortolini Néstor y otros', NULL,
   '0321325351', '17_26', 897,
   '1 caído pero bajo bien. Flete: TD',
   NULL, NULL),

  -- Fila 18_26 — Nicolás Aguirre / Sastre Fernando
  -- Ojo: actividad viene VACÍA en el Excel — dejo NULL (columna nullable)
  -- Merma = 0 (kg_origen = kg_destino), plazo = Contado
  ('c0896340', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-07-07',
   NULL, '165 terneros',
   30240, 30240, 0.00, NULL,
   5300, 'Nicolás aguirre', 'Sastre fernando', 'Contado',
   NULL, '18_26', 12,
   'Flete: TD',
   NULL, NULL)

ON CONFLICT (id) DO UPDATE SET
  campo_id           = EXCLUDED.campo_id,
  usuario_email      = EXCLUDED.usuario_email,
  fecha              = EXCLUDED.fecha,
  actividad          = EXCLUDED.actividad,
  cant_cab_y_cat     = EXCLUDED.cant_cab_y_cat,
  kg_netos_origen    = EXCLUDED.kg_netos_origen,
  kg_netos_destino   = EXCLUDED.kg_netos_destino,
  merma_porcentaje   = EXCLUDED.merma_porcentaje,
  kg_corregidos      = EXCLUDED.kg_corregidos,
  precio             = EXCLUDED.precio,
  consignado         = EXCLUDED.consignado,
  titular            = EXCLUDED.titular,
  plazo              = EXCLUDED.plazo,
  numero_dte         = EXCLUDED.numero_dte,
  numero_operacion   = EXCLUDED.numero_operacion,
  km_recorrido       = EXCLUDED.km_recorrido,
  observaciones      = EXCLUDED.observaciones,
  total_machos       = EXCLUDED.total_machos,
  total_hembras      = EXCLUDED.total_hembras;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación — corré esto después del INSERT
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id, numero_operacion, fecha, cant_cab_y_cat,
  kg_netos_origen, kg_netos_destino, merma_porcentaje,
  precio, consignado, titular, km_recorrido, plazo,
  observaciones
FROM compras
WHERE cliente_id = 'ganaderas'
  AND numero_operacion IN ('17_26', '18_26')
ORDER BY numero_operacion;

-- Esperado: 2 rows. Total esperado en la tabla:
--   SELECT COUNT(*), COUNT(DISTINCT numero_operacion)
--   FROM compras WHERE cliente_id = 'ganaderas';
--   → 19 rows / 18 ops únicas (16 previas + 17_26 + 18_26; 13_26 sigue partida en 2)
