-- =============================================================================
-- 0004: agregar módulo Compras
-- =============================================================================
--
-- Motivo: replicar el módulo "Compra" del AppSheet del cliente (Ganaderas).
-- Registra cada compra de hacienda — datos físicos (kg origen, kg destino,
-- merma), comerciales (precio, consignado, titular, plazo) y logísticos
-- (DTE, km, número de operación).
--
-- Convenciones:
--   - numero_operacion es auto-generado por el form móvil (formato típico
--     "COR_28" = primeras 3 letras del campo + secuencial), pero editable.
--   - merma_porcentaje se calcula automáticamente del form: (origen - destino)
--     / origen * 100. La DB acepta el valor que mande el form (override manual
--     si el operario lo edita).
--   - kg_corregidos es manual — cada campo tiene su fórmula propia.
--   - cant_cab_y_cat es texto libre por ahora ("83 machos. 27 hembras"). A
--     futuro podríamos parsearlo en campos estructurados.
--   - actividad es texto libre con catálogo sugerido en el form (Destete
--     Precoz, Engorde, Invernada) — vive en ClientConfig.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar este archivo y RUN
--   3. Verificar con: SELECT count(*) FROM compras;
-- =============================================================================

CREATE TABLE IF NOT EXISTS compras (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE RESTRICT,
  usuario_email TEXT NOT NULL,
  fecha DATE NOT NULL,

  -- Detalle físico
  actividad TEXT,                          -- Destete Precoz / Engorde / Invernada (texto libre)
  cant_cab_y_cat TEXT,                     -- "83 machos. 27 hembras" — descripción libre
  kg_netos_origen NUMERIC(10, 2) NOT NULL CHECK (kg_netos_origen >= 0),
  kg_netos_destino NUMERIC(10, 2) NOT NULL CHECK (kg_netos_destino >= 0),
  merma_porcentaje NUMERIC(5, 2),          -- (origen - destino) / origen * 100; auto en form
  kg_corregidos NUMERIC(10, 2),            -- manual, cada campo tiene su fórmula

  -- Detalle comercial
  precio NUMERIC(12, 2),                   -- ARS/kg típicamente
  consignado TEXT,                         -- nombre del consignatario (ej. "Pérez Alsina Caro")
  titular TEXT,                            -- nombre/dirección del vendedor
  plazo TEXT,                              -- "Contado", "30 días", etc.

  -- Logística
  numero_dte TEXT,                         -- documento de tránsito electrónico
  numero_operacion TEXT,                   -- auto-generado en form, formato "COR_28"
  km_recorrido INTEGER,

  observaciones TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS compras_cliente_idx       ON compras(cliente_id);
CREATE INDEX IF NOT EXISTS compras_campo_fecha_idx   ON compras(campo_id, fecha DESC);
CREATE INDEX IF NOT EXISTS compras_numero_op_idx     ON compras(cliente_id, numero_operacion);

-- RLS — mismo patrón que el resto de tablas transaccionales
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY compras_all ON compras FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

-- Comments documentando intent (útil para futuros maintainers)
COMMENT ON COLUMN compras.numero_operacion IS 'Auto-generado por la app móvil al guardar. Formato típico: <3 primeras letras del campo en mayúsculas>_<secuencial>. Editable manualmente.';
COMMENT ON COLUMN compras.merma_porcentaje IS '(kg_netos_origen - kg_netos_destino) / kg_netos_origen * 100. Calculado en form; el form acepta override manual del operario.';
COMMENT ON COLUMN compras.kg_corregidos IS 'Peso facturado/aceptado. Manual — cada campo tiene su fórmula propia (ej. kg_origen * (1 - merma_aceptada%)).';
COMMENT ON COLUMN compras.cant_cab_y_cat IS 'Descripción libre. Convención actual: "<N> machos. <N> hembras". Futuro: parsear o reemplazar por campos estructurados.';
