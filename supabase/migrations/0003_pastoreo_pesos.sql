-- =============================================================================
-- 0003: agregar pesos a pastoreo
-- =============================================================================
--
-- Motivo: el cliente quiere replicar los KPIs del Power BI de Pastoreo —
-- Animales, KG/Cab, Kg Totales, Carga (kg/ha). Para eso falta:
--   - cantidad de cabezas que entraron en cada stay
--   - peso promedio de esas cabezas
--
-- Ambas columnas son NULLABLE porque hay ~220 registros viejos que no
-- tienen esta info. El form mobile valida la entrada de los registros
-- nuevos (require positivos), pero la DB los acepta NULL para no romper
-- los stays existentes (que siguen siendo válidos como "movimiento"
-- pero sin datos productivos).
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar este archivo y RUN
--   3. Verificar con: SELECT column_name, data_type, is_nullable
--                       FROM information_schema.columns
--                      WHERE table_name = 'pastoreo'
--                        AND column_name IN ('animales', 'kg_promedio');
-- =============================================================================

ALTER TABLE pastoreo
  ADD COLUMN IF NOT EXISTS animales    INTEGER       CHECK (animales IS NULL OR animales >= 0),
  ADD COLUMN IF NOT EXISTS kg_promedio NUMERIC(7, 2) CHECK (kg_promedio IS NULL OR (kg_promedio >= 0 AND kg_promedio <= 2000));

-- Comentarios documentando el rango "razonable" del campo en hacienda.
COMMENT ON COLUMN pastoreo.animales    IS 'Cantidad de cabezas que entraron al stay. NULL = stay viejo sin dato productivo.';
COMMENT ON COLUMN pastoreo.kg_promedio IS 'Peso promedio (kg) de las cabezas del stay. NULL = stay viejo sin dato productivo.';
